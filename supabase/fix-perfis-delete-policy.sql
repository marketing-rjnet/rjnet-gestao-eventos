-- Correção: adiciona política RLS de DELETE na tabela perfis
-- Execute no SQL Editor do Supabase Dashboard

drop policy if exists "perfis_delete" on public.perfis;
create policy "perfis_delete" on public.perfis for delete to authenticated
  using (public.papel_atual() = 'marketing');
