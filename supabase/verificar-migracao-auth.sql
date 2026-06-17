-- =============================================================
-- RJNET — Verificação de estado das migrações de Auth
-- =============================================================
-- PA-02: Confirmar que migracao-auth.sql e protecao-dados.sql
--        estão aplicados em produção.
--
-- Como usar:
--   Supabase Dashboard → SQL Editor → cole e execute cada bloco
--   Interprete os resultados conforme os comentários.
--
-- Resultado ESPERADO em produção (migração aplicada):
--   ✅ Políticas anônimas: 0 linhas
--   ✅ Tabela perfis: true
--   ✅ Coluna deletado: 1 linha
--   ✅ Coluna vendedor_id: 1 linha
--   ✅ Função papel_atual: 1 linha
--   ✅ Função ranking_evento: 1 linha
--   ✅ Políticas por papel: ≥ 8 linhas (marketing/vendedor)
-- =============================================================

-- ─── BLOCO 1: Políticas anônimas (esperado: 0 linhas) ────────
-- Se retornar linhas, migracao-auth.sql NÃO foi aplicado.
-- Risco: qualquer pessoa com a anon key acessa todos os dados.
SELECT
  tablename,
  policyname,
  roles::text AS papeis
FROM pg_policies
WHERE schemaname = 'public'
  AND roles @> ARRAY['anon'::name];

-- ─── BLOCO 2: Tabela perfis (esperado: true) ─────────────────
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'perfis'
) AS perfis_existe;

-- ─── BLOCO 3: Coluna deletado em leads (esperado: 1 linha) ───
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'leads'
  AND column_name = 'deletado';

-- ─── BLOCO 4: Coluna vendedor_id em leads (esperado: 1 linha) ─
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'leads'
  AND column_name = 'vendedor_id';

-- ─── BLOCO 5: Função papel_atual (esperado: 1 linha) ─────────
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'papel_atual';

-- ─── BLOCO 6: Função ranking_evento (esperado: 1 linha) ──────
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'ranking_evento';

-- ─── BLOCO 7: Policies por papel (esperado: ≥ 8 linhas) ──────
-- Mostra todas as policies ativas — devem ser `to authenticated`
SELECT
  tablename,
  policyname,
  cmd,
  roles::text AS papeis
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ─── BLOCO 8: Resumo de leads (sanidade geral) ───────────────
SELECT
  count(*) AS total_leads,
  count(*) FILTER (WHERE deletado = true)  AS deletados,
  count(*) FILTER (WHERE deletado = false) AS ativos,
  count(*) FILTER (WHERE vendedor_id IS NOT NULL) AS com_vendedor_id
FROM public.leads;

-- =============================================================
-- O QUE FAZER SE ALGUMA VERIFICAÇÃO FALHAR:
--
-- 1. Bloco 1 retornou linhas (políticas anônimas ativas):
--    → Execute supabase/migracao-auth.sql no SQL Editor
--    → Execute supabase/protecao-dados.sql no SQL Editor
--    → Reexecute este script para confirmar
--
-- 2. Bloco 2 retornou false (perfis não existe):
--    → Execute supabase/migracao-auth.sql
--
-- 3. Bloco 3 retornou vazio (deletado não existe):
--    → Execute supabase/protecao-dados.sql
--
-- 4. Bloco 4 retornou vazio (vendedor_id não existe):
--    → Execute supabase/migracao-auth.sql
--
-- Após corrigir, registre o resultado em:
--   doc/PLANO_DE_ACAO_LGPD.md → PA-02 → Evidência de conclusão
-- =============================================================
