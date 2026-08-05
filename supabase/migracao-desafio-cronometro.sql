-- =============================================================
-- D-089: Desafio RJNet — Acerte 00:03:33 (cronômetro de ativação)
-- =============================================================
-- Rode no SQL Editor do Supabase a qualquer momento (não depende de
-- nenhuma migração anterior específica, só de `public.papel_atual()`,
-- criada em migracao-auth.sql). Idempotente: pode rodar mais de uma vez
-- sem erro.
--
-- Depois de aplicar, rode:
--   NOTIFY pgrst, 'reload schema';
-- (ou Dashboard → Settings → API → Reload schema)
--
-- Decisão de arquitetura: módulo de ativação de evento, independente dos
-- domínios existentes (eventos/leads) — não é um Lead, não compete pela
-- fila de distribuição. Suporta MÚLTIPLOS dias/edições do desafio
-- (`timer_challenge_events`, ex: "Sexta-feira"/"Sábado"), cada um com
-- ranking/participantes/estatísticas/ganhadores 100% independentes
-- (nunca cruzados — todo filtro é por `event_id`). O tempo-alvo é
-- configurável por dia (`target_centiseconds`, default 333 = 00:03:33),
-- então o mesmo código serve qualquer desafio futuro sem alteração.
--
-- Nomenclatura em inglês (tabelas/colunas) é uma EXCEÇÃO deliberada ao
-- padrão português do restante do schema — mantém a nomenclatura exata
-- pedida na especificação do módulo (`timer_challenge_entries` e seus
-- campos), e o "evento" pai (`timer_challenge_events`) segue o mesmo
-- idioma por coesão dentro do módulo.
--
-- Acesso (mesmo padrão marketing-only de Estoque/Equipe — D-053/D-059):
-- gestão (CRUD de dias + participantes + controle de prêmio) é EXCLUSIVA
-- do papel 'marketing', igual à Área de Estoque. A leitura interna
-- (dashboard) também é marketing-only. A ÚNICA leitura pública é via RPC
-- `timer_challenge_painel_publico`, que devolve só o necessário pra tela
-- de TV (ranking Top 10, ganhadores, estatísticas agregadas) — nunca
-- telefone, nunca a tabela crua.
-- =============================================================

-- ─── 1. timer_challenge_events — um dia/edição do desafio ────────────

create table if not exists public.timer_challenge_events (
  id                   text primary key,
  name                 text not null,              -- "Sexta-feira", "Sábado"
  slug                 text not null unique,        -- /tv/<slug>
  target_centiseconds  int  not null default 333,   -- tempo-alvo, ex: 333 = 00:03:33
  active               boolean not null default true,
  created_at           timestamptz not null default now(),
  created_by           uuid references auth.users(id) on delete set null
);

alter table public.timer_challenge_events enable row level security;

drop policy if exists "timer_challenge_events_write" on public.timer_challenge_events;
create policy "timer_challenge_events_write" on public.timer_challenge_events for all to authenticated
  using (public.papel_atual() = 'marketing')
  with check (public.papel_atual() = 'marketing');

drop policy if exists "timer_challenge_events_select_interno" on public.timer_challenge_events;
create policy "timer_challenge_events_select_interno" on public.timer_challenge_events for select to authenticated
  using (public.papel_atual() = 'marketing');

-- Sem policy `anon` aqui de propósito — a tela de TV nunca lê esta tabela
-- direto, só através da RPC abaixo (evita expor qualquer coisa a mais que
-- nome/slug/meta do dia no futuro, sem precisar manter 2 pontos de leitura
-- pública em sincronia).

-- ─── 2. timer_challenge_entries — participações de um dia ────────────

create table if not exists public.timer_challenge_entries (
  id                        text primary key,
  event_id                  text not null references public.timer_challenge_events(id) on delete cascade,
  participant_number        text not null,
  participant_name          text not null,
  phone                     text,                   -- opcional
  result_display            text not null,          -- "00:03:33" (MM:SS:CC)
  result_centiseconds       int  not null,
  target_centiseconds       int  not null,           -- snapshot do alvo no momento do cadastro
  difference_centiseconds   int  not null,           -- abs(result - target), sempre >= 0
  is_exact_hit              boolean not null default false,
  prize_type                text,                    -- só relevante quando is_exact_hit = true
  delivered                 boolean not null default false,
  delivery_responsible      text,
  delivery_at               timestamptz,
  deleted                   boolean not null default false,  -- soft delete, mesmo padrão de leads.deletado
  created_at                timestamptz not null default now(),
  created_by                uuid references auth.users(id) on delete set null
);

