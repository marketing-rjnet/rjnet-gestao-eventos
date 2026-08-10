-- =============================================================
-- D-098: Desafio RJNet — múltiplas tentativas por participante
-- =============================================================
-- Rode no SQL Editor do Supabase APÓS migracao-desafio-premio-ranking-fixo.sql
-- (última migração do módulo até aqui). Idempotente: pode rodar mais de
-- uma vez sem erro — inclusive já com a migração aplicada.
--
-- Depois de aplicar, rode:
--   NOTIFY pgrst, 'reload schema';
--
-- Contexto: até aqui cada `timer_challenge_entries` guardava exatamente 1
-- resultado por participante. Passa a ser possível registrar até
-- `max_attempts` tentativas (padrão 3, configurável por dia) SEM
-- recadastrar a pessoa — o operador reabre o participante já existente e
-- adiciona uma tentativa nova.
--
-- Decisão de modelagem: NÃO viram colunas `tentativa1`/`tentativa2`/
-- `tentativa3` em timer_challenge_entries (não escalaria pra outra
-- quantidade máxima nem permitiria consultar/ordenar por tentativa com
-- SQL simples) — vira uma tabela FILHA própria
-- (`timer_challenge_attempts`), 1 linha por tentativa, com FK pra
-- `timer_challenge_entries` (nunca pra `timer_challenge_events`
-- diretamente, embora `event_id` seja denormalizado na própria tentativa
-- pelo mesmo motivo de leads.evento_id/oferta_envios.evento_id: toda
-- query do módulo já é escopada por `event_id`, então evita um JOIN a
-- mais em toda leitura). `timer_challenge_entries` passa a representar só
-- o PARTICIPANTE (nome, telefone, prêmio que está concorrendo/recebeu) —
-- o resultado do cronômetro sai de lá e vira 1 linha por tentativa aqui.
--
-- "Melhor tentativa" (menor difference_centiseconds, empate resolvido
-- pela de menor attempt_number) é calculada com a MESMA regra em 2
-- lugares, de propósito — nunca uma 3ª cópia: a RPC pública abaixo (SQL)
-- e src/lib/desafioCronometro.js::melhorTentativa() (JS, usado pelas
-- telas administrativas e pelo modo local sem Supabase).
-- =============================================================

-- ─── 1. timer_challenge_events ganha max_attempts ────────────────────

alter table public.timer_challenge_events
  add column if not exists max_attempts int not null default 3;

alter table public.timer_challenge_events
  drop constraint if exists timer_challenge_events_max_attempts_check;
alter table public.timer_challenge_events
  add constraint timer_challenge_events_max_attempts_check check (max_attempts between 1 and 10);

comment on column public.timer_challenge_events.max_attempts is
  'Tentativas permitidas por participante neste dia (padrão 3, D-098). Depois desse limite o cadastro não permite mais uma tentativa.';

-- ─── 2. timer_challenge_attempts — tentativas de UM participante ─────

create table if not exists public.timer_challenge_attempts (
  id                        text primary key,
  event_id                  text not null references public.timer_challenge_events(id) on delete cascade,
  entry_id                  text not null references public.timer_challenge_entries(id) on delete cascade,
  attempt_number            int  not null,
  result_display            text not null,          -- "00:03:33" (MM:SS:CC)
  result_centiseconds       int  not null,
  target_centiseconds       int  not null,           -- snapshot do alvo no momento da tentativa
  difference_centiseconds   int  not null,           -- abs(result - target), sempre >= 0
  is_exact_hit              boolean not null default false,
  created_at                timestamptz not null default now(),
  created_by                uuid references auth.users(id) on delete set null,
  unique (entry_id, attempt_number)
);

alter table public.timer_challenge_attempts enable row level security;

drop policy if exists "timer_challenge_attempts_write" on public.timer_challenge_attempts;
create policy "timer_challenge_attempts_write" on public.timer_challenge_attempts for all to authenticated
  using (public.papel_atual() = 'marketing')
  with check (public.papel_atual() = 'marketing');

drop policy if exists "timer_challenge_attempts_select_interno" on public.timer_challenge_attempts;
create policy "timer_challenge_attempts_select_interno" on public.timer_challenge_attempts for select to authenticated
  using (public.papel_atual() = 'marketing');

-- Índices: ranking (melhor tentativa por evento) e busca por participante.
create index if not exists idx_tca_event_ranking on public.timer_challenge_attempts (event_id, difference_centiseconds, created_at);
create index if not exists idx_tca_entry on public.timer_challenge_attempts (entry_id, attempt_number);

-- ─── 3. Backfill: 1 resultado existente vira a Tentativa 1 ───────────
-- Só roda se as colunas antigas ainda existirem (idempotência — na
-- 2ª execução elas já foram removidas pelo passo 4 e este bloco vira
-- no-op).

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'timer_challenge_entries' and column_name = 'result_display'
  ) then
    execute $bf$
      insert into public.timer_challenge_attempts
        (id, event_id, entry_id, attempt_number, result_display, result_centiseconds, target_centiseconds, difference_centiseconds, is_exact_hit, created_at, created_by)
      select
        e.id || '-a1', e.event_id, e.id, 1,
        e.result_display, e.result_centiseconds, e.target_centiseconds, e.difference_centiseconds, e.is_exact_hit,
        e.created_at, e.created_by
      from public.timer_challenge_entries e
      where not exists (
        select 1 from public.timer_challenge_attempts a where a.entry_id = e.id and a.attempt_number = 1
      )
    $bf$;
  end if;
end $$;

