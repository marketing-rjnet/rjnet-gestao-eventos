-- PA-08b/LGPD: Reintrodução do CPF com finalidade declarada (BD-02, L-03)
-- CPF é opcional e coletado exclusivamente para agendamento de visita técnica
-- e análise cadastral na conversão do lead em contrato.
-- Check-in permanece por nome (sem uso do CPF).
-- Idempotente: seguro executar múltiplas vezes.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS cpf text;
