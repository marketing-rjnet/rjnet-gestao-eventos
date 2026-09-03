-- =============================================================
-- Landing Pages + Aquisição (D-104): infraestrutura genérica de
-- Landing Pages, sessões de visita, eventos internos e atribuição
-- =============================================================
-- Rode no SQL Editor do Supabase APÓS migracao-auth.sql (usa papel_atual())
-- e, idealmente, APÓS migracao-retencao.sql (chave de retenção — o bloco
-- é guardado por `if exists`, então a migração roda mesmo sem ela).
-- Idempotente: pode rodar mais de uma vez sem erro.
--
-- Depois de aplicar, rode (mesmo gotcha de migracao-form-builder.sql):
--   NOTIFY pgrst, 'reload schema';
--
-- Decisões de arquitetura (D-104):
--   * `landing_pages` é uma ENTIDADE GENÉRICA — a LP de Fibra é só a
--     primeira linha (seed no fim deste arquivo). Cadastrar LP TV/Móvel/
--     sazonal é um INSERT pela tela de gestão, nunca código novo.
--   * Sessão/eventos são tabelas PRÓPRIAS do módulo (`lp_sessions`,
--     `lp_events`) — UMA tabela de eventos para todos os tipos, o tipo é
--     a coluna `nome` (whitelist mantida em código: src/lib/aquisicao.js
--     e supabase/functions/rastrear-lp/index.ts). Nunca uma tabela por
--     tipo de evento.
--   * O Lead continua sendo o `leads` de sempre — só ganha 2 colunas de
--     vínculo (`landing_page_id`, `lp_session_id`) e o valor
--     `origem='landing_page'`. UTM reaproveita `leads.utm` (D-072).
--   * Campanha NÃO é tabela: é a dimensão utm_source/medium/campaign/
--     content gravada na sessão (o projeto nunca teve tabela de
--     campanhas — `simuladores.campanha` é um agrupador texto). A LP
--     pode ter uma `campanha_padrao` que só preenche `utm_campaign` de
--     visitas sem UTM.
--   * Minimização (LGPD): sessão/evento não guardam IP nem user-agent
--     cru — só `device` (mobile/desktop/tablet). IP vai apenas para
--     `leads.origem_ip` (rate limit/moderação, D-067), como nos demais
--     canais públicos.
--   * Leitura pública SÓ via RPC SECURITY DEFINER (`landing_page_publica`)
--     com `grant execute to anon` — mesmo padrão D-103/D-089, nunca
--     policy `to anon` em tabela.
--   * Escrita de sessão/evento/lead público SÓ pelas Edge Functions
--     (`service_role`) — as tabelas não têm policy de INSERT para
--     `authenticated` nem `anon`.
-- =============================================================

-- ─── 1. landing_pages ─────────────────────────────────────────

