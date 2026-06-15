-- =============================================================
-- RJNET — Proteção de dados: soft delete em leads
-- =============================================================
-- Rode no SQL Editor do Supabase.
--
-- O que faz:
--   1. Adiciona coluna `deletado` nos leads (soft delete)
--   2. Atualiza RLS: vendedor não pode mais deletar leads
--      (apenas marketing pode; e mesmo assim vira soft delete)
--   3. Todas as leituras filtram deletado = false automaticamente
-- =============================================================

-- ─── 1. Coluna soft delete ────────────────────────────────────
alter table public.leads
  add column if not exists deletado boolean not null default false;

create index if not exists idx_leads_deletado on public.leads (deletado);

-- ─── 2. Atualiza políticas de leads ──────────────────────────

-- Leitura: ninguém vê leads deletados
drop policy if exists "leads_select" on public.leads;
create policy "leads_select" on public.leads for select to authenticated
  using (
    deletado = false
    and public.papel_atual() in ('marketing', 'vendedor')
  );

-- Insert: inalterado
drop policy if exists "leads_insert" on public.leads;
create policy "leads_insert" on public.leads for insert to authenticated
  with check (
    public.papel_atual() = 'marketing'
    or (public.papel_atual() = 'vendedor' and vendedor_id = auth.uid())
  );

-- Update: vendedor edita os próprios; marketing edita todos
-- (soft delete é feito via update deletado=true pelo marketing)
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

-- Delete físico: apenas marketing (emergência)
drop policy if exists "leads_delete" on public.leads;
create policy "leads_delete" on public.leads for delete to authenticated
  using (public.papel_atual() = 'marketing');

-- =============================================================
-- Verificação
-- =============================================================
select count(*) as total_leads,
       count(*) filter (where deletado = true) as deletados
from public.leads;
