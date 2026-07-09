-- =============================================================
-- Simulador: perguntas configuráveis por campanha (D-075)
-- =============================================================
-- Rode no SQL Editor do Supabase APÓS migracao-simulador.sql.
-- Idempotente: pode rodar mais de uma vez sem erro.
--
-- Depois de aplicar, rode: NOTIFY pgrst, 'reload schema';
--
-- Decisão de arquitetura (D-075): até aqui (D-072) o questionário do
-- Simulador era um catálogo FIXO em código, igual ao Form Builder. A
-- partir daqui, campanhas do tipo 'perfil_consumo' passam a ter seu
-- PRÓPRIO questionário, criado e editado pelo marketing na tela de
-- gestão — cada pergunta com peso (pontos) por opção, definido por quem
-- cria a campanha. A pergunta de "perfil de uso" que decide o PACOTE fixo
-- (D-074) continua separada e fora deste mecanismo — só as perguntas de
-- intenção (que alimentam pontuação/temperatura) viram configuráveis.
--
-- O score continua sendo RECALCULADO NO SERVIDOR (Edge Function
-- submeter-simulador) a partir da própria configuração gravada em
-- `simuladores.perguntas` — o cliente nunca envia peso nem perguntas,
-- só respostas (ids de pergunta/opção). Campanhas sem `perguntas`
-- configurada (criadas antes desta migração) caem num modelo padrão
-- (mesmo catálogo/pesos que existiam fixos em código antes) — sem quebrar
-- nada que já estava no ar.

alter table public.simuladores
  add column if not exists perguntas jsonb;

-- =============================================================
-- Verificação
-- =============================================================
-- select id, nome, jsonb_array_length(coalesce(perguntas, '[]'::jsonb)) as total_perguntas from simuladores;
