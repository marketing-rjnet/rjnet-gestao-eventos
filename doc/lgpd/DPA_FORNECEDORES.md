# DPA de Fornecedores — RJNet Gestão de Eventos

> **PA-14/LGPD** — Registro de acordos de processamento de dados com fornecedores que recebem dados pessoais de titulares brasileiros.

---

## Supabase Inc.

| Campo | Valor |
|-------|-------|
| **Fornecedor** | Supabase Inc. |
| **País** | Estados Unidos (EUA) |
| **Serviço** | Banco de dados PostgreSQL, autenticação, realtime e Edge Functions |
| **Dados transferidos** | Nome, telefone, CPF (opcional), endereço, temperatura de lead, serviço de interesse, dados de autenticação (e-mail, hash de senha) |
| **Base legal (LGPD)** | Art. 33, II — garantias contratuais adequadas (DPA) |
| **DPA disponível em** | https://supabase.com/privacy (Data Processing Agreement) |
| **Status DPA** | 🔴 DPA formal indisponível no Free Plan — risco a mitigar |
| **Certificações** | SOC 2 Type II, ISO 27001 (verificar atualização em https://security.supabase.com) |

### Situação atual (Free Plan)

O Supabase **não disponibiliza DPA com assinatura formal no plano gratuito**. O DPA separado está disponível apenas a partir do **Pro Plan** (pago).

A base contratual atual é coberta pelos **Terms of Service** do Supabase, que incluem cláusulas de proteção de dados, mas sem o nível de formalização exigido para transferência internacional sob o art. 33, II da LGPD.

### Risco identificado

> **Risco:** transferência internacional de dados pessoais (EUA) sem DPA formal — não conformidade com art. 33, II da LGPD enquanto no Free Plan.

### Opções para mitigação

| Opção | Descrição |
|-------|-----------|
| **1. Upgrade para Pro Plan** | Habilita DPA formal com Supabase — recomendado para produção com dados reais |
| **2. Permanecer no Free Plan** | Aceitável apenas em fase de testes/piloto sem dados reais de titulares |
| **3. Migrar para servidor no Brasil** | Elimina a transferência internacional — alternativa mais complexa |

### Próxima ação

- Se o sistema entrar em produção com dados reais: **fazer upgrade para o Pro Plan** e assinar o DPA.
- Registrar aqui a data e referência após assinatura:
  - **Data de assinatura:** _preencher após upgrade_
  - **Referência/número:** _preencher após upgrade_

---

## Vercel Inc.

| Campo | Valor |
|-------|-------|
| **Fornecedor** | Vercel Inc. |
| **País** | Estados Unidos (EUA) |
| **Serviço** | Hospedagem do frontend (SPA estático) |
| **Dados transferidos** | Nenhum dado pessoal — apenas arquivos estáticos JS/CSS/HTML |
| **Base legal** | Não aplicável — nenhum dado pessoal processado pelo Vercel |
| **DPA** | Não necessário para a função atual |

---

> Atualizar este documento sempre que um novo fornecedor com acesso a dados pessoais for contratado.
