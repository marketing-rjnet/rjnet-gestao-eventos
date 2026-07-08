-- =============================================================
-- Simulador de Perfil de Consumo: campanhas de captação gamificada
-- =============================================================
-- Rode no SQL Editor do Supabase APÓS migracao-campos-personalizados.sql
-- e migracao-moderacao-formulario.sql.
-- Idempotente: pode rodar mais de uma vez sem erro.
--
-- Depois de aplicar, rode (mesmo gotcha de migracao-form-builder.sql):
--   NOTIFY pgrst, 'reload schema';
-- (ou Dashboard → Settings → API → Reload schema) — sem isso o PostgREST
-- não enxerga a tabela/colunas novas e a página pública do simulador
-- mostra "indisponível" mesmo com os dados já gravados.
--
-- Decisão de arquitetura (espelho de migracao-form-builder.sql): a tabela
-- `simuladores` guarda só a IDENTIDADE da campanha (nome, slug, agrupador).
-- O questionário em si é um catálogo FIXO versionado em código
-- (src/lib/simulador.js — PERGUNTAS_SIMULADOR), nunca um motor de quiz
-- genérico em runtime. Toda resposta vira só mais um Lead (pipeline único),
-- nunca uma entidade paralela com schema próprio.
-- =============================================================

-- ─── 1. Tabela simuladores (campanhas) ────────────────────────

create table if not exists public.simuladores (
  id                text primary key,
  nome              text not null,             -- "Panfleto Itaguaí Centro", "Tráfego Meta Julho/26"
  slug              text not null unique,      -- /s/<slug>
  tipo              text not null default 'perfil_consumo'
                    check (tipo in ('perfil_consumo', 'territorial')),
  campanha          text,                      -- agrupador livre opcional
  versao_perguntas  int  not null default 1,   -- versão do catálogo em código na criação
  ativo             boolean not null default true,
  criado_em         timestamptz not null default now()
);

alter table public.simuladores enable row level security;

-- marketing/comercial: gestão completa (mesmo nível de formularios_write)
drop policy if exists "simuladores_write" on public.simuladores;
create policy "simuladores_write" on public.simuladores for all to authenticated
  using (public.papel_atual() in ('marketing', 'comercial'))
  with check (public.papel_atual() in ('marketing', 'comercial'));

-- leitura para qualquer papel autenticado — igual formularios_select_interno
drop policy if exists "simuladores_select_interno" on public.simuladores;
create policy "simuladores_select_interno" on public.simuladores for select to authenticated
  using (true);

-- ─── 2. Leitura pública (anon) — só campanha ativa, sem dado sensível ──
-- Mesmo precedente aberto em D-062 para `formularios`: a página pública
-- (quem clica no anúncio / escaneia o QR) não tem sessão e precisa saber
-- que a campanha existe e está ativa. Expõe só nome/slug/tipo de campanhas
-- ATIVAS — nunca dado de lead.

drop policy if exists "simuladores_select_publico" on public.simuladores;
create policy "simuladores_select_publico" on public.simuladores for select to anon
  using (ativo = true);

-- ─── 3. Colunas novas em leads (todas aditivas e nullable) ────
-- perfil_consumo: respostas do quiz ({ versao, respostas }) — vive na linha
--   do lead de propósito: a retenção LGPD de leads sem contexto operacional
--   (migracao-qrcode-retencao.sql, D-064) expurga as respostas junto.
-- pontuacao / oferta_recomendada: calculadas NO SERVIDOR pela Edge Function
--   submeter-simulador (cliente nunca manda score pronto).
-- cidade: bairro já existia (migracao-form-builder.sql); cidade entra agora
--   e já serve à futura campanha territorial.
-- utm: atribuição de tráfego pago ({ utm_source, utm_medium, ... }) —
--   capturada na página pública, sanitizada na Edge Function.

alter table public.leads
  add column if not exists simulador_id       text references public.simuladores(id) on delete set null,
  add column if not exists perfil_consumo     jsonb,
  add column if not exists pontuacao          int,
  add column if not exists oferta_recomendada text,
  add column if not exists cidade             text,
  add column if not exists utm                jsonb;

create index if not exists idx_leads_simulador on public.leads (simulador_id);

-- Relatório de demanda territorial (fase futura, mas o índice já nasce
-- certo): agregação por cidade/bairro de leads não deletados.
create index if not exists idx_leads_cidade_bairro on public.leads (cidade, bairro)
  where deletado = false;

-- =============================================================
-- Verificação
-- =============================================================
-- select * from simuladores;
-- select column_name from information_schema.columns
--   where table_name = 'leads'
--   and column_name in ('simulador_id','perfil_consumo','pontuacao','oferta_recomendada','cidade','utm');
