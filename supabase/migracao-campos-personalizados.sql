-- =============================================================
-- Form Builder: campos personalizados definidos pelo marketing/comercial
-- =============================================================
-- Rode no SQL Editor do Supabase APÓS migracao-form-builder.sql.
-- Idempotente: pode rodar mais de uma vez sem erro.
--
-- Decisão de arquitetura: continua NÃO sendo um motor de campo genérico.
-- Um campo personalizado é sempre texto livre (mesma validação simples de
-- sanitizeText) — só a LEGENDA é livre, nunca o tipo/validação. Isso dá à
-- equipe (marketing/comercial) autonomia pra criar campos reutilizáveis
-- sem depender de deploy de código, sem abrir mão de um catálogo
-- conhecido e auditável.
--
-- Depois de aplicar, rode:
--   NOTIFY pgrst, 'reload schema';
-- =============================================================

-- ─── 1. Tabela campos_personalizados ──────────────────────────

create table if not exists public.campos_personalizados (
  id        text primary key,
  label     text not null,
  key       text not null unique,
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);

alter table public.campos_personalizados enable row level security;

drop policy if exists "campos_personalizados_write" on public.campos_personalizados;
create policy "campos_personalizados_write" on public.campos_personalizados for all to authenticated
  using (public.papel_atual() in ('marketing', 'comercial'))
  with check (public.papel_atual() in ('marketing', 'comercial'));

drop policy if exists "campos_personalizados_select_interno" on public.campos_personalizados;
create policy "campos_personalizados_select_interno" on public.campos_personalizados for select to authenticated
  using (true);

-- leitura pública (anon) — só campo ativo, sem dado sensível (mesmo padrão
-- de formularios_select_publico em migracao-form-builder.sql)
drop policy if exists "campos_personalizados_select_publico" on public.campos_personalizados;
create policy "campos_personalizados_select_publico" on public.campos_personalizados for select to anon
  using (ativo = true);

-- ─── 2. Referência nos formulários ─────────────────────────────
-- Separado de `campos`/`campos_obrigatorios` (catálogo fixo) de propósito:
-- evita colisão de chave entre um campo fixo e um personalizado, e deixa
-- claro qual lista é validada por tipo fixo e qual é sempre texto livre.

alter table public.formularios
  add column if not exists campos_personalizados_ids            jsonb not null default '[]'::jsonb,
  add column if not exists campos_personalizados_obrigatorios    jsonb not null default '[]'::jsonb;

-- ─── 3. Espaço pras respostas dos campos personalizados no Lead ───

alter table public.leads
  add column if not exists campos_extras jsonb not null default '{}'::jsonb;

-- =============================================================
-- Verificação
-- =============================================================
-- select * from campos_personalizados;
-- select column_name from information_schema.columns where table_name = 'leads' and column_name = 'campos_extras';
