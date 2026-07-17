-- =============================================================
-- Hardening de Segurança — consolidação pós-auditoria (2026-07-17)
-- =============================================================
-- Rode no SQL Editor do Supabase como ÚLTIMA migração, DEPOIS de todas
-- as demais (em especial migracao-comercial.sql, migracao-qrcode.sql,
-- migracao-form-builder.sql, migracao-campos-personalizados.sql,
-- migracao-simulador.sql, migracao-retencao.sql e migracao-leads-mensais.sql).
-- Idempotente: pode rodar mais de uma vez sem erro.
--
-- Depois de aplicar, rode:
--   NOTIFY pgrst, 'reload schema';
--
-- OBJETIVO: fechar os achados da auditoria de segurança SEM alterar o
-- comportamento funcional do sistema. Cada bloco documenta por que a
-- mudança é transparente para os fluxos legítimos.
--
-- Achados endereçados aqui:
--   V-01  leads_select permissivo (vendedor lê leads de colegas)
--   V-02  limpar_leads_expirados() executável por anon/authenticated
--   V-05  policies internas USING (true) expõem metadados a qualquer autenticado
--   V-06  audit_log aceita INSERT direto de qualquer autenticado (forja de trilha)
-- =============================================================


-- ─── V-01: leads_select — vendedor só enxerga os PRÓPRIOS leads ──────────────
-- Consolida as definições divergentes de leads_select (schema.sql /
-- protecao-dados.sql / migracao-comercial.sql / migracao-qrcode.sql /
-- migracao-rls-vendedor-leads-v2.sql) numa única fonte de verdade, com a
-- condição ESTRITA do PA-11 (vendedor_id = auth.uid()).
--
-- Por que NÃO altera comportamento:
--   - marketing/comercial mantêm leitura total (fila de distribuição de
--     leads sem vendedor depende disso).
--   - vendedor: VendedorApp.jsx já filtra os leads exibidos por
--     vendedorNome === session.vendedorNome — nenhuma tela mostra lead de
--     colega hoje. A restrição só fecha o acesso via REST/PostgREST direto.
--   - ranking_evento/ranking_mes são SECURITY DEFINER e ignoram RLS — o
--     placar da equipe continua completo.
--   - Todo lead com auth.uid() já nasce com vendedor_id preenchido, então
--     "= auth.uid()" não perde nenhuma linha frente a "is not null".

drop policy if exists "leads_select" on public.leads;
create policy "leads_select" on public.leads for select to authenticated
  using (
    deletado = false
    and (
      public.papel_atual() in ('marketing', 'comercial')
      or (public.papel_atual() = 'vendedor' and vendedor_id = auth.uid())
    )
  );


-- ─── V-02: revoga a função de retenção de quem não deveria executá-la ────────
-- limpar_leads_expirados() é SECURITY DEFINER (ignora RLS e apaga leads
-- fisicamente). Por padrão o PostgreSQL concede EXECUTE a PUBLIC, tornando-a
-- chamável por anon/authenticated via /rest/v1/rpc/. Só o job pg_cron (que
-- roda como superuser) precisa executá-la.
--
-- Por que NÃO altera comportamento:
--   - O frontend NUNCA chama esta função (só ranking_evento/ranking_mes/
--     demanda_por_regiao são invocadas via rpc()).
--   - O agendamento pg_cron executa no contexto do owner, não do grant a
--     PUBLIC — continua rodando normalmente todas as madrugadas.
-- Mesmo padrão de revoke já aplicado a ranking_evento/ranking_mes/demanda.

revoke all on function public.limpar_leads_expirados() from public, anon, authenticated;


-- ─── V-05: leituras internas restritas a papéis ATIVOS ───────────────────────
-- formularios/campos_personalizados/simuladores tinham SELECT interno
-- "to authenticated using (true)" — qualquer sessão autenticada (inclusive
-- conta inativa recém-criada por auto-cadastro, cujo papel_atual() é NULL)
-- lia todas as linhas, inclusive itens INATIVOS e a lógica de pontuação
-- (perguntas/pesos). Passa a exigir papel ativo, alinhado a
-- eventos_select/materiais_select.
--
-- Por que NÃO altera comportamento:
--   - marketing/comercial/vendedor ATIVOS têm papel_atual() não-nulo →
--     continuam lendo tudo que já liam nas telas de gestão.
--   - A leitura PÚBLICA (anon, WHERE ativo=true) das páginas /f e /s NÃO é
--     tocada — a página pública continua renderizando sem sessão.

drop policy if exists "formularios_select_interno" on public.formularios;
create policy "formularios_select_interno" on public.formularios for select to authenticated
  using (public.papel_atual() is not null);

drop policy if exists "campos_personalizados_select_interno" on public.campos_personalizados;
create policy "campos_personalizados_select_interno" on public.campos_personalizados for select to authenticated
  using (public.papel_atual() is not null);

drop policy if exists "simuladores_select_interno" on public.simuladores;
create policy "simuladores_select_interno" on public.simuladores for select to authenticated
  using (public.papel_atual() is not null);


-- ─── V-06: audit_log não aceita mais INSERT direto do cliente ────────────────
-- A trilha de auditoria era gravável por qualquer autenticado
-- (WITH CHECK (true)), permitindo forjar/poluir registros. A escrita
-- legítima vem do trigger audit_leads (função log_lead_change, SECURITY
-- DEFINER, owner com BYPASSRLS) — que continua inserindo normalmente.
--
-- Por que NÃO altera comportamento:
--   - O app nunca insere em audit_log diretamente (verificado no código);
--     só lê (marketing) e depende do trigger para escrever.
--   - Removida a policy de INSERT, com RLS habilitada, INSERTs diretos de
--     authenticated são negados; o trigger (definer/owner) não é afetado.

drop policy if exists "audit_log_insert" on public.audit_log;


-- =============================================================
-- Verificação
-- =============================================================
-- V-01: a condição deve conter "vendedor_id = auth.uid()", não "is not null":
--   select policyname, qual from pg_policies where tablename='leads' and policyname='leads_select';
--
-- V-02: PUBLIC/anon/authenticated não devem ter EXECUTE:
--   select grantee, privilege_type from information_schema.role_routine_grants
--     where routine_name = 'limpar_leads_expirados';
--
-- V-05: as três policies *_select_interno devem checar papel_atual():
--   select tablename, policyname, qual from pg_policies
--     where policyname like '%_select_interno';
--
-- V-06: não deve existir policy de INSERT em audit_log:
--   select policyname, cmd from pg_policies where tablename='audit_log';
-- =============================================================
