-- =============================================================
-- D-092: Desafio RJNet — prêmio por POSIÇÃO do ranking (1º ao 10º)
-- =============================================================
-- Rode no SQL Editor do Supabase APÓS migracao-desafio-premio.sql.
-- Idempotente: pode rodar mais de uma vez sem erro.
--
-- Depois de aplicar, rode:
--   NOTIFY pgrst, 'reload schema';
--
-- Contexto: além do prêmio geral do dia (D-091, mantido sem alteração),
-- o marketing quer definir um prêmio DIFERENTE por posição do ranking
-- Top 10 (1º lugar ganha X, 2º ganha Y, ...), visível como uma coluna a
-- mais na própria tabela do ranking da Tela de TV — os participantes
-- acompanham em tempo real qual prêmio está em jogo na posição deles
-- conforme o ranking muda. Como a maioria dos prêmios são apps de
-- streaming, cada posição leva um ícone pequeno + nome, não uma foto
-- grande (diferente do prêmio geral do dia, que é uma imagem maior).
-- =============================================================

alter table public.timer_challenge_events
  add column if not exists prize_ranking jsonb not null default '[]'::jsonb;

comment on column public.timer_challenge_events.prize_ranking is
  'Array de até 10 posições: [{"position":1,"name":"Disney+","iconPath":"<event_id>-rank1.png"}, ...]. Ícones no bucket desafio-premios (D-091).';

-- ─── RPC pública: recriada para incluir os prêmios por posição ─────────
-- Mesma regra do D-089/D-090/D-091: a tela de TV nunca lê a tabela
-- direto, só via esta RPC. `prize_ranking` é devolvido cru (path dos
-- ícones) — a URL pública de cada ícone é montada no cliente, mesmo
-- padrão do prêmio geral do dia.
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
  select id, name, slug, target_centiseconds, prize_description, prize_image_path, prize_updated_at, prize_ranking
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
      'targetCentiseconds', v_event.target_centiseconds,
      'prizeDescription', v_event.prize_description,
      'prizeImagePath', v_event.prize_image_path,
      'prizeUpdatedAt', v_event.prize_updated_at,
      'prizeRanking', coalesce(v_event.prize_ranking, '[]'::jsonb)
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
--   where table_name = 'timer_challenge_events' and column_name = 'prize_ranking';
-- select timer_challenge_painel_publico('sexta-feira-abc123');
