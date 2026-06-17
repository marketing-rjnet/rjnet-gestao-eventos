-- =============================================================
-- RJNET — PA-04/LGPD: Consentimento do titular para captação de leads
-- =============================================================
-- Rode no SQL Editor do Supabase APÓS migracao-auth.sql.
-- Idempotente: pode rodar mais de uma vez sem erro.
--
-- O que faz:
--   1. Adiciona 3 colunas à tabela `leads`:
--      - consentimento_coletado: bool — titular confirmou consentimento
--      - consentimento_em:       timestamptz — quando foi registrado
--      - versao_termo:           text — versão da política de privacidade
--
-- Base legal documentada: consentimento do titular (art. 7º, I, LGPD)
-- Controlador: RJNet Telecomunicações
-- Finalidade: contato comercial para apresentação de serviços
-- =============================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS consentimento_coletado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consentimento_em       timestamptz,
  ADD COLUMN IF NOT EXISTS versao_termo           text;

-- Índice para consultas de auditoria (ex: leads sem consentimento)
CREATE INDEX IF NOT EXISTS idx_leads_consentimento
  ON public.leads (consentimento_coletado);

-- =============================================================
-- Verificação
-- =============================================================
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'leads'
  AND column_name  IN ('consentimento_coletado', 'consentimento_em', 'versao_termo')
ORDER BY column_name;
-- Esperado: 3 linhas
