# ROPA — Registro de Operações de Tratamento de Dados Pessoais

> **Versão:** 1.0  
> **Data:** 2026-06-16  
> **PA-18/LGPD** — Elaborado como parte do Plano de Ação LGPD da RJNet.  
> **Controlador:** RJNet Telecomunicações Ltda.  
> **Referência:** art. 37 LGPD — obrigação de manutenção de registro das operações de tratamento

---

## Operação 1 — Captação de Leads em Eventos

| Campo | Valor |
|-------|-------|
| **Nome da operação** | Captação e gestão de leads comerciais em eventos presenciais |
| **Finalidade** | Contato comercial para apresentação e venda de serviços RJNet (internet residencial, empresarial, móvel, streamings) |
| **Base legal** | Consentimento — art. 7°, I LGPD |
| **Categorias de titulares** | Pessoas físicas abordadas em eventos de campo da RJNet |
| **Categorias de dados** | Nome, telefone, CPF (opcional), endereço (opcional), serviço de interesse, temperatura do lead, observações do vendedor, data/hora da captação, consentimento e versão do termo |
| **Dados sensíveis?** | Não |
| **Destinatários internos** | Equipe de marketing (acesso total) e vendedores (apenas próprios leads) |
| **Destinatários externos** | Supabase Inc. (armazenamento — EUA) |
| **Transferência internacional** | Sim — EUA (Supabase Inc.) — base legal: art. 33, II LGPD (DPA pendente assinatura formal) |
| **Prazo de retenção** | 90 dias após soft delete; 365 dias após encerramento do evento; exclusão automática por rotina diária |
| **Medidas de segurança** | RLS por papel, MFA TOTP, criptografia da fila offline (AES-GCM 256), audit log de operações, log de exportações CSV |
| **Sistema** | RJNet Gestão de Eventos — `src/apps/VendedorApp.jsx`, `src/lib/dataService.js` |

---

## Operação 2 — Exportação de Dados para Equipe Técnica

| Campo | Valor |
|-------|-------|
| **Nome da operação** | Exportação de leads em CSV para equipe técnica e comercial |
| **Finalidade** | Análise comercial, follow-up e visita técnica (CPF incluído quando disponível) |
| **Base legal** | Consentimento (art. 7°, I) — os dados exportados foram coletados com consentimento do titular |
| **Categorias de titulares** | Leads cadastrados no sistema |
| **Categorias de dados** | Nome, CPF, telefone, endereço, serviço de interesse, temperatura, vendedor, evento |
| **Dados sensíveis?** | Não |
| **Destinatários internos** | Usuários com papel `marketing` |
| **Destinatários externos** | Nenhum via sistema — exportação manual (responsabilidade do operador após o download) |
| **Transferência internacional** | Não — arquivo CSV permanece sob controle da RJNet |
| **Prazo de retenção** | Conforme política de retenção da operação 1 |
| **Medidas de segurança** | Exportação restrita a papel `marketing`; log de auditoria registra usuário, filtros e quantidade exportada |
| **Sistema** | `src/utils/csv.js`, `src/features/leads/LeadsTab.jsx` |

---

## Operação 3 — Autenticação de Usuários Internos

| Campo | Valor |
|-------|-------|
| **Nome da operação** | Autenticação e controle de acesso de usuários internos |
| **Finalidade** | Controle de acesso ao sistema com segregação por papel (marketing/vendedor) |
| **Base legal** | Execução de contrato de trabalho / prestação de serviços — art. 7°, V LGPD |
| **Categorias de titulares** | Colaboradores e prestadores da RJNet com acesso ao sistema |
| **Categorias de dados** | E-mail, hash de senha (Supabase Auth), papel, nome, status ativo/inativo |
| **Dados sensíveis?** | Não |
| **Destinatários internos** | Usuários com papel `marketing` (gestão de usuários) |
| **Destinatários externos** | Supabase Inc. (autenticação — EUA) |
| **Transferência internacional** | Sim — EUA (Supabase Auth) — base legal: art. 33, II LGPD |
| **Prazo de retenção** | Enquanto o colaborador tiver vínculo ativo; revogação imediata pelo marketing |
| **Medidas de segurança** | MFA TOTP disponível; sessão com expiração automática; RLS impede acesso entre papéis |
| **Sistema** | `src/auth/`, `supabase/migracao-auth.sql` |

---

## Operação 4 — Auditoria de Operações em Dados Pessoais

| Campo | Valor |
|-------|-------|
| **Nome da operação** | Log de auditoria de operações (INSERT, UPDATE, DELETE) em leads |
| **Finalidade** | Rastreabilidade, detecção de acesso indevido e conformidade LGPD |
| **Base legal** | Cumprimento de obrigação legal — art. 7°, II LGPD |
| **Categorias de titulares** | Colaboradores que operam o sistema (usuário auditado) e titulares dos leads (dados antes/depois) |
| **Categorias de dados** | ID do usuário, nome do usuário, ação realizada, dados antes e depois da operação (JSONB), timestamp |
| **Dados sensíveis?** | Não — mas contém cópia dos dados pessoais de leads no campo `dados_antes`/`dados_depois` |
| **Destinatários internos** | Usuários com papel `marketing` (leitura) |
| **Destinatários externos** | Supabase Inc. (armazenamento — EUA) |
| **Transferência internacional** | Sim — EUA (Supabase) |
| **Prazo de retenção** | Não definido formalmente — recomendado mínimo 2 anos para fins de auditoria ⚠️ |
| **Medidas de segurança** | RLS restrita a marketing; gravação via trigger SECURITY DEFINER (não contornável pela aplicação) |
| **Sistema** | `supabase/migracao-audit-log.sql` |

---

## Pendências de Revisão

| Item | Status | PA |
|------|--------|-----|
| Prazo de retenção do audit_log não definido formalmente | 🔴 Pendente | — |
| Campo "observações" — revisão de coleta excessiva | 🔴 Pendente | PA-21 |
| DPA Supabase — transferência internacional sem garantia formal | 🟡 Em andamento | PA-14 |
| Aprovação do ROPA pelo DPO após nomeação | 🔴 Pendente | PA-19 |

---

## Histórico de Revisões

| Versão | Data | Autor | Alterações |
|--------|------|-------|-----------|
| 1.0 | 2026-06-16 | Equipe técnica RJNet | Versão inicial — PA-18/LGPD |

---

> Atualizar este documento sempre que uma nova operação de tratamento for iniciada ou alterada.  
> Referência: `doc/PLANO_DE_ACAO_LGPD.md` — PA-18.
