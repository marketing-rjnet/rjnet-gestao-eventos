-- =============================================================
-- RJNET GESTÃO DE EVENTOS — Migração para Supabase Auth
-- =============================================================
-- Rode DEPOIS do schema.sql, no SQL Editor do Supabase.
-- Idempotente: pode rodar mais de uma vez.
--
-- O que faz:
--   1. Cria a tabela `perfis` (papel de cada usuário: marketing,
--      vendedor ou comercial) ligada ao Supabase Auth
--   2. Adiciona `vendedor_id` aos leads (vínculo com quem registrou)
--   3. REMOVE o acesso anônimo e cria regras por papel:
--        marketing → tudo
--        vendedor  → insere/vê/edita apenas os próprios leads
--        comercial → leitura de todos os leads
--   4. Cria a função ranking_evento (placar sem expor leads alheios)
--
-- ⚠️ Após rodar, o app passa a EXIGIR login — veja no fim como
--    criar o primeiro usuário marketing.
-- =============================================================

-- ─── 1. Perfis ───────────────────────────────────────────────

create table if not exists public.perfis (
  id     uuid primary key references auth.users (id) on delete cascade,
  email  text,
  nome   text not null,
  papel  text not null default 'vendedor' check (papel in ('marketing', 'vendedor', 'comercial')),
  ativo  boolean not null default false,
  criado_em timestamptz not null default now()
);

-- Todo usuário novo do Auth ganha um perfil INATIVO de vendedor.
-- O marketing ativa e define o papel pelo painel — assim ninguém
-- consegue se auto-cadastrar com acesso.
create or replace function public.handle_novo_usuario()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.perfis (id, email, nome, papel, ativo)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nome', new.email),
    'vendedor',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_novo_usuario();

-- Papel do usuário logado (security definer evita recursão de RLS)
create or replace function public.papel_atual()
returns text
language sql stable
security definer set search_path = public
as $$
  select papel from public.perfis where id = auth.uid() and ativo
$$;

-- ─── 2. Vínculo lead → usuário ───────────────────────────────

alter table public.leads
  add column if not exists vendedor_id uuid references auth.users (id) on delete set null;

create index if not exists idx_leads_vendedor on public.leads (vendedor_id);

-- ─── 3. Políticas por papel (remove o acesso anônimo) ────────

alter table public.perfis enable row level security;

drop policy if exists "app_acesso_total" on public.materiais;
drop policy if exists "app_acesso_total" on public.vendedores;
drop policy if exists "app_acesso_total" on public.eventos;
drop policy if exists "app_acesso_total" on public.leads;

-- perfis: cada um vê o próprio; marketing vê e gerencia todos
drop policy if exists "perfis_select" on public.perfis;
create policy "perfis_select" on public.perfis for select to authenticated
  using (id = auth.uid() or public.papel_atual() = 'marketing');

drop policy if exists "perfis_update" on public.perfis;
create policy "perfis_update" on public.perfis for update to authenticated
  using (public.papel_atual() = 'marketing')
  with check (public.papel_atual() = 'marketing');

drop policy if exists "perfis_delete" on public.perfis;
create policy "perfis_delete" on public.perfis for delete to authenticated
  using (public.papel_atual() = 'marketing');

-- eventos: todos os papéis leem; só marketing altera
drop policy if exists "eventos_select" on public.eventos;
create policy "eventos_select" on public.eventos for select to authenticated
  using (public.papel_atual() is not null);

drop policy if exists "eventos_write" on public.eventos;
create policy "eventos_write" on public.eventos for all to authenticated
  using (public.papel_atual() = 'marketing')
  with check (public.papel_atual() = 'marketing');

-- materiais: todos os papéis leem; só marketing altera
drop policy if exists "materiais_select" on public.materiais;
create policy "materiais_select" on public.materiais for select to authenticated
  using (public.papel_atual() is not null);

drop policy if exists "materiais_write" on public.materiais;
create policy "materiais_write" on public.materiais for all to authenticated
  using (public.papel_atual() = 'marketing')
  with check (public.papel_atual() = 'marketing');

-- vendedores (tabela legada, mantida por compatibilidade): só marketing
drop policy if exists "vendedores_marketing" on public.vendedores;
create policy "vendedores_marketing" on public.vendedores for all to authenticated
  using (public.papel_atual() = 'marketing')
  with check (public.papel_atual() = 'marketing');

-- leads:
--   marketing  → tudo
--   comercial  → leitura de todos
--   vendedor   → insere/vê/edita/apaga APENAS os próprios
drop policy if exists "leads_select" on public.leads;
create policy "leads_select" on public.leads for select to authenticated
  using (
    public.papel_atual() in ('marketing', 'comercial')
    or (public.papel_atual() = 'vendedor' and vendedor_id = auth.uid())
  );

drop policy if exists "leads_insert" on public.leads;
create policy "leads_insert" on public.leads for insert to authenticated
  with check (
    public.papel_atual() = 'marketing'
    or (public.papel_atual() = 'vendedor' and vendedor_id = auth.uid())
  );

drop policy if exists "leads_update" on public.leads;
create policy "leads_update" on public.leads for update to authenticated
  using (
    public.papel_atual() = 'marketing'
    or (public.papel_atual() = 'vendedor' and vendedor_id = auth.uid())
  )
  with check (
    public.papel_atual() = 'marketing'
    or (public.papel_atual() = 'vendedor' and vendedor_id = auth.uid())
  );

drop policy if exists "leads_delete" on public.leads;
create policy "leads_delete" on public.leads for delete to authenticated
  using (
    public.papel_atual() = 'marketing'
    or (public.papel_atual() = 'vendedor' and vendedor_id = auth.uid())
  );

-- ─── 4. Placar do evento ─────────────────────────────────────
-- Permite ao vendedor ver a pontuação da equipe (totais por nome)
-- sem ter acesso aos leads dos colegas.

create or replace function public.ranking_evento(eid text)
returns table (vendedor_nome text, total bigint)
language sql stable
security definer set search_path = public
as $$
  select l.vendedor_nome, count(*)::bigint as total
  from public.leads l
  where l.evento_id = eid
    and public.papel_atual() is not null
  group by l.vendedor_nome
  order by total desc
$$;

revoke all on function public.ranking_evento(text) from public, anon;
grant execute on function public.ranking_evento(text) to authenticated;

-- Realtime na tabela de perfis (gestão de usuários ao vivo)
do $$
begin
  alter publication supabase_realtime add table public.perfis;
exception when duplicate_object then null;
end $$;

-- =============================================================
-- PRIMEIRO ACESSO (faça uma única vez):
--
-- 1. Dashboard → Authentication → Users → "Add user"
--    → e-mail e senha do administrador → marque "Auto Confirm User"
-- 2. Rode no SQL Editor (com o seu e-mail):
--
--    update public.perfis
--      set papel = 'marketing', ativo = true
--      where email = 'seu@email.com';
--
-- 3. Dashboard → Authentication → Sign In / Up → desative
--    "Confirm email" (os usuários são criados pelo marketing,
--    não precisam confirmar e-mail).
-- =============================================================
