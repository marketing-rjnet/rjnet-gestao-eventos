-- PA-07/LGPD: Rastreabilidade do soft delete de leads (BD-06, A-03)
-- Adiciona quem excluiu e quando ao soft delete existente.
-- Idempotente: seguro executar múltiplas vezes.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS deletado_em  timestamptz,
  ADD COLUMN IF NOT EXISTS deletado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Índice para consultas de auditoria por responsável pela exclusão
CREATE INDEX IF NOT EXISTS idx_leads_deletado_por ON public.leads (deletado_por) WHERE deletado = true;
CREATE INDEX IF NOT EXISTS idx_leads_deletado_em  ON public.leads (deletado_em  DESC) WHERE deletado = true;
