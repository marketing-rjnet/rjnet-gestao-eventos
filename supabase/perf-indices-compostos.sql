-- =============================================================
-- QW-002 / PA-007: Índices compostos para queries críticas
-- =============================================================
-- Problema: índices simples em evento_id e deletado existem,
-- mas a query mais frequente combina os dois campos.
--
-- As queries beneficiadas:
--   1. fetchAll: WHERE deletado = false ORDER BY criado_em
--   2. ranking_evento: WHERE evento_id = $1 AND deletado = false
--   3. Filtros na LeadsTab: WHERE evento_id = $1 AND deletado = false
--
-- Como aplicar: Supabase Dashboard → SQL Editor → Run.
-- Idempotente (IF NOT EXISTS). Não altera dados nem comportamento.
--
-- Nota: a criação de índice em produção com dados pode ser lenta
-- (CONCURRENTLY não é suportado em transações). Execute em horário
-- de baixo tráfego se o banco já tiver volume grande.
-- =============================================================

-- Índice composto: suporta queries que filtram por evento E deletado
-- Ex: WHERE evento_id = $1 AND deletado = false
create index if not exists idx_leads_evento_deletado
  on public.leads (evento_id, deletado);

-- Índice parcial: somente leads ativos (deletado = false)
-- Menor que o índice completo; mais eficiente para leituras típicas
-- Ex: WHERE deletado = false ORDER BY criado_em
create index if not exists idx_leads_ativos_criado_em
  on public.leads (criado_em)
  where deletado = false;

-- Índice composto para queries de ranking otimizado:
-- WHERE evento_id = $1 AND deletado = false
-- Inclui vendedor_nome para cobrir o GROUP BY sem heap access
create index if not exists idx_leads_ranking
  on public.leads (evento_id, deletado, vendedor_nome)
  where deletado = false;

-- Verificação: confirma que os índices foram criados
select indexname, indexdef
from pg_indexes
where tablename = 'leads'
  and schemaname = 'public'
order by indexname;
