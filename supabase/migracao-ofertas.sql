-- D-057: Área de Ofertas — imagem + copy prontas por serviço, para o vendedor
-- disparar manualmente via WhatsApp (wa.me) ao lead. Marketing gerencia o
-- conteúdo; vendedor só consome. Idempotente: seguro executar múltiplas vezes.

-- ─── ofertas: 1 linha ativa por serviço (servico é a própria chave) ────

CREATE TABLE IF NOT EXISTS public.ofertas (
  servico       text        PRIMARY KEY CHECK (servico IN (
                  'internet_residencial', 'internet_empresarial',
                  'rjnet_movel', 'streamings', 'outro'
                )),
  copy          text        NOT NULL DEFAULT '',
  imagem_path   text,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ofertas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ofertas_select" ON public.ofertas;
CREATE POLICY "ofertas_select" ON public.ofertas FOR SELECT TO authenticated
  USING (public.papel_atual() IS NOT NULL);

DROP POLICY IF EXISTS "ofertas_write" ON public.ofertas;
CREATE POLICY "ofertas_write" ON public.ofertas FOR ALL TO authenticated
  USING (public.papel_atual() = 'marketing')
  WITH CHECK (public.papel_atual() = 'marketing');

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ofertas;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── oferta_envios: indicador de clique (NÃO é confirmação de entrega — ──
-- wa.me não expõe status de envio/leitura ao sistema) ────────────────────

CREATE TABLE IF NOT EXISTS public.oferta_envios (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       text        REFERENCES public.leads(id) ON DELETE CASCADE,
  evento_id     text        REFERENCES public.eventos(id) ON DELETE CASCADE,
  servico       text        NOT NULL,
  vendedor_id   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  vendedor_nome text,
  enviado_em    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oferta_envios_evento ON public.oferta_envios (evento_id);

ALTER TABLE public.oferta_envios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "oferta_envios_select" ON public.oferta_envios;
CREATE POLICY "oferta_envios_select" ON public.oferta_envios FOR SELECT TO authenticated
  USING (public.papel_atual() IN ('marketing', 'vendedor'));

DROP POLICY IF EXISTS "oferta_envios_insert" ON public.oferta_envios;
CREATE POLICY "oferta_envios_insert" ON public.oferta_envios FOR INSERT TO authenticated
  WITH CHECK (
    public.papel_atual() = 'marketing'
    OR (public.papel_atual() = 'vendedor' AND vendedor_id = auth.uid())
  );

-- ─── Storage: bucket público para as imagens das ofertas ───────────────
-- Público por decisão consciente (D-057): são materiais promocionais sem
-- dado pessoal de titular — evita a complexidade de signed URLs.

INSERT INTO storage.buckets (id, name, public)
VALUES ('ofertas', 'ofertas', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "ofertas_bucket_write" ON storage.objects;
CREATE POLICY "ofertas_bucket_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ofertas' AND public.papel_atual() = 'marketing');

DROP POLICY IF EXISTS "ofertas_bucket_update" ON storage.objects;
CREATE POLICY "ofertas_bucket_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ofertas' AND public.papel_atual() = 'marketing');

DROP POLICY IF EXISTS "ofertas_bucket_delete" ON storage.objects;
CREATE POLICY "ofertas_bucket_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ofertas' AND public.papel_atual() = 'marketing');
