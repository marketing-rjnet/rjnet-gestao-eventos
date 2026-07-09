-- =============================================================
-- Demanda por região: relatório agregado interno (Simulador F5)
-- =============================================================
-- Rode no SQL Editor do Supabase APÓS migracao-simulador.sql.
-- Idempotente: pode rodar mais de uma vez sem erro.
--
-- Depois de aplicar, rode: NOTIFY pgrst, 'reload schema';
--
-- Inteligência territorial (D-073): campanhas geolocalizadas (tipo
-- 'territorial' do Simulador) captam cidade/bairro/interesse; este RPC
-- agrega a contagem de interessados por região para a diretoria. É só
-- COUNT — nenhum dado pessoal sai da função. NUNCA expõe cobertura de
-- rede (esse dado nem existe no sistema). Restrito a authenticated
-- (mesmo padrão de ranking_mes); o relatório é renderizado em
-- Relatórios (LeadsTab), tela que só marketing/comercial enxergam.

create or replace function public.demanda_por_regiao()
returns table (cidade text, bairro text, total bigint)
language sql stable
security definer set search_path = public
as $$
  select
    coalesce(nullif(trim(l.cidade), ''), '(não informado)') as cidade,
    coalesce(nullif(trim(l.bairro), ''), '(não informado)') as bairro,
    count(*)::bigint as total
  from public.leads l
  where l.deletado = false
    and l.origem is not null
    and (nullif(trim(l.cidade), '') is not null or nullif(trim(l.bairro), '') is not null)
    and public.papel_atual() is not null
  group by 1, 2
  order by 1, total desc
$$;

revoke all on function public.demanda_por_regiao() from public, anon;
grant execute on function public.demanda_por_regiao() to authenticated;

-- =============================================================
-- Verificação
-- =============================================================
-- select * from demanda_por_regiao();
