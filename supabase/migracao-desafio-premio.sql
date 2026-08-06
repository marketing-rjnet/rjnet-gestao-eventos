-- =============================================================
-- D-091: Desafio RJNet — área de Prêmio por dia (descrição + imagem)
-- =============================================================
-- Rode no SQL Editor do Supabase APÓS migracao-desafio-remove-numero.sql.
-- Idempotente: pode rodar mais de uma vez sem erro.
--
-- Depois de aplicar, rode:
--   NOTIFY pgrst, 'reload schema';
--
-- Contexto: o marketing precisa descrever o prêmio de cada dia do desafio
-- (ex: assinatura de streaming — Disney+/HBO Max/RJNet Play) e mostrar essa
-- descrição + uma imagem ao lado do ranking na tela pública de TV
-- (/tv/:slug). É um atributo do DIA (`timer_challenge_events`), não do
-- participante — cada dia/edição já é 100% independente (D-089), então o
-- prêmio segue o mesmo isolamento.
-- =============================================================

alter table public.timer_challenge_events
  add column if not exists prize_description text,
  add column if not exists prize_image_path  text,
  add column if not exists prize_updated_at  timestamptz;

-- ─── Storage: bucket público para a imagem do prêmio ───────────────────
-- Público por decisão consciente, mesmo princípio do bucket `ofertas`
-- (D-057): imagem promocional sem dado pessoal de titular. Path
-- determinístico `<event_id>.<ext>` — 1 imagem ativa por dia, sobrescrita
-- ao trocar (sem histórico/versionamento, mesmo padrão de `ofertas`).

insert into storage.buckets (id, name, public)
values ('desafio-premios', 'desafio-premios', true)
on conflict (id) do nothing;

-- upload(..., { upsert: true }) faz INSERT ... ON CONFLICT DO UPDATE — resolver o
-- conflito exige SELECT na linha existente, além de INSERT/UPDATE (mesmo
-- achado do D-057, ver comentário em migracao-ofertas.sql).
drop policy if exists "desafio_premios_bucket_read" on storage.objects;
create policy "desafio_premios_bucket_read" on storage.objects for select to authenticated
  using (bucket_id = 'desafio-premios');

drop policy if exists "desafio_premios_bucket_write" on storage.objects;
create policy "desafio_premios_bucket_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'desafio-premios' and public.papel_atual() = 'marketing');

drop policy if exists "desafio_premios_bucket_update" on storage.objects;
create policy "desafio_premios_bucket_update" on storage.objects for update to authenticated
  using (bucket_id = 'desafio-premios' and public.papel_atual() = 'marketing');

drop policy if exists "desafio_premios_bucket_delete" on storage.objects;
create policy "desafio_premios_bucket_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'desafio-premios' and public.papel_atual() = 'marketing');

-- ─── RPC pública: recriada para incluir o prêmio no payload ────────────
-- Mesma regra do D-089/D-090: a tela de TV nunca lê a tabela direto, só
-- via esta RPC (SECURITY DEFINER, único `grant ... to anon` do módulo).
-- Devolve o PATH cru (não a URL completa) — a URL pública é montada no
-- cliente a partir de `supabaseConfig.url`, mesmo padrão já usado para
-- `ofertas.imagem_path` em src/lib/dataService.js (ofertaFromDb).
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
  select id, name, slug, target_centiseconds, prize_description, prize_image_path, prize_updated_at
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
      'prizeUpdatedAt', v_event.prize_updated_at
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
--   where table_name = 'timer_challenge_events' and column_name like 'prize_%';
-- select timer_challenge_painel_publico('sexta-feira-abc123');
