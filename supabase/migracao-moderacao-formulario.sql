-- =============================================================
-- Moderação do formulário público: IP de origem para rastreabilidade
-- e suporte ao rate limiting da Edge Function submeter-formulario
-- =============================================================
-- Rode no SQL Editor do Supabase APÓS migracao-campos-personalizados.sql.
-- Idempotente: pode rodar mais de uma vez sem erro.
--
-- O que faz:
--   1. Adiciona `leads.origem_ip` — IP de quem enviou o lead pela Edge
--      Function pública (submeter-formulario). Só preenchido para
--      origem='formulario'; nunca gravado pelo app autenticado
--      (vendedor/marketing/comercial não passam por esse campo).
--      Fecha o gap "IP do aceite de consentimento: AUSENTE" apontado em
--      doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md §3.3 — evidência de quem
--      forneceu o consentimento, e suporte a moderação/denúncia de abuso.
--   2. Índice (origem_ip, criado_em) — usado pela própria Edge Function
--      para contar submissões recentes por IP antes de cada insert
--      (rate limit: 5 submissões / 10 min por IP, sem tabela nova).
--
-- Dado pessoal (LGPD): reter só enquanto o lead correspondente existir —
-- já é apagado junto pela retenção existente (migracao-qrcode-retencao.sql,
-- baseada em criado_em para leads sem evento/mês). Nenhuma retenção extra
-- necessária: origem_ip é uma coluna do próprio lead, não um registro à parte.
--
-- Depois de aplicar, rode:
--   NOTIFY pgrst, 'reload schema';
-- (ou Dashboard → Settings → API → Reload schema)
-- =============================================================

alter table public.leads
  add column if not exists origem_ip text;

create index if not exists idx_leads_origem_ip_criado_em
  on public.leads (origem_ip, criado_em)
  where origem_ip is not null;

-- =============================================================
-- Verificação
-- =============================================================
-- select column_name, data_type from information_schema.columns
--   where table_name = 'leads' and column_name = 'origem_ip';
