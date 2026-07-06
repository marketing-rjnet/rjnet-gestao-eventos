-- =============================================================
-- QR Code: colunas de atribuição do Lead + visibilidade por RLS
-- =============================================================
-- Rode no SQL Editor do Supabase APÓS migracao-comercial.sql.
-- Idempotente: pode rodar mais de uma vez sem erro.
--
-- O que faz:
--   1. Adiciona 3 colunas a `leads`: origem, qr_code_id, qr_code_label
--      — atributos de proveniência, nunca um novo "contexto operacional"
--      (evento_id/mes_referencia continuam sendo a única fonte de
--      contexto ao vivo do vendedor).
--   2. Relaxa a constraint leads_evento_xor_mes de "= 1" para "<= 1":
--      um lead de QR Code (sem evento nem mês) passa a ser válido.
--   3. Ajusta a policy de LEITURA (leads_select): o papel vendedor só
--      enxerga leads que já têm vendedor_id preenchido. Isso não afeta
--      nenhum lead existente hoje (100% deles já nascem com vendedor_id
--      definido) — só passa a valer para o estado novo introduzido pelo
--      QR Code: lead sem responsável, visível apenas a marketing/comercial
--      até a distribuição manual.
--
-- Depois de aplicar, rode:
--   NOTIFY pgrst, 'reload schema';
-- (ou Dashboard → Settings → API → Reload schema)
-- =============================================================

-- ─── 1. Colunas de atribuição em leads ────────────────────────

alter table public.leads
  add column if not exists origem         text,
  add column if not exists qr_code_id     text,
  add column if not exists qr_code_label  text;

create index if not exists idx_leads_origem on public.leads (origem);
-- índice parcial: acelera a fila de distribuição (leads sem responsável)
create index if not exists idx_leads_sem_vendedor on public.leads (origem) where vendedor_id is null;

-- ─── 2. Relaxa a exclusividade evento/mês ─────────────────────
-- Um lead de QR Code "avulso" (sem evento nem mês por trás) não tem
-- nenhum dos dois — só evento_id OU mes_referencia continuam sendo
-- mutuamente exclusivos ENTRE SI quando presentes.

alter table public.leads drop constraint if exists leads_evento_xor_mes;
alter table public.leads
  add constraint leads_evento_xor_mes check (num_nonnulls(evento_id, mes_referencia) <= 1);

-- ─── 3. RLS: vendedor só lê leads já atribuídos ────────────────
-- marketing/comercial continuam com leitura total (fila de distribuição
-- inclui os leads com vendedor_id nulo). vendedor só vê o que já tem
-- responsável — igual hoje para todo lead de Evento/Mês (sempre nasce
-- com vendedor_id preenchido), e agora também para QR Code após a
-- distribuição.

drop policy if exists "leads_select" on public.leads;
create policy "leads_select" on public.leads for select to authenticated
  using (
    deletado = false
    and (
      public.papel_atual() in ('marketing', 'comercial')
      or (public.papel_atual() = 'vendedor' and vendedor_id is not null)
    )
  );

-- =============================================================
-- Verificação
-- =============================================================
-- select column_name, data_type from information_schema.columns
--   where table_name = 'leads' and column_name in ('origem','qr_code_id','qr_code_label');
-- select conname from pg_constraint where conname = 'leads_evento_xor_mes';
