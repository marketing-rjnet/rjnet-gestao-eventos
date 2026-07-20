-- =============================================================
-- Simulador: Quiz de Acertos (D-080) — 3º tipo de campanha
-- =============================================================
-- Rode no SQL Editor do Supabase APÓS migracao-simulador-tipos.sql.
-- Idempotente: pode rodar mais de uma vez sem erro.
--
-- Depois de aplicar, rode (mesmo gotcha das migrações anteriores do
-- Simulador):
--   NOTIFY pgrst, 'reload schema';
--
-- Decisão de arquitetura (D-080): 3º tipo de campanha do Simulador, ao
-- lado de 'oferta' (pacote deduzido) e 'demanda' (pontuação ponderada por
-- percentual) — nunca encadeado com os outros dois na mesma sessão
-- (mesmo princípio do D-076). 'quiz' é um teste de CONHECIMENTO com
-- resposta certa/errada por pergunta (não uma pergunta de intenção/perfil)
-- — pontuação = contagem de acertos, e o marketing define faixas de
-- classificação (min/max de acertos → emoji + título) totalmente
-- editáveis, sem número fixo de perguntas nem de faixas. Primeiro uso
-- real: evento MotoFest (universo de motoclube) — ver
-- quizPerguntasPadrao()/quizFaixasPadrao() em src/lib/simulador.js para o
-- molde de exemplo (editável, não um catálogo fixo).
--
-- Reaproveita leads.perfil_consumo/pontuacao/temperatura/simulador_id (já
-- existentes desde migracao-simulador.sql, D-072) — SEM coluna nova em
-- `leads`. `pontuacao` passa a guardar a CONTAGEM DE ACERTOS quando a
-- campanha é do tipo 'quiz' (em vez do score ponderado de 'demanda');
-- `perfil_consumo.tipo = 'quiz'` é o discriminador usado por
-- resumoPerfil() (src/lib/simulador.js) pra saber como renderizar o
-- snapshot. O Sorteador (gestão, SimuladorTab.jsx) também não precisa de
-- coluna nova — sorteia direto entre leads com o mesmo `simulador_id`.

-- ─── 1. Novo valor de tipo aceito ──────────────────────────────
alter table public.simuladores drop constraint if exists simuladores_tipo_check;
alter table public.simuladores add constraint simuladores_tipo_check
  check (tipo in ('oferta', 'demanda', 'quiz'));

-- ─── 2. Config da campanha 'quiz' (perguntas com resposta certa + faixas
-- de classificação por contagem de acertos) — ambas nullable: só usadas
-- quando tipo='quiz', igual `perguntas`/`mensagem_resultado` em 'demanda'.

alter table public.simuladores
  add column if not exists quiz_perguntas jsonb,
  add column if not exists quiz_faixas    jsonb;

-- =============================================================
-- Verificação
-- =============================================================
-- select id, nome, tipo,
--        jsonb_array_length(coalesce(quiz_perguntas, '[]'::jsonb)) as total_perguntas,
--        jsonb_array_length(coalesce(quiz_faixas, '[]'::jsonb))    as total_faixas
-- from simuladores where tipo = 'quiz';
