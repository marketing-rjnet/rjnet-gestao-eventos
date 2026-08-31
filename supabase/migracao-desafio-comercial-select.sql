-- =============================================================
-- D-101: Desafio RJNet — leitura liberada para o papel `comercial`
-- (exportação de dados), escrita continua marketing-only
-- =============================================================
-- Rode no SQL Editor do Supabase a qualquer momento, depois de
-- migracao-desafio-cronometro.sql / migracao-desafio-tentativas.sql
-- (precisa das 3 tabelas já existirem). Idempotente.
--
-- Contexto: o comercial pedia para exportar os dados dos dias do Desafio
-- já criados pelo marketing (participantes/tentativas). Até aqui o módulo
-- era marketing-only em leitura E escrita (D-089), mesmo padrão de
-- Estoque/Equipe/Monitor. Esta migração amplia SÓ as 3 policies de SELECT
-- para também aceitar `comercial` — as policies `*_write` (`for all`)
-- permanecem checando exclusivamente `papel_atual() = 'marketing'`, então
-- cadastro de participante, tentativas, edição de prêmio, ativar/encerrar
-- dia etc. continuam impossíveis para o comercial (UI também não expõe:
-- ver DesafioComercialTab.jsx, só a sub-aba "Painel").
--
-- Depois de aplicar, rode:
--   NOTIFY pgrst, 'reload schema';

drop policy if exists "timer_challenge_events_select_interno" on public.timer_challenge_events;
create policy "timer_challenge_events_select_interno" on public.timer_challenge_events for select to authenticated
  using (public.papel_atual() in ('marketing', 'comercial'));

drop policy if exists "timer_challenge_entries_select_interno" on public.timer_challenge_entries;
create policy "timer_challenge_entries_select_interno" on public.timer_challenge_entries for select to authenticated
  using (public.papel_atual() in ('marketing', 'comercial'));

drop policy if exists "timer_challenge_attempts_select_interno" on public.timer_challenge_attempts;
create policy "timer_challenge_attempts_select_interno" on public.timer_challenge_attempts for select to authenticated
  using (public.papel_atual() in ('marketing', 'comercial'));

notify pgrst, 'reload schema';

-- ─── Verificação manual ────────────────────────────────────────────────
-- select polname, qual from pg_policies
--   where tablename in ('timer_challenge_events', 'timer_challenge_entries', 'timer_challenge_attempts')
--   and polname like '%select_interno';
