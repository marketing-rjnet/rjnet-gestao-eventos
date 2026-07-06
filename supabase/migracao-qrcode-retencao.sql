-- =============================================================
-- QR Code: retenção LGPD para leads sem evento nem mês (PA-10)
-- =============================================================
-- Rode no SQL Editor do Supabase APÓS migracao-qrcode.sql.
-- Idempotente: pode rodar mais de uma vez sem erro.
--
-- Contexto: migracao-qrcode.sql relaxou a constraint leads_evento_xor_mes
-- para aceitar leads sem evento_id NEM mes_referencia (QR Code e futuros
-- canais frios). limpar_leads_expirados() (migracao-leads-mensais.sql) só
-- tinha 3 blocos — soft-delete expirado, evento encerrado há N dias, mês
-- encerrado há N dias — nenhum cobre um lead com os dois nulos. Sem este
-- 4º bloco, leads de QR Code nunca seriam expurgados automaticamente.
--
-- Base de contagem: como esses leads não têm "fim de contexto" (não há
-- data de encerramento de evento nem fim de mês), a janela conta a partir
-- de criado_em — mesma janela padrão de 365 dias da retenção mensal.
-- =============================================================

insert into public.configuracoes_retencao (chave, valor_dias, descricao) values
  ('retencao_leads_sem_contexto_dias', 365, 'Dias após a criação para exclusão física de leads sem evento nem mês (QR Code e futuros canais frios) quando não convertidos')
on conflict (chave) do nothing;

create or replace function public.limpar_leads_expirados()
returns jsonb language plpgsql security definer as $$
declare
  dias_deletados      integer;
  dias_encerrados     integer;
  dias_mensais        integer;
  dias_sem_contexto   integer;
  total_deletados     integer;
  total_encerrados    integer;
  total_mensais       integer;
  total_sem_contexto  integer;
begin
  select valor_dias into dias_deletados     from public.configuracoes_retencao where chave = 'retencao_leads_deletados_dias';
  select valor_dias into dias_encerrados    from public.configuracoes_retencao where chave = 'retencao_leads_evento_encerrado_dias';
  select valor_dias into dias_mensais       from public.configuracoes_retencao where chave = 'retencao_leads_mensais_dias';
  select valor_dias into dias_sem_contexto  from public.configuracoes_retencao where chave = 'retencao_leads_sem_contexto_dias';

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

  -- QR Code (e futuros canais sem evento/mês): expira a partir de criado_em,
  -- já que não existe uma data de "fim de contexto" para esses leads.
  delete from public.leads
  where evento_id is null
    and mes_referencia is null
    and deletado = false
    and criado_em < now() - (dias_sem_contexto || ' days')::interval;
  get diagnostics total_sem_contexto = row_count;

  return jsonb_build_object(
    'executado_em',                now(),
    'leads_deletados_fisicamente',  total_deletados,
    'leads_evento_expirado',        total_encerrados,
    'leads_mes_expirado',           total_mensais,
    'leads_sem_contexto_expirado',  total_sem_contexto
  );
end;
$$;

-- =============================================================
-- Verificação
-- =============================================================
-- select * from configuracoes_retencao where chave = 'retencao_leads_sem_contexto_dias';
-- select limpar_leads_expirados();
