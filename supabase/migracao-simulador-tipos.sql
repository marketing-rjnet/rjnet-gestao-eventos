-- =============================================================
-- Simulador: 2 fluxos separados (Oferta / Demanda), Territorial removido (D-076)
-- =============================================================
-- Rode no SQL Editor do Supabase APÓS migracao-simulador-perguntas.sql.
-- Idempotente: pode rodar mais de uma vez sem erro.
--
-- Depois de aplicar, rode: NOTIFY pgrst, 'reload schema';
--
-- Decisão de arquitetura (D-076): até aqui (D-072/D-074/D-075) uma
-- campanha do tipo 'perfil_consumo' encadeava DUAS coisas na mesma sessão
-- pública — a pergunta fixa de perfil de uso (decide o pacote, D-074) E as
-- perguntas de intenção configuráveis (decidem pontuação/temperatura,
-- D-075). Isso confundia o fluxo (a pessoa via "Pergunta 1" no construtor,
-- mas ela aparecia como a 2ª tela do quiz, depois do perfil). A partir
-- daqui, viram 2 tipos de campanha independentes, nunca mais encadeados:
--   'oferta'  → só perfil de uso → pacote fixo + combo de upsell
--   'demanda' → só perguntas configuráveis → mensagem de resultado
--               personalizada pela campanha (novo campo mensagem_resultado)
-- 'territorial' (D-073, cidade/bairro/interesse sem quiz) foi removido —
-- não dá mais pra criar campanha desse tipo; linhas existentes (se houver)
-- são desativadas abaixo, não apagadas (lead histórico já capturado
-- continua intacto, só não recebe novo lead).

-- ─── 1. Derruba a constraint ANTES de migrar dados — a constraint antiga
-- só aceita 'perfil_consumo'/'territorial'; escrever 'oferta' com ela
-- ainda ativa falha (23514) ───
alter table public.simuladores drop constraint if exists simuladores_tipo_check;

-- ─── 2. Migra dados existentes ─────────────────────────────────
update public.simuladores set ativo = false where tipo = 'territorial';
update public.simuladores set tipo = 'oferta' where tipo = 'perfil_consumo';

-- ─── 3. Recria a constraint com os novos valores ───────────────
alter table public.simuladores alter column tipo set default 'oferta';
alter table public.simuladores add constraint simuladores_tipo_check
  check (tipo in ('oferta', 'demanda'));

-- ─── 4. Mensagem de resultado (só usada por tipo='demanda') ───
alter table public.simuladores
  add column if not exists mensagem_resultado text;

-- =============================================================
-- Verificação
-- =============================================================
-- select id, nome, tipo, ativo, mensagem_resultado from simuladores;
