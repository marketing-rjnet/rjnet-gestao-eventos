-- =============================================================
-- D-090: Desafio RJNet — remove "número do participante"; painel
-- público de TV ganha menor diferença/média dos tempos
-- =============================================================
-- Rode no SQL Editor do Supabase APÓS migracao-desafio-cronometro.sql.
-- Idempotente: pode rodar mais de uma vez sem erro.
--
-- Depois de aplicar, rode:
--   NOTIFY pgrst, 'reload schema';
--
-- Contexto: na especificação original (D-089), "Número do participante"
-- foi implementado como um identificador numérico à parte (ex: número de
-- ficha/bilhete). O responsável esclareceu que "número" sempre se referiu
-- ao próprio telefone de contato (`phone`, já opcional) — nunca existiu a
-- intenção de um identificador numérico separado. Remove a coluna e todo
-- código que dependia dela (formulário de cadastro, ranking, ganhadores,
-- dashboard, CSV, tela de TV).
--
-- Aproveita a mesma migração pra estender a RPC pública com as duas
-- estatísticas que só existiam no painel administrativo (menor diferença,
-- média dos tempos) — agora também na tela de TV.
-- =============================================================

alter table public.timer_challenge_entries drop column if exists participant_number;

-- Recria a RPC pública: sem participant_number, com 2 estatísticas novas.
-- minDifferenceCentiseconds: só entre quem NÃO acertou exatamente (quem
-- acerta exato sempre tem diferença 0 — incluir distorceria "o quão perto
-- chegou o mais próximo sem ganhar"). averageCentiseconds: média de TODOS
-- os tempos registrados (inclui ganhadores), mesmo critério do painel
-- administrativo (DesafioDashboard.jsx).
create or replace function public.timer_challenge_painel_publico(p_slug text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_event   record;
  v_ranking jsonb;
  v_winners jsonb;
  v_total_participants bigint;
  v_total_winners      bigint;
  v_min_difference     int;
  v_avg_centiseconds   numeric;
begin
  select id, name, slug, target_centiseconds
    into v_event
    from public.timer_challenge_events
    where slug = p_slug and active = true
    limit 1;

  if v_event.id is null then
    return jsonb_build_object('found', false);
  end if;

  select count(*), avg(result_centiseconds) into v_total_participants, v_avg_centiseconds
    from public.timer_challenge_entries
    where event_id = v_event.id and deleted = false;

  select count(*) into v_total_winners
    from public.timer_challenge_entries
    where event_id = v_event.id and deleted = false and is_exact_hit = true;

  select min(difference_centiseconds) into v_min_difference
    from public.timer_challenge_entries
    where event_id = v_event.id and deleted = false and is_exact_hit = false;

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_ranking
  from (
    select
      row_number() over (order by difference_centiseconds asc, created_at asc)::int as position,
      participant_name, result_display, difference_centiseconds
    from public.timer_challenge_entries
    where event_id = v_event.id and deleted = false and is_exact_hit = false
    order by difference_centiseconds asc, created_at asc
    limit 10
  ) t;

  select coalesce(jsonb_agg(w order by w.created_at desc), '[]'::jsonb) into v_winners
  from (
    select participant_name, created_at, prize_type, delivered
    from public.timer_challenge_entries
    where event_id = v_event.id and deleted = false and is_exact_hit = true
  ) w;

  return jsonb_build_object(
    'found', true,
    'event', jsonb_build_object(
      'id', v_event.id, 'name', v_event.name, 'slug', v_event.slug,
      'targetCentiseconds', v_event.target_centiseconds
    ),
    'stats', jsonb_build_object(
      'totalParticipants', v_total_participants,
      'totalWinners', v_total_winners,
      'minDifferenceCentiseconds', v_min_difference,
      'averageCentiseconds', case when v_avg_centiseconds is null then null else round(v_avg_centiseconds) end
    ),
    'ranking', v_ranking,
    'winners', v_winners
  );
end;
$$;

revoke all on function public.timer_challenge_painel_publico(text) from public, authenticated;
grant execute on function public.timer_challenge_painel_publico(text) to anon, authenticated;

-- =============================================================
-- Verificação
-- =============================================================
-- select column_name from information_schema.columns
--   where table_name = 'timer_challenge_entries' and column_name = 'participant_number';
-- (deve retornar 0 linhas)
-- select timer_challenge_painel_publico('sexta-feira-abc123');
