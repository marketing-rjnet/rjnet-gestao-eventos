-- =============================================================
-- D-059: Perfil "comercial" — gerente comercial acompanha vendedores
-- =============================================================
-- Rode DEPOIS de migracao-auth.sql, migracao-ofertas.sql e
-- migracao-leads-mensais.sql, no SQL Editor do Supabase.
-- Idempotente: pode rodar mais de uma vez.
--
-- O que faz:
--   1. Adiciona 'comercial' aos papéis aceitos em `perfis`
--   2. Estende as policies de escrita de `eventos`, `ofertas`,
--      `leads` e do bucket `ofertas` para aceitar também o papel
--      'comercial' — mesmo nível de marketing nessas 3 áreas
--   3. NÃO toca em `materiais` (estoque) nem em `perfis`
--      (gestão de equipe) — essas continuam marketing-only
--
-- Depois de aplicar, rode:
--   NOTIFY pgrst, 'reload schema';
-- (ou Dashboard → Settings → API → Reload schema)
-- =============================================================

-- ─── 1. Papel "comercial" em perfis ──────────────────────────

alter table public.perfis drop constraint if exists perfis_papel_check;
alter table public.perfis
  add constraint perfis_papel_check check (papel in ('marketing', 'vendedor', 'comercial'));

-- ─── 2. eventos: marketing OU comercial administram ──────────

drop policy if exists "eventos_write" on public.eventos;
create policy "eventos_write" on public.eventos for all to authenticated
  using (public.papel_atual() in ('marketing', 'comercial'))
  with check (public.papel_atual() in ('marketing', 'comercial'));

-- ─── 3. leads: comercial acompanha e edita como marketing ────
-- (leitura já era ampla para qualquer papel autenticado; aqui só
-- as policies de escrita ganham o novo papel, lado a lado com
-- marketing — vendedor continua restrito aos próprios leads)

drop policy if exists "leads_insert" on public.leads;
create policy "leads_insert" on public.leads for insert to authenticated
  with check (
    public.papel_atual() in ('marketing', 'comercial')
    or (public.papel_atual() = 'vendedor' and vendedor_id = auth.uid())
  );

drop policy if exists "leads_update" on public.leads;
create policy "leads_update" on public.leads for update to authenticated
  using (
    public.papel_atual() in ('marketing', 'comercial')
    or (public.papel_atual() = 'vendedor' and vendedor_id = auth.uid())
  )
  with check (
    public.papel_atual() in ('marketing', 'comercial')
    or (public.papel_atual() = 'vendedor' and vendedor_id = auth.uid())
  );

drop policy if exists "leads_delete" on public.leads;
create policy "leads_delete" on public.leads for delete to authenticated
  using (
    public.papel_atual() in ('marketing', 'comercial')
    or (public.papel_atual() = 'vendedor' and vendedor_id = auth.uid())
  );

-- ─── 4. ofertas + bucket de Storage: marketing OU comercial ──

drop policy if exists "ofertas_write" on public.ofertas;
create policy "ofertas_write" on public.ofertas for all to authenticated
  using (public.papel_atual() in ('marketing', 'comercial'))
  with check (public.papel_atual() in ('marketing', 'comercial'));

drop policy if exists "ofertas_bucket_write" on storage.objects;
create policy "ofertas_bucket_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'ofertas' and public.papel_atual() in ('marketing', 'comercial'));

drop policy if exists "ofertas_bucket_update" on storage.objects;
create policy "ofertas_bucket_update" on storage.objects for update to authenticated
  using (bucket_id = 'ofertas' and public.papel_atual() in ('marketing', 'comercial'));

drop policy if exists "ofertas_bucket_delete" on storage.objects;
create policy "ofertas_bucket_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'ofertas' and public.papel_atual() in ('marketing', 'comercial'));

-- =============================================================
-- Fora do escopo desta migração, de propósito (D-059):
--   - materiais (estoque)     → permanece marketing-only
--   - perfis (gestão de equipe) → permanece marketing-only
--     (criarUsuario/atualizarPerfil/excluirUsuario via Edge
--     Function seguem exigindo papel='marketing' ativo)
-- =============================================================

-- =============================================================
-- Criar o primeiro usuário comercial (faça pelo painel Equipe,
-- logado como marketing): Equipe → Novo Usuário → Papel: Comercial
-- =============================================================