-- ─── 4. timer_challenge_entries perde as colunas de resultado ────────
-- (já migradas pro passo 3 acima) — entries volta a representar só o
-- PARTICIPANTE: nome, telefone, prêmio, controle de entrega.

alter table public.timer_challenge_entries
  drop column if exists result_display,
  drop column if exists result_centiseconds,
  drop column if exists target_centiseconds,
  drop column if exists difference_centiseconds,
  drop column if exists is_exact_hit;

-- ─── 5. RPC pública recriada — agrega por participante, não por linha ─
-- Mesma regra de "melhor tentativa" de src/lib/desafioCronometro.js
-- (menor difference_centiseconds, empate pela de menor attempt_number).
-- Um participante = 1 linha no ranking OU nos ganhadores, nunca as duas
-- coisas nem 3 linhas por causa de 3 tentativas.

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
  select id, name, slug, target_centiseconds, max_attempts,
         prize_description, prize_image_path, prize_updated_at, prize_ranking
    into v_event
    from public.timer_challenge_events
    where slug = p_slug and active = true
    limit 1;

  if v_event.id is null then
    return jsonb_build_object('found', false);
  end if;

  -- `best`: 1 linha por participante (entry) com sua melhor tentativa
  -- (menor diferença) — reaproveitada em cada bloco abaixo.
  with best as (
    select
      e.id as entry_id, e.participant_name, e.phone, e.prize_type, e.delivered, e.created_at as entry_created_at,
      count(a.id) as attempt_count,
      min(a.difference_centiseconds) as min_difference
    from public.timer_challenge_entries e
    join public.timer_challenge_attempts a on a.entry_id = e.id
    where e.event_id = v_event.id and e.deleted = false
    group by e.id, e.participant_name, e.phone, e.prize_type, e.delivered, e.created_at
  )
  select count(*) into v_total_participants from best;

  with best as (
    select e.id as entry_id, min(a.difference_centiseconds) as min_difference
    from public.timer_challenge_entries e
    join public.timer_challenge_attempts a on a.entry_id = e.id
    where e.event_id = v_event.id and e.deleted = false
    group by e.id
  )
  select count(*) into v_total_winners from best where min_difference = 0;

  with best as (
    select e.id as entry_id, min(a.difference_centiseconds) as min_difference
    from public.timer_challenge_entries e
    join public.timer_challenge_attempts a on a.entry_id = e.id
    where e.event_id = v_event.id and e.deleted = false
    group by e.id
  )
  select min(min_difference) into v_min_difference from best where min_difference > 0;

  -- Média de TODOS os tempos registrados (toda tentativa, inclusive de
  -- ganhadores) — mesmo critério já usado no painel administrativo.
  select avg(a.result_centiseconds) into v_avg_centiseconds
    from public.timer_challenge_attempts a
    join public.timer_challenge_entries e on e.id = a.entry_id
    where e.event_id = v_event.id and e.deleted = false;

  with best as (
    select
      e.id as entry_id, e.participant_name, e.created_at as entry_created_at,
      count(a.id) as attempt_count, min(a.difference_centiseconds) as min_difference
    from public.timer_challenge_entries e
    join public.timer_challenge_attempts a on a.entry_id = e.id
    where e.event_id = v_event.id and e.deleted = false
    group by e.id, e.participant_name, e.created_at
  ),
  best_attempt as (
    select distinct on (a.entry_id) a.entry_id, a.result_display
    from public.timer_challenge_attempts a
    join public.timer_challenge_entries e on e.id = a.entry_id
    where e.event_id = v_event.id and e.deleted = false
    order by a.entry_id, a.difference_centiseconds asc, a.attempt_number asc
  )
  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_ranking
  from (
    select
      row_number() over (order by b.min_difference asc, b.entry_created_at asc)::int as position,
      b.participant_name, ba.result_display, b.min_difference as difference_centiseconds,
      b.attempt_count
    from best b
    join best_attempt ba on ba.entry_id = b.entry_id
    where b.min_difference > 0
    order by b.min_difference asc, b.entry_created_at asc
    limit 10
  ) t;

  with best as (
    select
      e.id as entry_id, e.participant_name, e.prize_type, e.delivered,
      count(a.id) as attempt_count, min(a.difference_centiseconds) as min_difference
    from public.timer_challenge_entries e
    join public.timer_challenge_attempts a on a.entry_id = e.id
    where e.event_id = v_event.id and e.deleted = false
    group by e.id, e.participant_name, e.prize_type, e.delivered
  ),
  winning_attempt as (
    select distinct on (a.entry_id) a.entry_id, a.created_at
    from public.timer_challenge_attempts a
    where a.is_exact_hit = true
    order by a.entry_id, a.attempt_number asc
  )
  select coalesce(jsonb_agg(w order by w.created_at desc), '[]'::jsonb) into v_winners
  from (
    select b.participant_name, wa.created_at, b.prize_type, b.delivered, b.attempt_count
    from best b
    join winning_attempt wa on wa.entry_id = b.entry_id
    where b.min_difference = 0
  ) w;

  return jsonb_build_object(
    'found', true,
    'event', jsonb_build_object(
      'id', v_event.id, 'name', v_event.name, 'slug', v_event.slug,
      'targetCentiseconds', v_event.target_centiseconds,
      'maxAttempts', v_event.max_attempts,
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
--   where table_name = 'timer_challenge_entries' and column_name = 'result_display';
-- (deve retornar 0 linhas)
-- select count(*) from public.timer_challenge_attempts;
-- select timer_challenge_painel_publico('sexta-feira-abc123');
