-- =============================================================
-- Form Builder: formulários configuráveis (catálogo fixo de campos)
-- =============================================================
-- Rode no SQL Editor do Supabase APÓS migracao-qrcode.sql.
-- Idempotente: pode rodar mais de uma vez sem erro.
--
-- Decisão de arquitetura: NÃO é um motor de campo genérico. `campos` e
-- `campos_obrigatorios` guardam só uma lista de chaves de um catálogo FIXO
-- definido em código (src/lib/constants.js — CAMPOS_FORMULARIO). O
-- formulário escolhe QUAIS campos conhecidos aparecem, nunca inventa um
-- tipo de campo novo em runtime. Isso mantém o Lead com forma estável —
-- toda resposta de formulário é só mais um Lead (mesmo pipeline único),
-- nunca uma entidade paralela com schema próprio.
-- =============================================================

-- ─── 1. Tabela formularios ────────────────────────────────────

create table if not exists public.formularios (
  id                  text primary key,
  nome                text not null,
  slug                text not null unique,
  campos              jsonb not null default '[]'::jsonb,
  campos_obrigatorios jsonb not null default '[]'::jsonb,
  ativo               boolean not null default true,
  criado_em           timestamptz not null default now()
);

alter table public.formularios enable row level security;

-- marketing/comercial: gestão completa (mesmo nível de Ofertas/Eventos)
drop policy if exists "formularios_write" on public.formularios;
create policy "formularios_write" on public.formularios for all to authenticated
  using (public.papel_atual() in ('marketing', 'comercial'))
  with check (public.papel_atual() in ('marketing', 'comercial'));

-- leitura para qualquer papel autenticado (marketing/comercial/vendedor
-- podem precisar ver a lista) — igual ao padrão de ofertas_select
drop policy if exists "formularios_select_interno" on public.formularios;
create policy "formularios_select_interno" on public.formularios for select to authenticated
  using (true);

-- ─── 2. Leitura pública (anon) — só formulário ativo, sem dado sensível ──
-- Primeira exceção de leitura anônima no projeto: necessária porque a
-- página pública (quem escaneia o QR) não tem sessão nenhuma e precisa
-- saber quais campos desenhar. Expõe só nome/campos/campos_obrigatorios
-- de formulários ATIVOS — nunca dado de lead, nunca formulário inativo.

drop policy if exists "formularios_select_publico" on public.formularios;
create policy "formularios_select_publico" on public.formularios for select to anon
  using (ativo = true);

-- ─── 3. Atribuição no Lead — mesmo padrão de qr_code_id (migracao-qrcode.sql) ──

alter table public.leads
  add column if not exists formulario_id text references public.formularios(id) on delete set null;

create index if not exists idx_leads_formulario on public.leads (formulario_id);

-- ─── 4. Campo novo do catálogo: bairro ────────────────────────
-- "Bairro" não existia como campo de Lead. Entra uma vez, aditivo, e passa
-- a fazer parte do catálogo fixo (CAMPOS_FORMULARIO em src/lib/constants.js)
-- disponível pra qualquer formulário escolher — não é campo dinâmico solto.

alter table public.leads
  add column if not exists bairro text;

-- =============================================================
-- Verificação
-- =============================================================
-- select * from formularios;
-- select column_name from information_schema.columns where table_name = 'leads' and column_name = 'formulario_id';
