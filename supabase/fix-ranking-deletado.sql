-- =============================================================
-- QW-001 / PA-NEW-001: Fix ranking_evento — filtrar leads deletados
-- =============================================================
-- Problema: a função ranking_evento executa com SECURITY DEFINER
-- (bypassa RLS) e não filtra `deletado = false`. Leads excluídos
-- via soft delete continuam sendo contados no placar.
--
-- Correção: adicionar `AND l.deletado = false` à cláusula WHERE.
--
-- Impacto: zero no frontend — apenas remove registros inválidos
-- do resultado. Sem alteração de contrato de API.
--
-- Como aplicar: Supabase Dashboard → SQL Editor → Run.
-- Idempotente: pode rodar mais de uma vez.
-- =============================================================

create or replace function public.ranking_evento(eid text)
returns table (vendedor_nome text, total bigint)
language sql stable
security definer set search_path = public
as $$
  select l.vendedor_nome, count(*)::bigint as total
  from public.leads l
  where l.evento_id = eid
    and l.deletado = false
    and public.papel_atual() is not null
  group by l.vendedor_nome
  order by total desc
$$;

revoke all on function public.ranking_evento(text) from public, anon;
grant execute on function public.ranking_evento(text) to authenticated;

-- Verificação: o placar deve retornar apenas leads não deletados
-- Rodar manualmente para validar (substituir 'SEU_EVENTO_ID'):
-- select * from ranking_evento('SEU_EVENTO_ID');
