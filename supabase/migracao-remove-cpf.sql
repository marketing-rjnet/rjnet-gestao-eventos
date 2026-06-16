-- PA-08/LGPD: Remoção do CPF da tabela leads (BD-02, L-03)
-- Minimização de dados: CPF não é mais coletado nem armazenado.
-- Check-in migrado para busca por nome dentro do evento.
-- Idempotente: seguro executar múltiplas vezes.

ALTER TABLE public.leads
  DROP COLUMN IF EXISTS cpf;
