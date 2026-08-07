-- =============================================================
-- Demanda por região por TEMA (D-096): filtro opcional por campanha
-- =============================================================
-- Rode no SQL Editor do Supabase APÓS migracao-demanda.sql.
-- Idempotente: pode rodar mais de uma vez sem erro.
--
-- Depois de aplicar, rode: NOTIFY pgrst, 'reload schema';
--
-- Contexto: `demanda_por_regiao()` (D-073) agregava TODOS os leads com
-- cidade/bairro juntos, sem distinguir de qual campanha do Simulador cada
-- interessado veio — 2 ações diferentes (ex: "MÊS DA JUVENTUDE" e "ARRAIA
-- DA CIDADE") apareciam somadas na mesma linha de cidade/bairro. D-096
-- adiciona um parâmetro opcional `p_simulador_id`: quando informado, o
-- agregado passa a contar só os interessados daquela campanha (tema);
-- quando omitido/nulo, o comportamento é idêntico ao de antes (soma tudo).
--
-- IMPORTANTE: `simuladores.id`/`leads.simulador_id` são `text`, não `uuid`
-- (ver migracao-simulador.sql — slug-like, gerado no cliente), então o
-- parâmetro do filtro também é `text`.
--
-- A função antiga (aridade 0) é substituída por uma nova de aridade 1 com
-- DEFAULT — não são a mesma assinatura para o Postgres, por isso o DROP
-- explícito antes do CREATE (evita ficar com as duas versões coexistindo).

drop function if exists public.demanda_por_regiao();

create or replace function public.demanda_por_regiao(p_simulador_id text default null)
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
    and (p_simulador_id is null or l.simulador_id = p_simulador_id)
    and public.papel_atual() is not null
  group by 1, 2
  order by 1, total desc
$$;

revoke all on function public.demanda_por_regiao(text) from public, anon;
grant execute on function public.demanda_por_regiao(text) to authenticated;

-- =============================================================
-- Verificação
-- =============================================================
-- select * from demanda_por_regiao();                        -- tudo, como antes
-- select * from demanda_por_regiao('<id-da-campanha>');       -- só 1 tema
