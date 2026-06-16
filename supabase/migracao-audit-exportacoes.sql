-- PA-06/LGPD: Log de exportações CSV de dados pessoais (A-01, L-08)
-- Tabela de auditoria para rastrear quem exportou leads, quando e com quais filtros.
-- Idempotente: seguro executar múltiplas vezes.

CREATE TABLE IF NOT EXISTS public.audit_exportacoes (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_nome     text,
  usuario_email    text,
  acao             text        NOT NULL DEFAULT 'export_csv_leads',
  filtros          jsonb,
  total_registros  integer,
  exportado_em     timestamptz NOT NULL DEFAULT now()
);

-- RLS: apenas usuários autenticados com papel 'marketing' podem inserir e consultar
ALTER TABLE public.audit_exportacoes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'audit_exportacoes'
      AND policyname = 'audit_export_insert'
  ) THEN
    CREATE POLICY "audit_export_insert" ON public.audit_exportacoes
      FOR INSERT TO authenticated
      WITH CHECK (public.papel_atual() = 'marketing');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'audit_exportacoes'
      AND policyname = 'audit_export_select'
  ) THEN
    CREATE POLICY "audit_export_select" ON public.audit_exportacoes
      FOR SELECT TO authenticated
      USING (public.papel_atual() = 'marketing');
  END IF;
END $$;

-- Índice para consultas por usuário e por data (relatórios de auditoria)
CREATE INDEX IF NOT EXISTS idx_audit_exportacoes_usuario ON public.audit_exportacoes (usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_exportacoes_em     ON public.audit_exportacoes (exportado_em DESC);
