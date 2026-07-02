-- =============================================================
-- D-058: Captação de leads no dia a dia — "mês de referência"
-- =============================================================
-- Contexto: além dos leads vinculados a um evento de campo, o
-- vendedor passa a poder registrar leads no dia a dia, associados
-- a um mês de referência (12 meses, sem evento nenhum envolvido).
--
-- Um lead pertence a exatamente UM dos dois contextos:
--   - evento_id      (fluxo já existente, inalterado)
--   - mes_referencia (novo fluxo — primeiro dia do mês, ex: 2026-07-01)
--
-- Não altera nenhuma policy de RLS: leads_select/insert/update/delete
-- já checam apenas papel_atual()/vendedor_id, nunca evento_id — um
-- lead com evento_id = null já é aceito pelas policies atuais.
--
-- Como aplicar: Supabase Dashboard → SQL Editor → cole tudo → Run.
-- Depois, rodar `NOTIFY pgrst, 'reload schema';` (ou Dashboard →
-- Settings → API → Reload schema) para o PostgREST enxergar a
-- coluna/RPC novas imediatamente (gotcha documentado no D-057).
-- Idempotente: seguro executar mais de uma vez.
-- =============================================================

-- ─── 1. Coluna mes_referencia em leads ────────────────────────

alter table public.leads
  add column if not exists mes_referencia date;

-- Garante que todo lead pertence a exatamente um dos dois contextos.
-- Leads existentes têm evento_id preenchido e mes_referencia nulo,
-- então a constraint já nasce satisfeita.
alter table public.leads drop constraint if exists leads_evento_xor_mes;
alter table public.leads
  add constraint leads_evento_xor_mes check (num_nonnulls(evento_id, mes_referencia) = 1);

create index if not exists idx_leads_mes_referencia on public.leads (mes_referencia);
create index if not exists idx_leads_mes_deletado on public.leads (mes_referencia, deletado);
create index if not exists idx_leads_mes_deletado_vendedor on public.leads (mes_referencia, deletado, vendedor_nome);

-- ─── 2. Placar por mês (mesmo padrão de ranking_evento) ───────

create or replace function public.ranking_mes(mref date)
returns table (vendedor_nome text, total bigint)
language sql stable
security definer set search_path = public
as $$
  select l.vendedor_nome, count(*)::bigint as total
  from public.leads l
  where l.mes_referencia = mref
    and l.deletado = false
    and public.papel_atual() is not null
  group by l.vendedor_nome
  order by total desc
$$;

revoke all on function public.ranking_mes(date) from public, anon;
grant execute on function public.ranking_mes(date) to authenticated;

-- ─── 3. oferta_envios: indicador de envio também por mês (D-057) ──

alter table public.oferta_envios
  add column if not exists mes_referencia date;

create index if not exists idx_oferta_envios_mes on public.oferta_envios (mes_referencia);

-- ─── 4. Retenção LGPD: leads de mês também expiram (PA-10) ────

insert into public.configuracoes_retencao (chave, valor_dias, descricao) values
  ('retencao_leads_mensais_dias', 365, 'Dias após o fim do mês de referência para exclusão física dos leads sem evento')
on conflict (chave) do nothing;

create or replace function public.limpar_leads_expirados()
returns jsonb language plpgsql security definer as $$
declare
  dias_deletados   integer;
  dias_encerrados  integer;
  dias_mensais     integer;
  total_deletados  integer;
  total_encerrados integer;
  total_mensais    integer;
begin
  select valor_dias into dias_deletados   from public.configuracoes_retencao where chave = 'retencao_leads_deletados_dias';
  select valor_dias into dias_encerrados  from public.configuracoes_retencao where chave = 'retencao_leads_evento_encerrado_dias';
  select valor_dias into dias_mensais     from public.configuracoes_retencao where chave = 'retencao_leads_mensais_dias';

  -- Exclui fisicamente leads com soft delete expirado
  delete from public.leads
  where deletado = true
    and deletado_em < now() - (dias_deletados || ' days')::interval;
  get diagnostics total_deletados = row_count;

  -- Exclui fisicamente leads de eventos encerrados há mais de N dias
  delete from public.leads l
  using public.eventos e
  where l.evento_id = e.id
    and e.status = 'encerrado'
    and e.data_fim < now() - (dias_encerrados || ' days')::interval
    and l.deletado = false;
  get diagnostics total_encerrados = row_count;

  -- D-058: exclui fisicamente leads de mês cujo mês de referência
  -- terminou há mais de N dias (mesma lógica de "evento encerrado há N dias")
  delete from public.leads
  where mes_referencia is not null
    and deletado = false
    and (mes_referencia + interval '1 month') < now() - (dias_mensais || ' days')::interval;
  get diagnostics total_mensais = row_count;

  return jsonb_build_object(
    'executado_em',        now(),
    'leads_deletados_fisicamente', total_deletados,
    'leads_evento_expirado',       total_encerrados,
    'leads_mes_expirado',          total_mensais
  );
end;
$$;

-- =============================================================
-- Verificação
-- =============================================================
-- select * from ranking_mes('2026-07-01');
-- select * from configuracoes_retencao where chave = 'retencao_leads_mensais_dias';
-- select conname from pg_constraint where conname = 'leads_evento_xor_mes';
