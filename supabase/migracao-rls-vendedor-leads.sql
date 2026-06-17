-- PA-11/LGPD: Restringe SELECT de leads para vendedores (minimização de acesso)
-- Antes: vendedor lê todos os leads não deletados (filtro apenas no frontend)
-- Depois: vendedor recebe do banco apenas os seus próprios leads
-- Marketing mantém acesso total.
-- Idempotente: seguro executar múltiplas vezes.

drop policy if exists "leads_select" on public.leads;
create policy "leads_select" on public.leads for select to authenticated
  using (
    deletado = false
    and (
      public.papel_atual() = 'marketing'
      or (public.papel_atual() = 'vendedor' and vendedor_id = auth.uid())
    )
  );
