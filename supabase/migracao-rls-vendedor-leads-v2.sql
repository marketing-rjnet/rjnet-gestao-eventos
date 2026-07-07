-- PA-11/LGPD (v2) — Reaplica a restrição de SELECT de leads para vendedores
-- ============================================================================
-- Contexto: migracao-rls-vendedor-leads.sql (PA-11, 2026-06-16) implementava
-- "vendedor só lê o próprio lead" (vendedor_id = auth.uid()), mas nunca foi
-- aplicada em produção. Em 2026-07-06, migracao-comercial.sql (D-059) e
-- migracao-qrcode.sql (D-061) reescreveram a policy leads_select do zero,
-- sem essa restrição — a versão final ficou com "vendedor_id is not null",
-- que permite ao vendedor ler leads de qualquer colega (nome, CPF, telefone,
-- endereço). Esta migration reaplica a restrição do PA-11 por cima da versão
-- mais recente, preservando o que D-059/D-061 adicionaram:
--   - marketing/comercial continuam com leitura total (necessário para a
--     fila de distribuição de leads sem vendedor)
--   - vendedor passa a ler apenas vendedor_id = auth.uid() — condição mais
--     estrita que "is not null" (todo lead com auth.uid() já tem vendedor_id
--     preenchido), então não há perda de cobertura da regra de D-061
--
-- Impacto verificado no frontend antes de escrever esta migration:
--   - VendedorApp.jsx já filtra os leads recebidos por
--     `l.vendedorNome === session.vendedorNome` antes de exibir — nenhuma
--     tela do vendedor mostra lead de colega hoje, então não há regressão
--     visível.
--   - Ranking (ranking_evento/ranking_mes) é `security definer` e ignora
--     RLS — continua retornando os números agregados de todos os vendedores
--     normalmente.
--   - "Leads sem vendedor" (LeadsTab.jsx, marketing/comercial) não é afetado:
--     o branch marketing/comercial desta policy não tem essa restrição.
--
-- Idempotente: seguro executar múltiplas vezes.
-- Não requer NOTIFY pgrst / reload schema (troca de policy, não de schema).
-- ============================================================================

drop policy if exists "leads_select" on public.leads;
create policy "leads_select" on public.leads for select to authenticated
  using (
    deletado = false
    and (
      public.papel_atual() in ('marketing', 'comercial')
      or (public.papel_atual() = 'vendedor' and vendedor_id = auth.uid())
    )
  );

-- ============================================================================
-- Verificação
-- ============================================================================
-- SELECT policyname, qual FROM pg_policies
-- WHERE tablename = 'leads' AND policyname = 'leads_select';
-- A condição deve conter "vendedor_id = auth.uid()", não "is not null".
