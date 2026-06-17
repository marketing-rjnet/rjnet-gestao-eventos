-- PA-10/LGPD: Política de retenção automática de dados pessoais (L-04, BD-05, L-06)
-- Remove fisicamente leads que excederam o período de retenção.
-- Padrões adotados (ajustar conforme decisão jurídica):
--   - Leads com soft delete há mais de 90 dias → exclusão física
--   - Leads de eventos encerrados há mais de 365 dias → exclusão física
-- Idempotente: seguro executar múltiplas vezes.

-- 1. Habilitar extensão de agendamento (requer permissão de superuser no Supabase)
create extension if not exists pg_cron;

-- 2. Tabela de configuração de retenção (permite ajuste sem deploy)
create table if not exists public.configuracoes_retencao (
  chave        text primary key,
  valor_dias   integer not null,
  descricao    text,
  atualizado_em timestamptz not null default now()
);

-- Valores padrão — ajustar conforme decisão jurídica/negócio
insert into public.configuracoes_retencao (chave, valor_dias, descricao) values
  ('retencao_leads_deletados_dias',        90,  'Dias após soft delete para exclusão física do lead'),
  ('retencao_leads_evento_encerrado_dias', 365, 'Dias após encerramento do evento para exclusão física dos leads')
on conflict (chave) do nothing;

-- RLS: apenas marketing consulta configurações
alter table public.configuracoes_retencao enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'configuracoes_retencao' and policyname = 'retencao_select'
  ) then
    create policy "retencao_select" on public.configuracoes_retencao
      for select to authenticated using (public.papel_atual() = 'marketing');
  end if;
end $$;

-- 3. Função de limpeza — chamada pelo pg_cron
create or replace function public.limpar_leads_expirados()
returns jsonb language plpgsql security definer as $$
declare
  dias_deletados   integer;
  dias_encerrados  integer;
  total_deletados  integer;
  total_encerrados integer;
begin
  select valor_dias into dias_deletados   from public.configuracoes_retencao where chave = 'retencao_leads_deletados_dias';
  select valor_dias into dias_encerrados  from public.configuracoes_retencao where chave = 'retencao_leads_evento_encerrado_dias';

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

  return jsonb_build_object(
    'executado_em',        now(),
    'leads_deletados_fisicamente', total_deletados,
    'leads_evento_expirado',       total_encerrados
  );
end;
$$;

-- 4. Agendamento: executa toda madrugada às 02:00 (horário UTC)
-- Remove job anterior se existir para ser idempotente
select cron.unschedule('lgpd-limpar-leads-expirados') where exists (
  select 1 from cron.job where jobname = 'lgpd-limpar-leads-expirados'
);

select cron.schedule(
  'lgpd-limpar-leads-expirados',
  '0 5 * * *',  -- 02:00 BRT (UTC-3) = 05:00 UTC
  $$ select public.limpar_leads_expirados(); $$
);
