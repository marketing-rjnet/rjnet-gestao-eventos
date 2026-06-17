-- PA-13/LGPD: Tabela de auditoria de operações em dados pessoais (A-02, A-04, A-05, BD-04)
-- Registra automaticamente via trigger toda inserção, atualização e exclusão em leads.
-- Idempotente: seguro executar múltiplas vezes.

-- 1. Tabela de auditoria
create table if not exists public.audit_log (
  id           uuid        primary key default gen_random_uuid(),
  usuario_id   uuid        references auth.users(id) on delete set null,
  usuario_nome text,
  acao         text        not null,  -- INSERT | UPDATE | DELETE
  tabela       text        not null,
  registro_id  text,
  dados_antes  jsonb,
  dados_depois jsonb,
  criado_em    timestamptz not null default now()
);

create index if not exists idx_audit_log_usuario  on public.audit_log (usuario_id);
create index if not exists idx_audit_log_registro on public.audit_log (registro_id);
create index if not exists idx_audit_log_em       on public.audit_log (criado_em desc);

-- RLS: apenas marketing lê; sistema (trigger) insere
alter table public.audit_log enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'audit_log' and policyname = 'audit_log_select'
  ) then
    create policy "audit_log_select" on public.audit_log
      for select to authenticated using (public.papel_atual() = 'marketing');
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'audit_log' and policyname = 'audit_log_insert'
  ) then
    create policy "audit_log_insert" on public.audit_log
      for insert to authenticated with check (true);
  end if;
end $$;

-- 2. Função de trigger (SECURITY DEFINER para acessar auth.uid() no contexto do trigger)
create or replace function public.log_lead_change()
returns trigger language plpgsql security definer as $$
declare
  nome_usuario text;
begin
  select coalesce(p.nome, '') into nome_usuario
  from public.perfis p where p.id = auth.uid();

  insert into public.audit_log (usuario_id, usuario_nome, acao, tabela, registro_id, dados_antes, dados_depois)
  values (
    auth.uid(),
    nome_usuario,
    tg_op,
    tg_table_name,
    coalesce(new.id::text, old.id::text),
    case when tg_op <> 'INSERT' then to_jsonb(old) else null end,
    case when tg_op <> 'DELETE' then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

-- 3. Trigger na tabela leads
drop trigger if exists audit_leads on public.leads;
create trigger audit_leads
  after insert or update or delete on public.leads
  for each row execute function public.log_lead_change();
