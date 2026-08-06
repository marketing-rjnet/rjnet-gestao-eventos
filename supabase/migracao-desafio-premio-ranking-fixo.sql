-- =============================================================
-- D-093: Desafio RJNet — prêmios do ranking viram catálogo FIXO
-- de 3 opções (RJNET Móvel/HBO Max/Disney+), sem imagem
-- =============================================================
-- Rode no SQL Editor do Supabase APÓS migracao-desafio-premio-ranking.sql.
-- Idempotente: pode rodar mais de uma vez sem erro.
--
-- Depois de aplicar, rode:
--   NOTIFY pgrst, 'reload schema';
--
-- Contexto: o D-092 (prêmio por posição do ranking, com ícone opcional)
-- foi lançado e, na sequência, o responsável mudou o desenho — em vez de
-- texto livre + imagem por posição, cada posição escolhe uma de 3 opções
-- fixas (RJNET Móvel/HBO Max/Disney+), só texto, sem upload de imagem.
-- Não muda o TIPO da coluna (`prize_ranking` continua jsonb, mesmo shape
-- de array por posição) — só o CONTEÚDO aceito, que passa a ser validado
-- no cliente (`PREMIOS_POSICAO_RANKING` em desafioCronometro.js), não no
-- banco. Esta migração só limpa a chave `iconPath` de linhas gravadas
-- durante a janela curta em que o D-092 esteve no ar (nenhum ícone real
-- de produção existia ainda).
-- =============================================================

update public.timer_challenge_events
set prize_ranking = (
  select coalesce(jsonb_agg(jsonb_build_object('position', elem->'position', 'name', elem->'name')), '[]'::jsonb)
  from jsonb_array_elements(prize_ranking) as elem
)
where prize_ranking is not null and prize_ranking != '[]'::jsonb;

comment on column public.timer_challenge_events.prize_ranking is
  'Array de até 10 posições: [{"position":1,"name":"HBO Max"}, ...]. D-093: "name" é uma das 3 opções fixas (RJNET Móvel/HBO Max/Disney+) ou "" (sem prêmio) — sem imagem, validado no cliente (PREMIOS_POSICAO_RANKING).';

-- Nota: os ícones eventualmente enviados durante a janela do D-092 ficam
-- órfãos no bucket `desafio-premios` (paths `<event_id>-rank<position>.*`)
-- — sem risco (bucket público sem dado sensível), remoção é opcional e
-- manual pelo painel do Supabase Storage, se quiser.

-- =============================================================
-- Verificação
-- =============================================================
-- select id, prize_ranking from public.timer_challenge_events where prize_ranking != '[]'::jsonb;
-- (nenhum elemento deve ter a chave "iconPath")
