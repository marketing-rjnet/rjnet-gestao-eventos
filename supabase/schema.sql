-- =============================================================
-- RJNET GESTÃO DE EVENTOS — Schema Supabase
-- =============================================================
-- Como aplicar: Supabase Dashboard → SQL Editor → cole tudo → Run.
-- Pode rodar mais de uma vez sem problema (idempotente).
-- =============================================================

-- ─── Tabelas ─────────────────────────────────────────────────

create table if not exists public.materiais (
  id          text primary key,
  nome        text not null,
  quantidade  integer not null default 0 check (quantidade >= 0),
  descricao   text
);

create table if not exists public.vendedores (
  id    text primary key,
  nome  text not null,
  ativo boolean not null default true
);

create table if not exists public.eventos (
  id           text primary key,
  nome         text not null,
  local        text,
  data_inicio  date,
  data_fim     date,
  status       text not null default 'planejado' check (status in ('ativo', 'planejado', 'encerrado')),
  tipo         text check (tipo in ('sinalizacao', 'presenca_comercial', 'ativacao_especial')),
  observacoes  text,
  -- materiais alocados ao evento: [{ materialId, quantidade, estadoSaida, retornado }]
  materiais    jsonb not null default '[]'::jsonb,
  criado_em    timestamptz not null default now()
);

create table if not exists public.leads (
  id                text primary key,
  evento_id         text references public.eventos(id) on delete cascade,
  vendedor_nome     text,
  nome              text not null,
  telefone          text,
  cpf               text,
  endereco          text,
  servico_interesse text,
  temperatura       text not null default 'morno' check (temperatura in ('frio', 'morno', 'quente', 'convertido')),
  observacao        text,
  ja_cliente_rjnet  boolean not null default false,
  criado_em         timestamptz not null default now()
);

create index if not exists idx_leads_evento on public.leads (evento_id);
create index if not exists idx_leads_criado_em on public.leads (criado_em);

-- ─── Row Level Security ──────────────────────────────────────
-- ATENÇÃO: este schema é o ponto de partida (setup inicial).
-- Para produção com controle de acesso real, execute também
-- supabase/migracao-auth.sql, que:
--   • Remove as policies `to anon` abaixo
--   • Cria a tabela `perfis` ligada ao Supabase Auth
--   • Define policies por papel (marketing / vendedor)
--
-- Enquanto migracao-auth.sql NÃO tiver sido aplicado, qualquer
-- pessoa com a anon key pode ler/escrever nas tabelas.
-- A anon key é pública por design — o RLS é a única proteção.

alter table public.materiais  enable row level security;
alter table public.vendedores enable row level security;
alter table public.eventos    enable row level security;
alter table public.leads      enable row level security;

-- Policies de bootstrap (sem auth): substituídas por migracao-auth.sql
drop policy if exists "app_acesso_total" on public.materiais;
create policy "app_acesso_total" on public.materiais  for all to anon using (true) with check (true);

drop policy if exists "app_acesso_total" on public.vendedores;
create policy "app_acesso_total" on public.vendedores for all to anon using (true) with check (true);

drop policy if exists "app_acesso_total" on public.eventos;
create policy "app_acesso_total" on public.eventos    for all to anon using (true) with check (true);

drop policy if exists "app_acesso_total" on public.leads;
create policy "app_acesso_total" on public.leads      for all to anon using (true) with check (true);

-- ─── Realtime (sincronização entre dispositivos) ─────────────

do $$
begin
  alter publication supabase_realtime add table public.materiais;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.vendedores;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.eventos;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.leads;
exception when duplicate_object then null;
end $$;

-- ─── Seed: estoque e equipe iniciais ─────────────────────────
-- (mesmos dados que o app usa hoje; ajuste à vontade)

insert into public.materiais (id, nome, quantidade, descricao) values
  ('m1',  'Wind Banner 2m', 6, 'Banner vertical 2 metros'),
  ('m2',  'Wind Banner 5m', 4, 'Banner vertical 5 metros'),
  ('m3',  'Tenda Inflável', 2, null),
  ('m4',  'Balão Inflável', 3, null),
  ('m5',  'Placa Hotspot', 10, null),
  ('m6',  'Rádio Wi-Fi', 8, null),
  ('m7',  'Banner Gradil', 12, null),
  ('m8',  'Banner Poste', 15, null),
  ('m9',  'Banner "Como Acessar"', 8, null),
  ('m10', 'Banner "Evento Conectado RJNet"', 6, null)
on conflict (id) do nothing;

insert into public.vendedores (id, nome, ativo) values
  ('v1', 'Carlos Silva',  true),
  ('v2', 'Ana Oliveira',  true),
  ('v3', 'Marcos Lima',   true),
  ('v4', 'Juliana Costa', true),
  ('v5', 'Thiago',        true),
  ('v6', 'Ramon',         true)
on conflict (id) do nothing;
