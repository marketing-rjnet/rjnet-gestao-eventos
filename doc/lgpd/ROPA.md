# ROPA — Registro de Operações de Tratamento de Dados Pessoais

> **Versão:** 1.1  
> **Data:** 2026-07-07  
> **PA-18/LGPD** — Elaborado como parte do Plano de Ação LGPD da RJNet.  
> **Controlador:** RJNet Telecomunicações Ltda.  
> **Referência:** art. 37 LGPD — obrigação de manutenção de registro das operações de tratamento

---

## Operação 1 — Captação de Leads em Eventos e no Dia a Dia

> **Atualização 2026-07-02 (D-058):** além dos leads capturados presencialmente em eventos de campo, o vendedor passou a poder registrar leads no dia a dia (atividade comercial contínua, fora de evento), associados a um mês de referência em vez de um evento. A finalidade, a base legal e as categorias de dados são as mesmas — muda apenas o vínculo de contexto (`evento_id` → `mes_referencia`) e o prazo de retenção correspondente.
>
> **Atualização 2026-07-06 (D-061):** leads capturados nesta operação (evento/mês, sempre mediados por um vendedor) podem carregar um atributo adicional de proveniência — `origem`/`qr_code_id`/`qr_code_label` — quando o vendedor os associa a um QR Code de campo. Isso não altera finalidade/base legal/titulares desta operação; é só um metadado extra. **Não confundir com a Operação 5** (captação pública sem vendedor, ver abaixo), que é uma operação de tratamento estruturalmente diferente.

| Campo | Valor |
|-------|-------|
| **Nome da operação** | Captação e gestão de leads comerciais em eventos presenciais e na atividade comercial do dia a dia |
| **Finalidade** | Contato comercial para apresentação e venda de serviços RJNet (internet residencial, empresarial, móvel, streamings) |
| **Base legal** | Consentimento — art. 7°, I LGPD |
| **Categorias de titulares** | Pessoas físicas abordadas em eventos de campo da RJNet ou no dia a dia comercial dos vendedores |
| **Categorias de dados** | Nome, telefone, CPF (opcional), endereço (opcional), bairro (D-062), serviço de interesse, temperatura do lead, observações do vendedor, data/hora da captação, consentimento e versão do termo, atributo de proveniência opcional (`origem`/`qr_code_id`/`qr_code_label`, D-061) |
| **Dados sensíveis?** | Não |
| **Destinatários internos** | Equipe de marketing/comercial (acesso total — D-059) e vendedores (apenas próprios leads) |
| **Destinatários externos** | Supabase Inc. (armazenamento — EUA) |
| **Transferência internacional** | Sim — EUA (Supabase Inc.) — base legal: art. 33, II LGPD (DPA pendente assinatura formal) |
| **Prazo de retenção** | 90 dias após soft delete; 365 dias após encerramento do evento (leads de evento) ou após o fim do mês de referência (leads do dia a dia, D-058); exclusão automática por rotina diária |
| **Medidas de segurança** | RLS por papel, MFA TOTP, criptografia da fila offline (AES-GCM 256), audit log de operações, log de exportações CSV |
| **Sistema** | RJNet Gestão de Eventos — `src/apps/VendedorApp.jsx`, `src/lib/dataService.js` |

---

## Operação 5 — Captação Pública sem Sessão (Form Builder / QR Code)

> **Nova operação — 2026-07-06/07 (D-062, D-063, D-067).** Estruturalmente diferente da Operação 1: aqui o **próprio titular** submete os dados diretamente, sem mediação de um vendedor e sem sessão autenticada. É o primeiro caminho de escrita não-autenticado do sistema.

| Campo | Valor |
|-------|-------|
| **Nome da operação** | Captação pública de leads via formulário dinâmico (Form Builder) com QR Code/link próprio |
| **Finalidade** | Contato comercial para apresentação e venda de serviços RJNet, a partir de auto-submissão do titular (ex.: QR Code em material impresso/digital) |
| **Base legal** | Consentimento — art. 7°, I LGPD — o titular preenche e envia o próprio formulário (consentimento direto, não mediado) |
| **Categorias de titulares** | Visitantes públicos anônimos que acessam um link/QR Code de formulário RJNet — não necessariamente abordados presencialmente |
| **Categorias de dados** | Catálogo fixo configurável por formulário (`CAMPOS_FORMULARIO`: nome, telefone, endereço, bairro, CPF, serviço de interesse), campos personalizados de texto livre definidos pelo marketing (`campos_extras`, D-063), endereço IP de origem (`origem_ip`, D-067, só para fins de moderação/rate limit) |
| **Dados sensíveis?** | Não — mas `campos_extras` é texto livre definido ad hoc pela equipe, sem catálogo fixo de tipos; requer atenção equivalente à do campo `observação` (ver PA-21) |
| **Destinatários internos** | Equipe de marketing/comercial (fila "Leads sem vendedor" até distribuição manual) |
| **Destinatários externos** | Supabase Inc. (armazenamento — EUA) |
| **Transferência internacional** | Sim — EUA (Supabase Inc.) — mesma base legal e mesma pendência de DPA da Operação 1 |
| **Prazo de retenção** | Sem "fim de contexto" (não há evento/mês associado) — expira por `criado_em` conforme retenção padrão (D-064); `origem_ip` não tem retenção própria, é apagado junto do lead |
| **Medidas de segurança** | Escrita via Edge Function `submeter-formulario` com `service_role` (nunca `anon key` direta); bloqueio de link em texto livre (client + servidor); rate limit de 5 submissões/10min por IP; honeypot antispam; leitura pública (`anon`) restrita a `formularios`/`campos_personalizados` com `ativo=true`, sem dado de titular — só metadado do formulário |
| **Sistema** | `src/public/FormularioPublico.jsx`, `supabase/functions/submeter-formulario/index.ts`, `src/api/formularioApi.js`, `src/api/campoPersonalizadoApi.js` |

---

## Operação 2 — Exportação de Dados para Equipe Técnica

| Campo | Valor |
|-------|-------|
| **Nome da operação** | Exportação de leads em CSV para equipe técnica e comercial |
| **Finalidade** | Análise comercial, follow-up e visita técnica (CPF incluído quando disponível) |
| **Base legal** | Consentimento (art. 7°, I) — os dados exportados foram coletados com consentimento do titular |
| **Categorias de titulares** | Leads cadastrados no sistema |
| **Categorias de dados** | Nome, CPF, telefone, endereço, serviço de interesse, temperatura, vendedor, evento ou mês de referência (D-058) |
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
| `campos_extras` (Operação 5) — mesmo tipo de risco de coleta excessiva que "observações", ainda não incluído formalmente na revisão PA-21 | 🔴 Pendente | PA-21 |
| DPA Supabase — transferência internacional sem garantia formal | 🟡 Em andamento | PA-14 |
| Aprovação do ROPA pelo DPO após nomeação (agora cobrindo também a Operação 5) | 🔴 Pendente | PA-19 |

---

## Histórico de Revisões

| Versão | Data | Autor | Alterações |
|--------|------|-------|-----------|
| 1.0 | 2026-06-16 | Equipe técnica RJNet | Versão inicial — PA-18/LGPD |
| 1.1 | 2026-07-07 | Equipe técnica RJNet | Adiciona Operação 5 (captação pública via Form Builder/QR Code, D-061–D-063, D-067); atualiza Operação 1 com atributo de proveniência e campo `bairro` |

---

> Atualizar este documento sempre que uma nova operação de tratamento for iniciada ou alterada.  
> Referência: `doc/lgpd/PLANO_DE_ACAO_LGPD.md` — PA-18.
