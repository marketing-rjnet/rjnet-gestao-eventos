-- =============================================================
-- D-099: Desafio RJNet — campo "Já é cliente RJNET?" no cadastro
-- =============================================================
-- Rode no SQL Editor do Supabase APÓS migracao-desafio-tentativas.sql.
-- Idempotente: pode rodar mais de uma vez sem erro.
--
-- Depois de aplicar, rode:
--   NOTIFY pgrst, 'reload schema';
--
-- Contexto: mesmo campo `jaClienteRjnet`/`ja_cliente_rjnet` já usado no
-- cadastro de lead do vendedor (`VendedorApp.jsx`) e no cadastro público
-- do Quiz de Acertos do Simulador (D-097) — reaproveitado aqui pro
-- cadastro de participante do Desafio, sem inventar um campo novo de
-- nome diferente. Puramente informativo pro marketing (CRM interno);
-- não afeta ranking, tentativas nem a RPC pública (não exposto na Tela
-- de TV — mesmo critério de `phone`, que também não é lido pela RPC).
-- =============================================================

alter table public.timer_challenge_entries
  add column if not exists ja_cliente_rjnet boolean not null default false;

comment on column public.timer_challenge_entries.ja_cliente_rjnet is
  'Se o participante já é cliente RJNET — mesmo campo/semântica de leads.ja_cliente_rjnet (D-099). Só uso interno (CRM/CSV), nunca exposto na RPC pública da Tela de TV.';

-- =============================================================
-- Verificação
-- =============================================================
-- select column_name from information_schema.columns
--   where table_name = 'timer_challenge_entries' and column_name = 'ja_cliente_rjnet';