create table if not exists public.landing_pages (
  id                text primary key,
  nome              text not null,                       -- "LP Fibra"
  slug              text not null unique,                -- "fibra" (identifica a LP no SDK/tracking)
  descricao         text,
  dominio           text,                                -- "fibra.rjnet.com.br" (informativo + CORS)
  servico           text check (servico in ('internet_residencial', 'internet_empresarial', 'rjnet_movel', 'streamings', 'outro')),
  status            text not null default 'preparacao'
                    check (status in ('ativa', 'preparacao', 'inativa')),
  campanha_padrao   text,                                -- utm_campaign atribuída a visitas sem UTM
  whatsapp_enabled  boolean not null default true,
  whatsapp_number   text,                                -- nulo até o número oficial ser definido — NUNCA hardcoded no código
  whatsapp_label    text,
  whatsapp_mensagem text,                                -- texto pré-preenchido do wa.me
  -- IDs PÚBLICOS de ferramentas de tracking (GTM, GA4, Google Ads, Meta
  -- Pixel) — configuráveis por LP, sem deploy. Nunca secrets/tokens.
  tracking          jsonb not null default '{}'::jsonb,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

alter table public.landing_pages enable row level security;

-- Gestão: marketing (mesmo padrão marketing-only de Estoque/Equipe/Desafio)
drop policy if exists "landing_pages_write" on public.landing_pages;
create policy "landing_pages_write" on public.landing_pages for all to authenticated
  using (public.papel_atual() = 'marketing')
  with check (public.papel_atual() = 'marketing');

-- Leitura interna: qualquer papel ATIVO — só metadado (nome/slug/status),
-- necessário pra rotular a origem do lead ("Landing Page — LP Fibra") na
-- fila de distribuição, que o comercial também vê. Mesmo nível de
-- formularios_select_interno (V-05).
drop policy if exists "landing_pages_select_interno" on public.landing_pages;
create policy "landing_pages_select_interno" on public.landing_pages for select to authenticated
  using (public.papel_atual() is not null);

-- ─── 2. lp_sessions — sessão de visita (anônima) ──────────────

create table if not exists public.lp_sessions (
  id                text primary key,                    -- UUID gerado no cliente (SDK), validado na Edge Function
  landing_page_id   text not null references public.landing_pages(id) on delete cascade,
  landing_page_url  text,
  referrer          text,
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  utm_term          text,
  utm_content       text,
  device            text check (device in ('mobile', 'desktop', 'tablet')),
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

create index if not exists idx_lp_sessions_lp_criado on public.lp_sessions (landing_page_id, criado_em);
create index if not exists idx_lp_sessions_campanha on public.lp_sessions (utm_campaign) where utm_campaign is not null;

alter table public.lp_sessions enable row level security;

-- Só marketing lê; ninguém autenticado escreve (só service_role via Edge Function)
drop policy if exists "lp_sessions_select" on public.lp_sessions;
create policy "lp_sessions_select" on public.lp_sessions for select to authenticated
  using (public.papel_atual() = 'marketing');

-- ─── 3. lp_events — eventos internos (taxonomia própria) ──────
-- Eventos iniciais: page_view, cta_click, form_start, form_submit,
-- lead_created, whatsapp_click. Novos tipos = adicionar na whitelist em
-- código (src/lib/aquisicao.js + rastrear-lp), sem migração.

create table if not exists public.lp_events (
  id                bigint generated always as identity primary key,
  landing_page_id   text not null references public.landing_pages(id) on delete cascade,
  session_id        text references public.lp_sessions(id) on delete cascade,   -- nulo quando o tracking foi bloqueado mas o lead chegou
  lead_id           text references public.leads(id) on delete set null,
  nome              text not null check (nome ~ '^[a-z][a-z0-9_]{1,39}$'),
  propriedades      jsonb not null default '{}'::jsonb,
  criado_em         timestamptz not null default now()
);

create index if not exists idx_lp_events_lp_criado on public.lp_events (landing_page_id, criado_em);
create index if not exists idx_lp_events_session on public.lp_events (session_id);
create index if not exists idx_lp_events_lead on public.lp_events (lead_id) where lead_id is not null;
create index if not exists idx_lp_events_nome_criado on public.lp_events (nome, criado_em);

alter table public.lp_events enable row level security;

drop policy if exists "lp_events_select" on public.lp_events;
create policy "lp_events_select" on public.lp_events for select to authenticated
  using (public.papel_atual() = 'marketing');

-- ─── 4. Vínculos no Lead (aditivos, nullable) ─────────────────
-- origem='landing_page' + landing_page_id + lp_session_id. UTM continua
-- em leads.utm (D-072) — nunca duplicada em coluna nova.

alter table public.leads
  add column if not exists landing_page_id text references public.landing_pages(id) on delete set null,
  add column if not exists lp_session_id   text references public.lp_sessions(id) on delete set null;

create index if not exists idx_leads_landing_page on public.leads (landing_page_id) where landing_page_id is not null;

-- ─── 5. RPC pública: config da LP para o SDK (anon) ───────────
-- Devolve SÓ o que a página pública precisa: identidade, destino do
-- WhatsApp e IDs públicos de tracking. Nunca sessões/eventos/leads.

create or replace function public.landing_page_publica(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', lp.id,
    'nome', lp.nome,
    'slug', lp.slug,
    'servico', lp.servico,
    'campanha_padrao', lp.campanha_padrao,
    'whatsapp_enabled', lp.whatsapp_enabled,
    'whatsapp_number', lp.whatsapp_number,
    'whatsapp_label', lp.whatsapp_label,
    'whatsapp_mensagem', lp.whatsapp_mensagem,
    'tracking', coalesce(lp.tracking, '{}'::jsonb)
  )
  from public.landing_pages lp
  where lp.slug = p_slug and lp.status = 'ativa'
  limit 1;
$$;

revoke all on function public.landing_page_publica(text) from public;
grant execute on function public.landing_page_publica(text) to anon, authenticated;

-- ─── 6. RPC interna: métricas de aquisição (marketing) ────────
-- Um único payload jsonb com totais, por LP, por campanha e por dia —
-- mesmo espírito de timer_challenge_painel_publico (uma chamada, sem
-- trazer linhas cruas pro cliente). Definições:
--   visitas     = sessões distintas com page_view no período
--   interacoes  = sessões distintas com cta_click/form_start/form_submit/whatsapp_click
--   leads       = leads (não deletados) com landing_page_id no período
--   whatsapp    = cliques em whatsapp_click (todos) — whatsapp_leads = com lead vinculado
-- Filtros de campanha/source/medium aplicam-se via sessão (visitas) e
-- via leads.utm (leads); vendedor/temperatura só a leads e aos cliques
-- de WhatsApp desses leads.

create or replace function public.aquisicao_metricas(
  p_de timestamptz default null,
  p_ate timestamptz default null,
  p_landing_page_id text default null,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null,
  p_vendedor_id text default null,
  p_temperatura text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_de  timestamptz := coalesce(p_de, now() - interval '30 days');
  v_ate timestamptz := coalesce(p_ate, now());
  v_result jsonb;
begin
  if public.papel_atual() <> 'marketing' then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  with sess as (
    select s.*
    from public.lp_sessions s
    where s.criado_em >= v_de and s.criado_em < v_ate
      and (p_landing_page_id is null or s.landing_page_id = p_landing_page_id)
      and (p_utm_source is null or s.utm_source = p_utm_source)
      and (p_utm_medium is null or s.utm_medium = p_utm_medium)
      and (p_utm_campaign is null or s.utm_campaign = p_utm_campaign)
  ),
  ev as (
    select e.*
    from public.lp_events e
    join sess s on s.id = e.session_id
    where e.criado_em >= v_de and e.criado_em < v_ate
  ),
  lds as (
    select l.*
    from public.leads l
    where l.deletado = false
      and l.landing_page_id is not null
      and l.criado_em >= v_de and l.criado_em < v_ate
      and (p_landing_page_id is null or l.landing_page_id = p_landing_page_id)
      and (p_utm_source is null or l.utm->>'utm_source' = p_utm_source)
      and (p_utm_medium is null or l.utm->>'utm_medium' = p_utm_medium)
      and (p_utm_campaign is null or l.utm->>'utm_campaign' = p_utm_campaign)
      and (p_vendedor_id is null or l.vendedor_id = p_vendedor_id)
      and (p_temperatura is null or l.temperatura = p_temperatura)
  ),
  wa as (
    -- cliques de WhatsApp: pelo lead (quando há vendedor/temperatura no
    -- filtro só valem os cliques de leads filtrados) ou pela sessão
    select e.*
    from public.lp_events e
    where e.nome = 'whatsapp_click'
      and e.criado_em >= v_de and e.criado_em < v_ate
      and (p_landing_page_id is null or e.landing_page_id = p_landing_page_id)
      and (
        (p_vendedor_id is null and p_temperatura is null and (
          e.session_id in (select id from sess) or e.lead_id in (select id from lds)
        ))
        or e.lead_id in (select id from lds)
      )
  ),
  por_lp as (
    select lp.id, lp.nome, lp.slug, lp.status, lp.servico,
      (select count(distinct e.session_id) from ev e where e.landing_page_id = lp.id and e.nome = 'page_view') as visitas,
      (select count(distinct e.session_id) from ev e where e.landing_page_id = lp.id and e.nome in ('cta_click','form_start','form_submit','whatsapp_click')) as interacoes,
      (select count(*) from lds l where l.landing_page_id = lp.id) as leads,
      (select count(*) from wa w where w.landing_page_id = lp.id) as whatsapp
    from public.landing_pages lp
    where p_landing_page_id is null or lp.id = p_landing_page_id
    order by lp.criado_em
  ),
  por_campanha as (
    select
      coalesce(nullif(s.utm_source, ''), '(direto)') as utm_source,
      coalesce(nullif(s.utm_medium, ''), '(nenhum)') as utm_medium,
      coalesce(nullif(s.utm_campaign, ''), '(sem campanha)') as utm_campaign,
      coalesce(nullif(s.utm_content, ''), '') as utm_content,
      count(distinct s.id) filter (where exists (select 1 from ev e where e.session_id = s.id and e.nome = 'page_view')) as visitas,
      count(distinct l.id) as leads,
      count(distinct w.id) as whatsapp
    from sess s
    left join lds l on l.lp_session_id = s.id
    left join wa w on w.session_id = s.id
    group by 1, 2, 3, 4
    order by visitas desc, leads desc
  ),
  por_dia as (
    select d::date as dia,
      (select count(distinct e.session_id) from ev e where e.nome = 'page_view' and e.criado_em::date = d::date) as visitas,
      (select count(*) from lds l where l.criado_em::date = d::date) as leads,
      (select count(*) from wa w where w.criado_em::date = d::date) as whatsapp
    from generate_series(v_de::date, (v_ate - interval '1 second')::date, interval '1 day') as d
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('de', v_de, 'ate', v_ate),
    'totais', jsonb_build_object(
      'visitas', (select count(distinct session_id) from ev where nome = 'page_view'),
      'interacoes', (select count(distinct session_id) from ev where nome in ('cta_click','form_start','form_submit','whatsapp_click')),
      'leads', (select count(*) from lds),
      'whatsapp', (select count(*) from wa),
      'whatsapp_leads', (select count(distinct lead_id) from wa where lead_id is not null)
    ),
    'por_landing_page', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from por_lp p),
    'por_campanha', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from por_campanha c),
    'por_dia', (select coalesce(jsonb_agg(to_jsonb(d) order by d.dia), '[]'::jsonb) from por_dia d)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.aquisicao_metricas(timestamptz, timestamptz, text, text, text, text, text, text) from public, anon;
grant execute on function public.aquisicao_metricas(timestamptz, timestamptz, text, text, text, text, text, text) to authenticated;

-- ─── 7. Retenção (LGPD) — sessões/eventos anônimos ────────────
-- Sessão/evento não identificam pessoa, mas um evento pode apontar pro
-- lead (lead_id). Expiram por criado_em; o lead NÃO é apagado por aqui
-- (FK set null) — ele segue a retenção própria de leads (D-064).

create or replace function public.limpar_lp_tracking_expirado()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  dias integer := 395;
  total_sessoes integer;
  total_eventos integer;
begin
  if to_regclass('public.configuracoes_retencao') is not null then
    select valor_dias into dias from public.configuracoes_retencao where chave = 'retencao_lp_sessoes_dias';
    dias := coalesce(dias, 395);
  end if;

  delete from public.lp_events where criado_em < now() - (dias || ' days')::interval;
  get diagnostics total_eventos = row_count;

  delete from public.lp_sessions where criado_em < now() - (dias || ' days')::interval;
  get diagnostics total_sessoes = row_count;

  return jsonb_build_object('executado_em', now(), 'lp_sessoes_expiradas', total_sessoes, 'lp_eventos_expirados', total_eventos);
end;
$$;

-- V-02: destrutiva + SECURITY DEFINER → ninguém além do cron executa
revoke all on function public.limpar_lp_tracking_expirado() from public, anon, authenticated;

do $$
begin
  if to_regclass('public.configuracoes_retencao') is not null then
    insert into public.configuracoes_retencao (chave, valor_dias, descricao) values
      ('retencao_lp_sessoes_dias', 395, 'Dias após a criação para exclusão física de sessões e eventos anônimos de Landing Pages (D-104)')
    on conflict (chave) do nothing;
  end if;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('lgpd-limpar-lp-tracking') where exists (
      select 1 from cron.job where jobname = 'lgpd-limpar-lp-tracking'
    );
    perform cron.schedule(
      'lgpd-limpar-lp-tracking',
      '30 5 * * *',   -- 02:30 BRT — meia hora depois de limpar_leads_expirados
      $cron$ select public.limpar_lp_tracking_expirado(); $cron$
    );
  end if;
end;
$$;

-- ─── 8. Primeira instância: LP Fibra ──────────────────────────
-- Só a PRIMEIRA linha da entidade genérica. Número de WhatsApp nasce
-- nulo — quando o número oficial existir, é editado na tela de gestão.

insert into public.landing_pages (id, nome, slug, descricao, dominio, servico, status, campanha_padrao, whatsapp_enabled, whatsapp_number, whatsapp_label, whatsapp_mensagem, tracking)
values (
  'lp-fibra',
  'LP Fibra',
  'fibra',
  'Landing page de aquisição de Internet Fibra',
  'fibra.rjnet.com.br',
  'internet_residencial',
  'ativa',
  null,
  true,
  null,
  'Falar no WhatsApp',
  'Olá! Vim pela página da RJNET Fibra e quero saber mais sobre os planos.',
  '{}'::jsonb
)
on conflict (slug) do nothing;

-- =============================================================
-- Verificação
-- =============================================================
-- select * from landing_pages;
-- select landing_page_publica('fibra');
-- select aquisicao_metricas(now() - interval '30 days', now(), null, null, null, null, null, null);
-- select policyname, cmd, roles from pg_policies where tablename in ('landing_pages','lp_sessions','lp_events');
-- select column_name from information_schema.columns where table_name='leads' and column_name in ('landing_page_id','lp_session_id');

notify pgrst, 'reload schema';