alter table public.timer_challenge_entries enable row level security;

drop policy if exists "timer_challenge_entries_write" on public.timer_challenge_entries;
create policy "timer_challenge_entries_write" on public.timer_challenge_entries for all to authenticated
  using (public.papel_atual() = 'marketing')
  with check (public.papel_atual() = 'marketing');

drop policy if exists "timer_challenge_entries_select_interno" on public.timer_challenge_entries;
create policy "timer_challenge_entries_select_interno" on public.timer_challenge_entries for select to authenticated
  using (public.papel_atual() = 'marketing');

-- Índices usados pelo ranking (menor diferença, depois mais antigo) e pela
-- lista de ganhadores instantâneos (mais recentes primeiro) por dia.
create index if not exists idx_tce_ranking on public.timer_challenge_entries
  (event_id, difference_centiseconds, created_at)
  where deleted = false and is_exact_hit = false;

create index if not exists idx_tce_winners on public.timer_challenge_entries
  (event_id, created_at)
  where deleted = false and is_exact_hit = true;

-- ─── 3. RPC pública (anon) para a tela de TV ─────────────────────────
-- Devolve, num único payload jsonb, tudo que a tela de TV precisa pra um
-- dia ativo: identidade do desafio, estatísticas agregadas, Top 10 do
-- ranking (sem telefone) e a lista de ganhadores instantâneos (sem
-- telefone). SECURITY DEFINER porque `anon` não tem (e não deve ter)
-- select direto nas tabelas acima — só COUNT/Top10/lista já filtrada sai
-- daqui, nunca a tabela crua. Único ponto do módulo com grant a `anon`;
-- documentado explicitamente porque é uma exceção ao padrão (D-078
-- reservou leitura anon só pra formularios/campos_personalizados/
-- simuladores, restritos a metadado sem PII — aqui o "metadado" já É o
-- ranking, então a função filtra colunas manualmente em vez de expor a
-- tabela).
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
begin
  select id, name, slug, target_centiseconds
    into v_event
    from public.timer_challenge_events
    where slug = p_slug and active = true
    limit 1;

  if v_event.id is null then
    return jsonb_build_object('found', false);
  end if;

  select count(*) into v_total_participants
    from public.timer_challenge_entries
    where event_id = v_event.id and deleted = false;

  select count(*) into v_total_winners
    from public.timer_challenge_entries
    where event_id = v_event.id and deleted = false and is_exact_hit = true;

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_ranking
  from (
    select
      row_number() over (order by difference_centiseconds asc, created_at asc)::int as position,
      participant_number, participant_name, result_display, difference_centiseconds
    from public.timer_challenge_entries
    where event_id = v_event.id and deleted = false and is_exact_hit = false
    order by difference_centiseconds asc, created_at asc
    limit 10
  ) t;

  select coalesce(jsonb_agg(w order by w.created_at desc), '[]'::jsonb) into v_winners
  from (
    select participant_number, participant_name, created_at, prize_type, delivered
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
      'totalWinners', v_total_winners
    ),
    'ranking', v_ranking,
    'winners', v_winners
  );
end;
$$;

revoke all on function public.timer_challenge_painel_publico(text) from public, authenticated;
grant execute on function public.timer_challenge_painel_publico(text) to anon, authenticated;

-- ─── 4. Realtime (Broadcast, não postgres_changes) ───────────────────
-- A tela de TV é anônima e não tem policy de SELECT nas tabelas acima —
-- por isso ela NÃO usa subscription `postgres_changes` (que dependeria de
-- RLS). O painel administrativo (autenticado) dispara um Broadcast no
-- canal público `desafio-painel-<eventId>` a cada gravação; a tela de TV
-- escuta esse canal e, ao receber qualquer mensagem, re-chama a RPC acima
-- pra atualizar. Broadcast não depende de replication/publication —
-- nenhum `alter publication supabase_realtime add table ...` necessário
-- aqui (diferente de materiais/eventos/leads/perfis/ofertas).

-- =============================================================
-- Verificação
-- =============================================================
-- select * from timer_challenge_events;
-- select * from timer_challenge_entries order by created_at desc limit 20;
-- select timer_challenge_painel_publico('sexta-feira-abc123');
-- select grantee, privilege_type from information_schema.role_routine_grants
--   where routine_name = 'timer_challenge_painel_publico';
