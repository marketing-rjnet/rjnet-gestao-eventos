-- =============================================================
-- RJNET — Migração: papel 'comercial' → 'vendedor'
-- =============================================================
-- Rode UMA ÚNICA VEZ no SQL Editor do Supabase, ANTES de aplicar
-- a versão atualizada de migracao-auth.sql (que remove 'comercial'
-- do check constraint).
--
-- O que faz:
--   1. Converte todos os perfis com papel='comercial' para 'vendedor'
--   2. Remove a constraint antiga e recria com apenas 2 papéis
-- =============================================================

-- Passo 1: migrar usuários existentes
update public.perfis
  set papel = 'vendedor'
  where papel = 'comercial';

-- Passo 2: recriar o check constraint sem 'comercial'
alter table public.perfis
  drop constraint if exists perfis_papel_check;

alter table public.perfis
  add constraint perfis_papel_check
  check (papel in ('marketing', 'vendedor'));

-- Verificação
select papel, count(*) from public.perfis group by papel order by papel;
