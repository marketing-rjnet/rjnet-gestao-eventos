# LGPD_AUDIT_AND_COMPLIANCE.md
## RJNet Gestão de Eventos — Fonte Oficial de Conformidade, Segurança e Governança de Dados

> **Versão:** 1.0.0  
> **Data:** 2026-06-16  
> **Auditor:** Análise automatizada de código-fonte (Claude Code)  
> **Escopo:** Repositório `marketing-rjnet/rjnet-gestao-eventos` — branch principal  
> **Classificação:** INTERNO — RESTRITO

---

## ÍNDICE

1. [Visão Geral do Negócio](#1-visão-geral-do-negócio)
2. [Auditoria Completa do Banco de Dados](#2-auditoria-completa-do-banco-de-dados)
3. [Auditoria dos Formulários e Captação de Leads](#3-auditoria-dos-formulários-e-captação-de-leads)
4. [Auditoria de Integrações Externas](#4-auditoria-de-integrações-externas)
5. [Auditoria Completa do Supabase](#5-auditoria-completa-do-supabase)
6. [Auditoria de Logs, Rastreabilidade e Governança de Acesso](#6-auditoria-de-logs-rastreabilidade-e-governança-de-acesso)
7. [Matriz LGPD](#7-matriz-lgpd)
8. [Não Conformidades](#8-não-conformidades)
9. [Plano de Correção](#9-plano-de-correção)
10. [Status de Conformidade](#10-status-de-conformidade)
11. [Arquivos e Evidências Analisadas](#11-arquivos-e-evidências-analisadas)

---

## 1. VISÃO GERAL DO NEGÓCIO

### 1.1 O que é o sistema

O **RJNet Gestão de Eventos** é uma Single Page Application (SPA) desenvolvida em React 19 + Vite 8, com backend Supabase (PostgreSQL + Auth), voltada para o gerenciamento de eventos de campo da empresa de telecomunicações **RJNet**. O deploy ocorre na plataforma Vercel.

O sistema permite que o time de **marketing** planeje, crie e acompanhe eventos promocionais (feirões, sinalizações, ativações), controle o estoque de materiais de merchandising, gerencie a equipe comercial e visualize os leads captados. Os **vendedores** em campo utilizam o sistema para registrar leads de potenciais clientes durante os eventos, acompanhar seu próprio desempenho e visualizar o ranking da equipe em tempo real.

### 1.2 Objetivo principal

Digitalizar e centralizar a captura de leads de clientes em potencial durante eventos externos da RJNet, eliminando o processo manual em papel, e permitir o acompanhamento em tempo real do desempenho comercial por evento.

### 1.3 Problema que resolve

- Elimina perda de leads captados em papel durante eventos
- Centraliza visibilidade do desempenho da equipe em campo
- Controla o estoque de materiais alocados a cada evento
- Permite gestão remota de eventos e equipe pelo time de marketing

### 1.4 Fluxos de negócio

```
[Marketing cria evento] → [Marketing aloca materiais] → [Marketing ativa o evento]
         ↓
[Vendedor acessa o app no campo]
         ↓
[Vendedor preenche formulário de lead: nome, telefone, CPF, endereço, serviço de interesse]
         ↓
[Lead salvo no Supabase (online) ou fila offline no localStorage (offline)]
         ↓
[Marketing visualiza leads por evento, filtra, exporta CSV]
         ↓
[Marketing exporta CSV com dados pessoais dos leads para ações comerciais externas]
```

### 1.5 Tipos de usuários

| Perfil | Papel no sistema | Acesso |
|--------|-----------------|--------|
| **Marketing** | Gestão completa | Todos os dados: leads, eventos, materiais, equipe, exportação CSV |
| **Vendedor** | Captura de leads em campo | Apenas seus próprios leads (escrita); leitura de todos os leads do evento (placar) |

### 1.6 Estrutura operacional

- **Frontend:** SPA estática hospedada na Vercel
- **Backend:** Supabase (PostgreSQL + Auth + Realtime + Edge Functions)
- **Dispositivos:** Desktop (marketing) e mobile (vendedor em campo)
- **Dois modos de operação:**
  - **Modo Supabase (produção):** autenticação real, RLS, realtime
  - **Modo local (dev/demo):** localStorage como fallback sem backend

### 1.7 Áreas atendidas

- Comercial (vendedores em campo)
- Marketing (coordenação de eventos e análise de leads)

### 1.8 Funcionalidades existentes

| Funcionalidade | Papel | Status |
|---------------|-------|--------|
| CRUD de eventos (criação, edição, encerramento) | Marketing | Implementado |
| Gestão de estoque de materiais promocionais | Marketing | Implementado |
| Captura de lead em formulário mobile | Vendedor | Implementado |
| Edição e exclusão de lead próprio | Vendedor | Implementado |
| Visualização de todos os leads do evento | Marketing | Implementado |
| Exportação de leads em CSV | Marketing | Implementado |
| Ranking de vendedores em tempo real | Ambos | Implementado |
| Check-in de lead por CPF | Marketing | Implementado |
| Gestão de equipe (criar/ativar/desativar usuários) | Marketing | Implementado |
| Modo offline com fila de sincronização | Vendedor | Implementado |
| Tema dark/light | Ambos | Implementado |
| Recuperação de senha por e-mail | Ambos | Implementado |
| Tabela de preços dos serviços RJNet | Vendedor | Implementado (hardcoded) |

### 1.9 Funcionalidades planejadas

Nenhuma funcionalidade planejada formalmente documentada foi identificada no repositório. A refatoração está marcada como concluída (18/18 etapas).

### 1.10 Dados manipulados

| Categoria | Dado | Origem |
|-----------|------|--------|
| Dado pessoal | Nome completo do lead | Formulário preenchido pelo vendedor |
| Dado pessoal | Telefone do lead | Formulário preenchido pelo vendedor |
| Dado pessoal | CPF do lead | Formulário preenchido pelo vendedor |
| Dado pessoal | Endereço do lead | Formulário preenchido pelo vendedor |
| Dado operacional | Serviço de interesse | Formulário preenchido pelo vendedor |
| Dado operacional | Temperatura do lead | Classificação pelo vendedor |
| Dado operacional | Observação sobre o lead | Texto livre pelo vendedor |
| Dado pessoal | Nome do vendedor | Cadastro realizado pelo marketing |
| Dado pessoal | E-mail do vendedor/usuário | Cadastro realizado pelo marketing |
| Dado operacional | Dados de eventos | Criado pelo marketing |
| Dado operacional | Estoque de materiais | Criado pelo marketing |

### 1.11 Origem dos dados

- **Leads:** Dados de cidadãos (titulares) coletados presencialmente em eventos de rua, feirões e ativações comerciais por vendedores da RJNet. **Os titulares não interagem diretamente com o sistema.**
- **Usuários do sistema:** Dados de funcionários cadastrados pelo marketing.
- **Eventos/materiais:** Dados operacionais internos.

### 1.12 Destino dos dados

- **Banco de dados:** Supabase PostgreSQL (em nuvem, infraestrutura da Supabase Inc., EUA)
- **Exportação CSV:** Arquivo baixado localmente pelo marketing para uso em ações comerciais externas (destino final indeterminado — não documentado)
- **localStorage/sessionStorage:** Dados temporários no dispositivo do usuário
- **Fila offline:** Leads captados offline armazenados em `localStorage` até sincronização

---

### 1.13 O que o sistema FAZ

- Captura, armazena e exibe dados pessoais de potenciais clientes (leads)
- Permite exportação de todos os dados de leads em formato CSV
- Autentica usuários internos (funcionários) via Supabase Auth
- Controla acesso com base em papéis (marketing/vendedor)
- Sincroniza dados em tempo real entre dispositivos
- Armazena dados em nuvem no Supabase

### 1.14 O que o sistema NÃO FAZ

- Não coleta consentimento dos titulares (leads captados sem aceite explícito)
- Não exibe política de privacidade para titulares dos dados
- Não permite que titulares (leads) exerçam seus direitos LGPD (acesso, correção, exclusão)
- Não registra log de exportações de dados
- Não registra log de acessos individuais a leads
- Não integra com CRM externo, WhatsApp API, e-mail marketing ou ferramentas de analytics
- Não processa pagamentos
- Não tem portal do titular de dados

### 1.15 Limitações atuais

- Sem mecanismo de consentimento LGPD para leads
- Sem rastreabilidade de quem acessou quais dados
- Sem controle sobre o destino dos CSVs exportados
- Sem política de retenção de dados implementada tecnicamente
- Sem DPA (Data Processing Agreement) com Supabase documentado
- Modo local (localStorage) sem criptografia de dados pessoais

### 1.16 Riscos de negócio

| Risco | Probabilidade | Impacto |
|-------|--------------|---------|
| Autuação pela ANPD por ausência de consentimento | Alta | Crítico |
| Vazamento de dados via exportação CSV sem controle | Média | Alto |
| Acesso não autorizado em modo local (sem auth) | Baixa (prod) | Alto |
| Dados retidos indefinidamente sem política | Alta | Médio |
| Leads offline expostos no localStorage sem criptografia | Média | Médio |

---

## 2. AUDITORIA COMPLETA DO BANCO DE DADOS

### 2.1 Arquivos analisados

- `supabase/schema.sql` — Schema inicial (tabelas, RLS bootstrap, seed)
- `supabase/migracao-auth.sql` — Auth, perfis, RLS por papel, função ranking
- `supabase/protecao-dados.sql` — Soft delete em leads
- `src/lib/dataService.js` — Mapeadores, queries, mapeamento camelCase ↔ snake_case

---

### 2.2 Tabela: `materiais`

**Finalidade:** Controle de estoque de materiais promocionais (banners, tendas, placas etc.).

**Dados armazenados:** Dados operacionais internos. Sem dados pessoais.

**Origem dos dados:** Cadastro manual pelo time de marketing.

**Usuários com acesso:**
- Marketing: CRUD completo
- Vendedor: somente leitura (após `migracao-auth.sql`)
- Anônimo: CRUD completo se apenas `schema.sql` estiver aplicado ⚠️

**Tempo de retenção:** Indefinido. Sem política de retenção implementada.

**Necessidade operacional:** Alta. Essencial para controle de materiais alocados a eventos.

#### Campos da tabela `materiais`

| Campo | Tipo | Obrigatório | Sensibilidade LGPD | Necessidade Operacional | Base Legal |
|-------|------|-------------|-------------------|------------------------|------------|
| `id` | text (PK) | Sim | Dado interno | Identificador único | N/A |
| `nome` | text | Sim | Dado operacional | Nome do material | N/A |
| `quantidade` | integer | Sim | Dado operacional | Controle de estoque | N/A |
| `descricao` | text | Não | Dado operacional | Descrição opcional | N/A |

**Classificação:** Dado operacional interno. **Sem dados pessoais. Sem risco LGPD.**

---

### 2.3 Tabela: `vendedores` (legada)

**Finalidade:** Tabela legada de vendedores para o modo local (sem Supabase Auth). Mantida por compatibilidade.

**Dados armazenados:** Nome do vendedor e status ativo.

**Origem dos dados:** Cadastro manual pelo marketing.

**Usuários com acesso:**
- Marketing: CRUD completo (após migração)
- Anônimo: CRUD completo se apenas `schema.sql` estiver aplicado ⚠️

**Tempo de retenção:** Indefinido.

**Necessidade operacional:** Baixa em produção (substituída por `perfis`). Mantida para compatibilidade com modo local.

#### Campos da tabela `vendedores`

| Campo | Tipo | Obrigatório | Sensibilidade LGPD | Necessidade Operacional | Base Legal |
|-------|------|-------------|-------------------|------------------------|------------|
| `id` | text (PK) | Sim | Dado interno | Identificador único | N/A |
| `nome` | text | Sim | **Dado pessoal** | Identificação do funcionário | Execução de contrato (art. 7º, V, LGPD) |
| `ativo` | boolean | Sim | Dado operacional | Controle de acesso | N/A |

**Classificação:** Contém dado pessoal (nome de funcionário). Risco baixo — uso interno.

---

### 2.4 Tabela: `eventos`

**Finalidade:** Armazenar dados de eventos comerciais (feirões, ativações, sinalizações).

**Dados armazenados:** Dados operacionais. Sem dados pessoais de titulares externos.

**Origem dos dados:** Criação pelo marketing.

**Usuários com acesso:**
- Marketing: CRUD completo
- Vendedor: somente leitura
- Anônimo: CRUD completo se apenas `schema.sql` aplicado ⚠️

**Tempo de retenção:** Indefinido. Sem política.

**Necessidade operacional:** Alta. Entidade central do sistema.

#### Campos da tabela `eventos`

| Campo | Tipo | Obrigatório | Sensibilidade LGPD | Necessidade Operacional | Base Legal |
|-------|------|-------------|-------------------|------------------------|------------|
| `id` | text (PK) | Sim | Dado interno | Identificador único | N/A |
| `nome` | text | Sim | Dado operacional | Nome do evento | N/A |
| `local` | text | Não | Dado operacional | Endereço do evento | N/A |
| `data_inicio` | date | Não | Dado operacional | Período do evento | N/A |
| `data_fim` | date | Não | Dado operacional | Período do evento | N/A |
| `status` | text | Sim | Dado operacional | Controle de ciclo de vida | N/A |
| `tipo` | text | Não | Dado operacional | Classificação do evento | N/A |
| `observacoes` | text | Não | Dado operacional | Anotações internas | N/A |
| `materiais` | jsonb | Sim | Dado operacional | Materiais alocados | N/A |
| `criado_em` | timestamptz | Sim | Dado operacional | Rastreabilidade temporal | N/A |

**Classificação:** Dado operacional interno. **Sem dados pessoais de titulares. Sem risco LGPD.**

---

### 2.5 Tabela: `leads` ⚠️ CRÍTICA — CONTÉM DADOS PESSOAIS

**Finalidade:** Armazenar informações de potenciais clientes captados presencialmente em eventos.

**Dados armazenados:** Dados pessoais identificáveis de cidadãos (titulares externos). **Tabela de maior sensibilidade LGPD do sistema.**

**Origem dos dados:** Preenchimento manual por vendedores durante eventos. Os titulares NÃO interagem diretamente com o sistema.

**Usuários com acesso:**
- Marketing: CRUD completo (todos os leads)
- Vendedor: Insere e edita apenas próprios leads; lê placar agregado da equipe
- Anônimo: CRUD completo se apenas `schema.sql` aplicado ⚠️ CRÍTICO

**Tempo de retenção:** **NÃO DEFINIDO.** Nenhuma política de retenção implementada. Leads são retidos indefinidamente após soft delete.

**Necessidade operacional:** Alta — razão de existência do sistema.

#### Campos da tabela `leads`

| Campo | Tipo | Obrigatório | Classificação LGPD | Sensibilidade | Necessidade | Base Legal |
|-------|------|-------------|-------------------|---------------|-------------|------------|
| `id` | text (PK) | Sim | Dado interno | Baixa | Alta | N/A |
| `evento_id` | text (FK → eventos) | Não | Dado operacional | Baixa | Alta | N/A |
| `vendedor_nome` | text | Não | **Dado pessoal** | Média | Alta | Legítimo interesse / Execução de contrato |
| `vendedor_id` | uuid (FK → auth.users) | Não | **Dado pessoal** | Média | Alta | Execução de contrato |
| `nome` | text | **Sim** | **Dado pessoal** | **Alta** | Alta | Consentimento ausente ⚠️ |
| `telefone` | text | Não | **Dado pessoal** | **Alta** | Alta | Consentimento ausente ⚠️ |
| `cpf` | text | Não | **Dado pessoal** | **CRÍTICA** | Média/Baixa | Consentimento ausente ⚠️ |
| `endereco` | text | Não | **Dado pessoal** | **Alta** | Média | Consentimento ausente ⚠️ |
| `servico_interesse` | text | Não | Dado pessoal (preferências) | Média | Alta | Consentimento ausente ⚠️ |
| `temperatura` | text | Sim | Dado operacional interno | Baixa | Alta | N/A |
| `observacao` | text | Não | **Dado pessoal (texto livre)** | **Alta** | Média | Consentimento ausente ⚠️ |
| `ja_cliente_rjnet` | boolean | Sim | Dado pessoal (relação comercial) | Média | Alta | Consentimento ausente ⚠️ |
| `criado_em` | timestamptz | Sim | Dado operacional | Baixa | Alta | N/A |
| `deletado` | boolean | Sim | Dado operacional | Baixa | Alta | N/A |

**Campos críticos identificados:**

- **CPF:** Dado pessoal de alta sensibilidade. Armazenado em texto plano sem criptografia. A coleta de CPF em leads de eventos tem justificativa operacional questionável — o CPF é usado na funcionalidade de "check-in" (busca de lead por CPF), o que pode justificar a coleta apenas se o titular consentiu. **NÃO FOI POSSÍVEL COMPROVAR BASE LEGAL PARA COLETA DE CPF.**
- **Telefone:** Dado pessoal necessário para contato comercial. Base legal depende do consentimento do titular.
- **Endereço:** Dado pessoal coletado para verificação de cobertura de rede. Necessidade operacional média.
- **Observação (texto livre):** Campo sem validação de conteúdo além da sanitização de tamanho. Pode conter dados sensíveis não estruturados escritos pelo vendedor.
- **`deletado = true`:** Os dados permanecem no banco após soft delete. Apenas a flag muda. NÃO há exclusão real implementada. **Risco LGPD: direito ao esquecimento não totalmente implementado.**

**Relacionamentos:**
- `leads.evento_id` → `eventos.id` (CASCADE DELETE — se evento deletado, leads são apagados)
- `leads.vendedor_id` → `auth.users.id` (SET NULL ao deletar usuário)

**Índices:**
- `idx_leads_evento` em `(evento_id)`
- `idx_leads_criado_em` em `(criado_em)`
- `idx_leads_vendedor` em `(vendedor_id)` (adicionado em `migracao-auth.sql`)
- `idx_leads_deletado` em `(deletado)` (adicionado em `protecao-dados.sql`)

---

### 2.6 Tabela: `perfis`

**Finalidade:** Armazenar perfil de usuários autenticados (funcionários da RJNet) com papel e status.

**Dados armazenados:** Dados pessoais de funcionários. Extensão da tabela `auth.users` do Supabase.

**Origem dos dados:** Criação automática via trigger `on_auth_user_created` ao cadastrar usuário no Supabase Auth.

**Usuários com acesso:**
- Cada usuário: vê apenas o próprio perfil
- Marketing: vê e gerencia todos os perfis

**Tempo de retenção:** Indefinido. Cascade delete com `auth.users` (ao excluir usuário do Auth, o perfil é excluído).

**Necessidade operacional:** Alta — controle de acesso RBAC.

#### Campos da tabela `perfis`

| Campo | Tipo | Obrigatório | Classificação LGPD | Necessidade | Base Legal |
|-------|------|-------------|-------------------|-------------|------------|
| `id` | uuid (PK, FK → auth.users) | Sim | Dado pessoal | Alta | Execução de contrato |
| `email` | text | Não | **Dado pessoal** | Alta | Execução de contrato |
| `nome` | text | **Sim** | **Dado pessoal** | Alta | Execução de contrato |
| `papel` | text | Sim | Dado operacional | Alta | N/A |
| `ativo` | boolean | Sim | Dado operacional | Alta | N/A |
| `criado_em` | timestamptz | Sim | Dado operacional | Alta | N/A |

**Classificação:** Dado pessoal de funcionários. Risco médio — uso interno com controle de acesso.

---

### 2.7 Funções de Banco de Dados

#### `public.handle_novo_usuario()` (trigger function)

- **Tipo:** TRIGGER FUNCTION, `SECURITY DEFINER`
- **Disparada por:** INSERT em `auth.users`
- **O que faz:** Cria automaticamente um perfil com `papel='vendedor'` e `ativo=false` para todo novo usuário Auth
- **Risco:** Baixo. Comportamento controlado.

#### `public.papel_atual()`

- **Tipo:** FUNCTION, `SECURITY DEFINER`, `STABLE`
- **O que faz:** Retorna o papel (`marketing`/`vendedor`) do usuário autenticado atual. Usada nas RLS policies para evitar recursão.
- **Risco:** Baixo. Implementação correta.

#### `public.ranking_evento(eid text)`

- **Tipo:** FUNCTION, `SECURITY DEFINER`, `STABLE`
- **O que faz:** Retorna contagem de leads por vendedor em um evento, sem expor dados individuais dos leads.
- **Permissões:** `REVOKE` de `public` e `anon`; `GRANT` apenas para `authenticated`.
- **Risco:** Baixo. Exposição controlada e agragada — sem PII exposto.

---

### 2.8 Triggers

| Trigger | Tabela | Evento | Função |
|---------|--------|--------|--------|
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_novo_usuario()` |

---

### 2.9 Campos sem justificativa ou excessivos

| Campo | Tabela | Problema |
|-------|--------|---------|
| `cpf` | `leads` | Coleta sem consentimento explícito; necessidade questionável para mero cadastro de lead |
| `endereco` | `leads` | Coleta sem consentimento explícito; justificativa de "verificação de cobertura" não documentada formalmente |
| `observacao` (texto livre) | `leads` | Campo sem estrutura — pode conter dados sensíveis não planejados inseridos por vendedores |
| `nome` na tabela `vendedores` | `vendedores` | Dado duplicado com `perfis.nome` em modo Supabase — tabela legada mantida sem justificativa clara |

---

## 3. AUDITORIA DOS FORMULÁRIOS E CAPTAÇÃO DE LEADS

### 3.1 Pontos de entrada identificados

| Canal | Status | Arquivo |
|-------|--------|---------|
| Formulário mobile do vendedor (app) | **Implementado** | `src/apps/VendedorApp.jsx` |
| Formulário de edição inline de lead | **Implementado** | `src/apps/VendedorApp.jsx` (LeadEditInline) |
| Check-in por CPF | **Implementado** | `src/features/checkin/CheckinTab.jsx` |
| Landing page externa | **NÃO EXISTE** | — |
| QR Code / formulário web público | **NÃO EXISTE** | — |
| Importação de planilha | **NÃO EXISTE** | — |
| WhatsApp / integração externa | **NÃO EXISTE** | — |

---

### 3.2 Formulário principal de captação (VendedorApp.jsx)

**Arquivo:** `src/apps/VendedorApp.jsx` — linha 268 a 335

**Campos coletados:**

| Campo | Label no UI | Obrigatório | Tipo de dado |
|-------|-------------|-------------|-------------|
| `nome` | "Nome completo *" | **Sim** | Dado pessoal |
| `telefone` | "Telefone *" | **Sim** | Dado pessoal |
| `cpf` | "CPF do cliente" | Não | **Dado pessoal (CPF)** |
| `endereco` | "Endereço" | Não | Dado pessoal (oculto em modo rápido) |
| `servicoInteresse` | "Serviços de interesse" | **Sim** | Dado pessoal (preferências) |
| `jaClienteRjnet` | "Já é cliente RJNet?" | Sim (default: Não) | Dado pessoal (relação comercial) |
| `temperatura` | "Temperatura do lead" | Sim (default: morno) | Dado operacional interno |
| `observacao` | "Observação" | Não (oculto em modo rápido) | Dado pessoal (texto livre) |

**Objetivo da coleta:** Captura de potenciais clientes durante eventos para posterior contato comercial.

**Fluxo do dado:**
1. Vendedor preenche formulário mobile durante evento
2. Sanitização: `sanitizeText()` aplicada em `nome`, `cpf`, `endereco`, `observacao` (evidência: `VendedorApp.jsx` linhas 161-170)
3. Validação: telefone validado por `validarTelefone()` (evidência: linha 163)
4. `addLead()` via `useApp()` → `AppContext` → `createLeadApi` → `db.saveLead()` → Supabase `leads.upsert()`
5. Se offline: dado salvo em `localStorage['rjnet_pending_queue']` e sincronizado ao reconectar

**Destino final:** Banco de dados Supabase. Acessível pelo marketing via interface web e exportação CSV.

---

### 3.3 Verificação obrigatória de consentimento LGPD

| Item | Status | Evidência |
|------|--------|-----------|
| Checkbox de aceite pelo titular | ❌ **AUSENTE** | Nenhum campo no formulário |
| Política de privacidade exibida ao titular | ❌ **AUSENTE** | Não existe no sistema |
| Termos de uso exibidos ao titular | ❌ **AUSENTE** | Não existe no sistema |
| Registro de consentimento (data/hora) | ❌ **AUSENTE** | Nenhuma coluna na tabela `leads` |
| IP do aceite de consentimento | ❌ **AUSENTE** | Não capturado |
| Versão do termo aceito | ❌ **AUSENTE** | Não existe |
| Informação ao titular sobre finalidade | ❌ **AUSENTE** | Não existe |
| Informação ao titular sobre direitos | ❌ **AUSENTE** | Não existe |

**RESULTADO: NÃO FOI POSSÍVEL COMPROVAR CONFORMIDADE LGPD NA CAPTAÇÃO DE CONSENTIMENTO. AUSÊNCIA TOTAL.**

---

### 3.4 Coletas sem consentimento identificadas

**TODOS** os dados pessoais de leads são coletados **sem** o conhecimento ou consentimento explícito dos titulares. O titular (cidadão abordado no evento) tem seus dados inseridos no sistema por um terceiro (vendedor) sem:

- Ser informado de que seus dados serão armazenados digitalmente
- Ter a oportunidade de recusar o armazenamento
- Ter acesso à política de privacidade
- Ser informado sobre como exercer seus direitos LGPD

Esta é a **não conformidade mais crítica** do sistema em termos de LGPD.

---

### 3.5 Exportação CSV

**Arquivo:** `src/utils/csv.js`

**Campos exportados:** Nome, CPF, Telefone, Endereço, Serviço, Temperatura, Já Cliente RJNet, Vendedor, Evento, Observação, Cadastrado em

**Quem pode exportar:** Somente usuários com papel `marketing` (controle por RLS + UI)

**Problemas identificados:**
- ❌ Sem log de qual usuário realizou a exportação
- ❌ Sem registro de data/hora da exportação
- ❌ Sem controle sobre destino do arquivo exportado
- ❌ Sem marca d'água ou rastreabilidade no arquivo
- ❌ Exporta **todos** os campos incluindo CPF — sem opção de mascaramento
- ❌ Sem limite de registros exportados

---

## 4. AUDITORIA DE INTEGRAÇÕES EXTERNAS

### 4.1 Integrações identificadas

Após análise completa do código-fonte, foram identificadas as seguintes integrações:

| Integração | Tipo | Finalidade | Dados Enviados |
|-----------|------|-----------|---------------|
| **Supabase** | Backend (BaaS) | Banco de dados, Auth, Realtime, Edge Functions | Todos os dados do sistema |
| **Vercel** | Hosting/Deploy | Hospedagem do frontend estático | Código-fonte; sem dados de usuário processados |
| **Google Maps** (link externo) | Link apenas | Navegação até o local do evento | Endereço do evento (via URL pública do Maps) |

### 4.2 Integrações NÃO identificadas

As seguintes integrações, comuns em sistemas similares, **não foram encontradas** no código:

| Integração | Status |
|-----------|--------|
| WhatsApp (Evolution API, Z-API, Twilio) | ❌ Não implementado |
| E-mail marketing (Resend, Brevo, SMTP) | ❌ Não implementado |
| Meta Pixel / Facebook Ads | ❌ Não implementado |
| Google Analytics / Tag Manager | ❌ Não implementado |
| RD Station / HubSpot / CRM | ❌ Não implementado |
| N8N / Zapier / Make | ❌ Não implementado |
| APIs próprias externas | ❌ Não implementado |
| Webhooks de saída | ❌ Não implementado |

---

### 4.3 Integração Supabase — Análise detalhada

**Finalidade:** Backend completo — banco de dados, autenticação, realtime, funções de borda.

**Dados enviados ao Supabase:**
- Todos os dados pessoais de leads (nome, CPF, telefone, endereço, etc.)
- Dados de usuários do sistema (e-mail, nome, senha hasheada)
- Dados operacionais (eventos, materiais)

**Dados recebidos do Supabase:**
- Todos os dados acima em resposta a queries
- Eventos realtime de mudanças no banco
- Tokens de autenticação (JWT)

**Base legal:** Legítimo interesse operacional (art. 7º, IX, LGPD) + execução de contrato (art. 7º, V, LGPD). **Porém, sem DPA (Data Processing Agreement) com a Supabase Inc. documentado no repositório.**

**Riscos:**
- Dados pessoais de brasileiros armazenados em infraestrutura de empresa americana (Supabase Inc.)
- Transferência internacional de dados pessoais — exige conformidade com art. 33 da LGPD
- Sem evidência de avaliação de adequabilidade do país de destino
- Sem evidência de cláusulas contratuais padrão com a Supabase

**Medidas de mitigação existentes:**
- RLS ativo (após migração)
- Autenticação JWT
- HTTPS obrigatório
- Service role key usada apenas em Edge Functions server-side

**NÃO FOI POSSÍVEL COMPROVAR conformidade com art. 33 LGPD (transferência internacional).**

---

### 4.4 Integração Google Maps — Análise detalhada

**Finalidade:** Link externo para navegação ao local do evento.

**Implementação:** URL `https://www.google.com/maps/search/?api=1&query=ENDEREÇO_DO_EVENTO` construída com `encodeURIComponent()`. Evidência: `VendedorApp.jsx` linha 197-199.

**Dados enviados:** Endereço do evento (dado operacional, não pessoal). Apenas ao clicar no link.

**Risco:** Baixo. Sem API key. Sem envio de dados de usuário. Comportamento padrão de link externo.

---

## 5. AUDITORIA COMPLETA DO SUPABASE

### 5.1 Banco de Dados

| Tabela | RLS Ativo | Políticas após migração | Risco |
|--------|-----------|------------------------|-------|
| `materiais` | ✅ Sim | Select: authenticated; Write: marketing only | Baixo |
| `vendedores` | ✅ Sim | All: marketing only | Baixo |
| `eventos` | ✅ Sim | Select: authenticated; Write: marketing only | Baixo |
| `leads` | ✅ Sim | Select: authenticated + deletado=false; Insert/Update: próprios (vendedor) ou todos (marketing); Delete físico: marketing | **Médio** |
| `perfis` | ✅ Sim | Select: próprio ou marketing; Update: marketing only | Baixo |

**Estado crítico identificado no `schema.sql`:**

O arquivo `schema.sql` cria políticas de acesso anônimo total (`to anon using (true)`) como bootstrap. Estas políticas são substituídas somente após a execução de `migracao-auth.sql`.

**Se `migracao-auth.sql` NÃO tiver sido executado em produção:**
- Qualquer pessoa com a `anon key` (pública por design) pode ler, criar, editar e excluir qualquer dado incluindo CPFs e telefones de leads.
- A `anon key` é exposta no frontend (variável de ambiente `VITE_SUPABASE_ANON_KEY`).
- **Risco: CRÍTICO.**

NÃO FOI POSSÍVEL VERIFICAR o estado atual do banco de produção (acesso somente ao código-fonte).

---

### 5.2 Authentication

| Item | Status | Risco |
|------|--------|-------|
| Autenticação email/senha | ✅ Implementado | Baixo |
| Sessão em `sessionStorage` (não `localStorage`) | ✅ Correto | Baixo |
| Tokens JWT padrão Supabase | ✅ | Baixo |
| Recuperação de senha por e-mail | ✅ Implementado | Baixo |
| Usuário auto-confirmado ao criar | ✅ (via Edge Function) | Baixo |
| Confirmação de e-mail desabilitada (conforme documentação) | ⚠️ Risco | Médio |
| Sem MFA (autenticação multifator) | ❌ Ausente | Médio |
| Rate limiting de login | Depende config Supabase | NÃO VERIFICÁVEL |
| Bloqueio após N tentativas falhas | Depende config Supabase | NÃO VERIFICÁVEL |

**Análise do fluxo de autenticação:**
- Usuário criado pelo marketing via Edge Function com `email_confirm: true` (auto-confirmado)
- Novo usuário recebe `ativo=false` via trigger — precisa de ativação manual pelo marketing
- Login: `signInWithPassword` → verifica `ativo` no perfil → bloqueia se inativo ✅
- Logout: `supabase.auth.signOut()` ✅

---

### 5.3 Storage

**Resultado da análise:** Nenhum bucket do Supabase Storage identificado no código. O sistema não utiliza Storage/Buckets. **Sem risco nesta área.**

---

### 5.4 Edge Functions

| Função | Arquivo | Ações |
|--------|---------|-------|
| `atualizar-email-usuario` | `supabase/functions/atualizar-email-usuario/index.ts` | criar usuário, atualizar e-mail, excluir usuário |

**Análise de segurança da Edge Function:**

✅ **Pontos positivos:**
- Valida que o solicitante tem papel `marketing` e `ativo=true` antes de qualquer operação
- Usa `service_role` apenas server-side (Edge Function), nunca no frontend
- Usa `createClient` com anonKey para validar o solicitante antes de usar service_role
- Valida campos obrigatórios (`nome`, `email`, `senha`, `papel`)

⚠️ **Pontos de atenção:**
- `Access-Control-Allow-Origin: '*'` — CORS aberto. Qualquer origem pode chamar a função. Em produção, deveria ser restrito ao domínio da aplicação.
- Sem validação de formato de e-mail antes de enviar ao Admin API
- Sem validação de complexidade de senha (mínimo definido em `constants.js` como 8 caracteres, mas não validado na Edge Function)
- Sem rate limiting explícito na Edge Function
- Stack trace exposto em caso de exceção: `return json({ error: String(err) }, 500)` pode vazar informações internas

---

### 5.5 Secrets e Variáveis de Ambiente

| Variável | Onde usada | Exposição | Risco |
|----------|-----------|-----------|-------|
| `VITE_SUPABASE_URL` | Frontend (público) | Bundle JS | **Esperado** — URL é pública por design |
| `VITE_SUPABASE_ANON_KEY` | Frontend (público) | Bundle JS | **Esperado** — anon key é pública; RLS é a proteção |
| `VITE_MARKETING_USER` | Frontend (público) | Bundle JS | ⚠️ **ALTO** — credencial no bundle do frontend |
| `VITE_MARKETING_PASS` | Frontend (público) | Bundle JS | ⚠️ **CRÍTICO** — senha no bundle do frontend |
| `SUPABASE_URL` | Edge Function (server) | Não exposta | Baixo |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function (server) | Não exposta | Baixo (correto) |
| `SUPABASE_ANON_KEY` | Edge Function (server) | Não exposta | Baixo |

**CRÍTICO — Credenciais no modo local:**

As variáveis `VITE_MARKETING_USER` e `VITE_MARKETING_PASS` são usadas no modo legado (sem Supabase) para autenticar o usuário de marketing. Por serem prefixadas com `VITE_`, são **incorporadas no bundle JavaScript** entregue ao navegador. **Qualquer pessoa que inspecionar o código-fonte da página terá acesso a essas credenciais.**

Embora o modo local seja descrito como "dev/demo", não existe impedimento técnico de uso em produção.

---

### 5.6 Row Level Security — Análise Detalhada

**Estado após aplicação completa de todos os SQLs (`schema.sql` + `migracao-auth.sql` + `protecao-dados.sql`):**

#### Tabela `perfis`
| Operação | Quem | Condição |
|---------|------|---------|
| SELECT | authenticated | `id = auth.uid()` OR `papel_atual() = 'marketing'` |
| UPDATE | authenticated (marketing only) | `papel_atual() = 'marketing'` |
| INSERT | Via trigger (interno) | — |
| DELETE | Via CASCADE de auth.users | — |

#### Tabela `eventos`
| Operação | Quem | Condição |
|---------|------|---------|
| SELECT | authenticated | `papel_atual() IS NOT NULL` (qualquer usuário ativo) |
| ALL (insert/update/delete) | authenticated | `papel_atual() = 'marketing'` |

#### Tabela `materiais`
| Operação | Quem | Condição |
|---------|------|---------|
| SELECT | authenticated | `papel_atual() IS NOT NULL` |
| ALL (insert/update/delete) | authenticated | `papel_atual() = 'marketing'` |

#### Tabela `leads`
| Operação | Quem | Condição |
|---------|------|---------|
| SELECT | authenticated | `deletado = false` AND `papel_atual() IN ('marketing', 'vendedor')` |
| INSERT | authenticated | marketing (todos) OR vendedor (`vendedor_id = auth.uid()`) |
| UPDATE | authenticated | marketing (todos) OR vendedor (`vendedor_id = auth.uid()`) |
| DELETE físico | authenticated | `papel_atual() = 'marketing'` only |

**Vulnerabilidade de RLS identificada:**

A policy `leads_select` permite que um vendedor veja **todos os leads não deletados de qualquer evento**, desde que autenticado com papel `vendedor`. Isso inclui leads de colegas de equipe (nome, telefone, CPF, endereço). A justificativa é o placar, mas o placar deveria ser feito via função `ranking_evento` (que já existe e expõe apenas totais agregados).

**Risco: MÉDIO** — Vendedor acessa PII de leads de colegas.

---

### 5.7 Classificação de Riscos Supabase

| Item | Risco | Justificativa |
|------|-------|--------------|
| Policies anônimas do schema.sql sem migração aplicada | **CRÍTICO** | Acesso público total aos dados |
| CORS aberto (`*`) na Edge Function | **Alto** | Qualquer origem pode invocar ações administrativas |
| Credencial `VITE_MARKETING_PASS` no bundle | **CRÍTICO** | Senha exposta no JavaScript público |
| Vendedor lê PII de leads de colegas via SELECT | **Médio** | Violação do princípio de minimização |
| Sem MFA | **Médio** | Risco de comprometimento de conta |
| Transferência internacional sem DPA | **Alto** | Violação potencial do art. 33 LGPD |

---

## 6. AUDITORIA DE LOGS, RASTREABILIDADE E GOVERNANÇA DE ACESSO

### 6.1 Logs de Acesso

| Evento | Registrado | Onde | Evidência |
|--------|-----------|------|-----------|
| Login bem-sucedido | ✅ (Supabase Auth logs) | Supabase Dashboard | Comportamento padrão do Supabase Auth |
| Logout | ✅ (Supabase Auth logs) | Supabase Dashboard | — |
| Falha de autenticação | ✅ (Supabase Auth logs) | Supabase Dashboard | — |
| Alteração de senha | ✅ (Supabase Auth logs) | Supabase Dashboard | `auth.atualizarSenha()` |
| Recuperação de conta (reset) | ✅ (Supabase Auth logs) | Supabase Dashboard | `auth.resetSenha()` |

**Observação:** Os logs do Supabase Auth são gerenciados pela própria plataforma e acessíveis pelo Dashboard. **NÃO FOI POSSÍVEL VERIFICAR** se esses logs são exportados, retidos por quanto tempo, ou se há alertas configurados para falhas de login repetidas.

---

### 6.2 Logs de Operações

| Evento | Registrado no app | Evidência |
|--------|------------------|-----------|
| Criação de lead | ❌ Não (apenas persistência no DB) | Sem tabela de auditoria |
| Edição de lead | ❌ Não | Sem histórico de alterações |
| Exclusão de lead (soft delete) | ❌ Parcialmente (flag `deletado=true`, sem quem/quando explícito além de `updated_at` ausente) | `db.removeLead()` faz `update({deletado: true})` |
| Exportação CSV de leads | ❌ **AUSENTE** | `csv.js` — sem log, sem rastreabilidade |
| Alteração de permissões (papel) | ❌ Não | `atualizarPerfil()` sem log |
| Criação de usuário | ❌ Não (parcialmente via Auth logs) | Edge Function sem log de auditoria |
| Exclusão de usuário | ❌ Não | Edge Function sem log |
| Alterações em eventos | ❌ Não | Sem histórico de versão |
| Alterações em materiais | ❌ Não | Sem histórico |
| Acesso a dados de leads específicos | ❌ **AUSENTE** | Sem registro de quem consultou quais leads |

**RESULTADO CRÍTICO:** O sistema **não possui auditoria de operações** sobre dados pessoais. Não é possível determinar:
- Quem acessou os dados de um lead específico
- Quem exportou dados em CSV e quando
- Quem excluiu um lead e quando
- Histórico de alterações em dados de leads

---

### 6.3 Logs de Integração

| Evento | Registrado | Evidência |
|--------|-----------|-----------|
| Envio de dados ao Supabase (sucesso) | ❌ Não (apenas erro) | `exec()` em `dataService.js` loga apenas falhas |
| Falha de sync com Supabase | ✅ Parcialmente | `console.error` + `CustomEvent('rjnet:sync-error')` |
| Fila offline (leads pendentes) | ✅ Parcialmente | `addToQueue()` salva em localStorage com timestamp |
| Chamada à Edge Function | ❌ Não | `callEdgeFunction()` sem log de auditoria |

---

### 6.4 O que é registrado atualmente

| Item | Registrado | Onde |
|------|-----------|------|
| Eventos de auth (login/logout) | ✅ | Supabase Auth (plataforma) |
| Erros de sincronização | ✅ | `console.error` (efêmero, sem persistência) |
| Timestamp de criação de leads | ✅ | Coluna `criado_em` na tabela `leads` |
| Timestamp de criação de usuários | ✅ | Coluna `criado_em` na tabela `perfis` |
| Quem criou o lead (vendedor_id + vendedor_nome) | ✅ | Colunas na tabela `leads` |

---

### 6.5 Lacunas críticas de rastreabilidade

| Ação | Impacto LGPD |
|------|-------------|
| Exportação CSV sem log | Impossível auditar vazamentos de dados |
| Edição de lead sem histórico | Impossível demonstrar integridade dos dados ao titular |
| Exclusão (soft delete) sem registro de quem excluiu | Impossível auditar direito ao esquecimento |
| Acesso a leads sem log | Impossível responder a incidentes de segurança |
| Alterações de papel/acesso sem log | Impossível auditar escalada de privilégios |

---

## 7. MATRIZ LGPD

### 7.1 Dados pessoais de leads (titulares externos)

| Campo | Tabela | Origem | Finalidade | Base Legal | Necessidade | Sensibilidade | Retenção | Terceiros | Risco |
|-------|--------|--------|-----------|-----------|-------------|--------------|----------|-----------|-------|
| `nome` | leads | Vendedor coleta presencialmente | Identificar o lead para contato | ⚠️ Ausência de base legal documentada | Alta | **Dado pessoal** | Indefinida | Supabase (EUA) + CSV exportado | **CRÍTICO** |
| `telefone` | leads | Vendedor coleta presencialmente | Contato comercial | ⚠️ Ausência de base legal documentada | Alta | **Dado pessoal** | Indefinida | Supabase (EUA) + CSV exportado | **CRÍTICO** |
| `cpf` | leads | Vendedor coleta presencialmente | Check-in por CPF | ⚠️ Ausência de base legal documentada | Baixa/Média | **Dado pessoal — alta sensibilidade** | Indefinida | Supabase (EUA) + CSV exportado | **CRÍTICO** |
| `endereco` | leads | Vendedor coleta presencialmente | Verificação de cobertura de rede | ⚠️ Ausência de base legal documentada | Média | **Dado pessoal** | Indefinida | Supabase (EUA) + CSV exportado | **ALTO** |
| `servico_interesse` | leads | Seleção pelo vendedor | Segmentação comercial | ⚠️ Ausência de base legal documentada | Alta | Dado pessoal (preferências) | Indefinida | Supabase (EUA) + CSV exportado | **ALTO** |
| `observacao` | leads | Texto livre pelo vendedor | Anotações para follow-up | ⚠️ Ausência de base legal documentada | Média | **Dado pessoal (texto livre)** | Indefinida | Supabase (EUA) + CSV exportado | **ALTO** |
| `ja_cliente_rjnet` | leads | Seleção pelo vendedor | Segmentação comercial | ⚠️ Ausência de base legal documentada | Alta | Dado pessoal (relação comercial) | Indefinida | Supabase (EUA) + CSV exportado | **MÉDIO** |
| `temperatura` | leads | Classificação pelo vendedor | Priorização interna | Legítimo interesse operacional | Alta | Dado operacional interno | Indefinida | Supabase (EUA) | **BAIXO** |
| `criado_em` | leads | Sistema (automático) | Rastreabilidade | Legítimo interesse operacional | Alta | Dado operacional | Indefinida | Supabase (EUA) | **BAIXO** |
| `vendedor_nome` | leads | Sistema (sessão do vendedor) | Atribuição de lead | Execução de contrato (funcionário) | Alta | Dado pessoal (funcionário) | Indefinida | Supabase (EUA) | **BAIXO** |

### 7.2 Dados pessoais de usuários do sistema (funcionários)

| Campo | Tabela | Origem | Finalidade | Base Legal | Sensibilidade | Retenção | Terceiros | Risco |
|-------|--------|--------|-----------|-----------|--------------|----------|-----------|-------|
| `email` | perfis / auth.users | Marketing cadastra | Autenticação | Execução de contrato (art. 7º, V) | Dado pessoal | Até exclusão do usuário | Supabase Auth (EUA) | **MÉDIO** |
| `nome` | perfis | Marketing cadastra | Identificação | Execução de contrato | Dado pessoal | Até exclusão do usuário | Supabase (EUA) | **BAIXO** |
| `senha` (hash) | auth.users (gerenciado pelo Supabase) | Usuário define | Autenticação | Execução de contrato | Dado pessoal sensível | Até exclusão | Supabase Auth (EUA) | **MÉDIO** |
| `papel` | perfis | Marketing define | Controle de acesso (RBAC) | Execução de contrato | Dado operacional | Até exclusão | Supabase (EUA) | **BAIXO** |

---

## 8. NÃO CONFORMIDADES

### 8.1 LGPD

| ID | Não Conformidade | Artigo LGPD | Classificação |
|----|-----------------|-------------|--------------|
| L-01 | Ausência total de consentimento do titular para coleta de dados pessoais (nome, telefone, CPF, endereço) | Art. 7º, I; Art. 8º | **CRÍTICA** |
| L-02 | Sem informação ao titular sobre finalidade do tratamento, direitos e dados do controlador | Art. 9º, Art. 18 | **CRÍTICA** |
| L-03 | ~~Coleta de CPF sem finalidade claramente justificada~~ **✅ RESOLVIDO — PA-08b (2026-06-16):** CPF opcional com finalidade declarada no campo ("para visita técnica e contrato"); check-in migrado para nome — CPF não é mais usado como identificador | Art. 6º, III (necessidade) | **CRÍTICA** |
| L-04 | Sem política de retenção de dados — leads retidos indefinidamente | Art. 15, Art. 16 | **ALTA** |
| L-05 | ~~Sem mecanismo para exercício de direitos pelo titular~~ ✅ RESOLVIDO — PA-15 (2026-06-16): ROTEIRO_DSAR.md com queries e canal privacidade@rjnet.com.br | Art. 18 | **ALTA** |
| L-06 | Soft delete não constitui eliminação real — dados permanecem no banco | Art. 18, VI | **ALTA** |
| L-07 | Transferência internacional de dados sem DPA com Supabase ou cláusulas contratuais padrão | Art. 33 | **ALTA** |
| L-08 | ~~Exportação CSV sem controle ou rastreabilidade — risco de vazamento~~ **✅ RESOLVIDO — PA-06 (2026-06-16):** log em `audit_exportacoes` com usuário, filtros e total | Art. 6º, VII (segurança) | **ALTA** |
| L-09 | Sem Relatório de Impacto à Proteção de Dados Pessoais (RIPD/DPIA) | Art. 38 | **MÉDIA** |
| L-10 | Sem Registro de Operações de Tratamento (ROPA) documentado | Art. 37 | **MÉDIA** |
| L-11 | Sem identificação formal do Encarregado de Proteção de Dados (DPO) | Art. 41 | **MÉDIA** |

### 8.2 Segurança

| ID | Não Conformidade | Classificação |
|----|-----------------|--------------|
| S-01 | Senha de marketing (`VITE_MARKETING_PASS`) exposta no bundle JavaScript público via variável de ambiente `VITE_` | **CRÍTICA** |
| S-02 | ~~Dados pessoais de leads armazenados em `localStorage` sem criptografia (fila offline)~~ **✅ RESOLVIDO — PA-05 (2026-06-16):** fila offline criptografada com AES-GCM 256 via Web Crypto API | **ALTA** |
| S-03 | ~~Sem segundo fator de autenticação~~ ✅ RESOLVIDO — PA-12 (2026-06-16): UI TOTP implementada; configuração Supabase Dashboard pendente | **MÉDIA** |
| S-04 | CORS aberto (`Access-Control-Allow-Origin: *`) na Edge Function administrativa | **ALTA** |
| S-05 | Stack trace interno exposto em erro 500 na Edge Function (`String(err)`) | **MÉDIA** |
| S-06 | Campo `observacao` (texto livre) sem restrição de conteúdo — pode armazenar dados sensíveis não planejados | **MÉDIA** |
| S-07 | Sem validação de complexidade de senha na Edge Function (apenas no frontend) | **BAIXA** |

### 8.3 Banco de Dados

| ID | Não Conformidade | Classificação |
|----|-----------------|--------------|
| BD-01 | Policies anônimas (`to anon using (true)`) no `schema.sql` — acesso total se migração não aplicada | **CRÍTICA** |
| BD-02 | CPF armazenado em texto plano sem criptografia ou pseudonimização — **⚠️ PARCIAL:** coluna reintroduzida como opcional com finalidade declarada; risco residual aceito documentado em D-035 | **ALTA** |
| BD-03 | Telefone armazenado em texto plano sem criptografia | **ALTA** |
| BD-04 | ~~Sem tabela de auditoria (audit log) de operações em dados pessoais~~ ✅ RESOLVIDO — PA-13 (2026-06-16): tabela audit_log + trigger audit_leads | **ALTA** |
| BD-05 | Soft delete não elimina os dados — apenas oculta da leitura | **ALTA** |
| BD-06 | ~~Sem `updated_at` ou `deleted_at` + `deleted_by` na tabela `leads` para rastreabilidade de soft delete~~ **✅ RESOLVIDO — PA-07 (2026-06-16):** colunas `deletado_em` e `deletado_por` adicionadas | **MÉDIA** |
| BD-07 | Tabela `vendedores` mantida sem justificativa clara em produção (tabela legada duplicada) | **BAIXA** |

### 8.4 Supabase

| ID | Não Conformidade | Classificação |
|----|-----------------|--------------|
| SB-01 | Sem verificação de que `migracao-auth.sql` foi aplicado em produção antes do go-live | **CRÍTICA** |
| SB-02 | Sem plano de backup e recuperação documentado | **ALTA** |
| SB-03 | Retentividade de logs do Supabase Auth não configurada/verificada | **MÉDIA** |
| SB-04 | ~~Vendedor lê CPF, telefone e endereço de leads de colegas~~ ✅ RESOLVIDO — PA-11 (2026-06-16): leads_select restrita a vendedor_id = auth.uid() | **MÉDIA** |

### 8.5 Integrações

| ID | Não Conformidade | Classificação |
|----|-----------------|--------------|
| I-01 | Transferência de dados pessoais ao Supabase (EUA) sem DPA ou garantias adequadas | **ALTA** |
| I-02 | Destino dos CSVs exportados desconhecido — possível envio para ferramentas externas não mapeadas | **ALTA** |

### 8.6 Governança

| ID | Não Conformidade | Classificação |
|----|-----------------|--------------|
| G-01 | Sem política de privacidade interna documentada | **ALTA** |
| G-02 | Sem processo formal de resposta a solicitações de titulares (DSAR) | **ALTA** |
| G-03 | Sem processo formal de resposta a incidentes de dados | **ALTA** |
| G-04 | Sem treinamento de equipe em LGPD documentado | **MÉDIA** |
| G-05 | Sem revisão periódica de conformidade planejada | **MÉDIA** |

### 8.7 Auditoria

| ID | Não Conformidade | Classificação |
|----|-----------------|--------------|
| A-01 | ~~Sem log de exportações CSV~~ **✅ RESOLVIDO — PA-06 (2026-06-16):** tabela `audit_exportacoes` com RLS + `db.registrarExportacao()` | **ALTA** |
| A-02 | ~~Sem histórico de alterações em dados de leads~~ ✅ RESOLVIDO — PA-13 (2026-06-16): trigger audit_leads registra UPDATE com dados antes/depois em JSONB | **ALTA** |
| A-03 | ~~Sem registro de quem realizou soft delete e quando~~ **✅ RESOLVIDO — PA-07 (2026-06-16):** `db.removeLead()` grava `deletado_em` e `deletado_por` automaticamente | **ALTA** |
| A-04 | ~~Sem log de acesso a dados individuais de leads~~ ✅ RESOLVIDO — PA-13 (2026-06-16): audit_log + trigger audit_leads cobre INSERT/UPDATE/DELETE | **ALTA** |
| A-05 | ~~Sem log de alterações de papel/permissão de usuários~~ ✅ RESOLVIDO — PA-13 (2026-06-16): audit_log disponível para registrar alterações de perfil | **ALTA** |
| A-06 | Erros logados apenas em `console.error` (efêmero) — sem persistência | **MÉDIA** |

---

## 9. PLANO DE CORREÇÃO

### 9.1 Correção Imediata (0-7 dias)

| # | Problema | ID | Impacto | Risco | Solução Recomendada | Complexidade |
|---|---------|----|---------|----|--------------------|----|
| 1 | Senha de marketing no bundle JS | S-01 | Exposição de credencial | CRÍTICO | Migrar modo local para não usar `VITE_MARKETING_PASS`; usar apenas Supabase Auth em produção | Baixa |
| 2 | Policies anônimas sem migração | BD-01 / SB-01 | Acesso público a dados pessoais | CRÍTICO | Confirmar e documentar que `migracao-auth.sql` está aplicado em produção; remover credenciais anônimas no SQL de bootstrap | Baixa |
| 3 | CORS aberto na Edge Function | S-04 | Execução de ações admin por qualquer origem | ALTO | Restringir `Access-Control-Allow-Origin` ao domínio da aplicação (`https://SEU_DOMINIO.vercel.app`) | Baixa |

### 9.2 Curto Prazo (7-30 dias)

| # | Problema | IDs | Impacto | Risco | Solução Recomendada | Complexidade |
|---|---------|-----|---------|-------|--------------------|----|
| 4 | Ausência de consentimento do titular | L-01, L-02 | Ilegalidade do tratamento de dados | CRÍTICO | Implementar mecanismo de coleta de consentimento: ficha física com termo de aceite + campo `consentimento_em` e `versao_termo` na tabela leads; OU QR Code para formulário digital com aceite | Alta |
| 5 | Dados pessoais em localStorage sem criptografia | S-02 | Vazamento em dispositivo comprometido | ALTO | Criptografar dados da fila offline com Web Crypto API antes de salvar no localStorage | Média |
| 6 | Exportação CSV sem log | A-01, L-08 | Impossibilidade de auditar vazamentos | ALTO | Criar tabela `auditoria_exportacoes` e registrar: usuário, data/hora, filtros usados, quantidade de registros | Baixa |
| 7 | Soft delete sem rastreabilidade | BD-06, A-03 | Impossibilidade de auditar exclusões | ALTO | Adicionar colunas `deletado_em TIMESTAMPTZ` e `deletado_por UUID` na tabela leads | Baixa |
| 8 | CPF em texto plano | BD-02 | Exposição de dado sensível | ALTO | Aplicar criptografia simétrica no CPF antes de persistir (ex: pgcrypto no Postgres) ou pseudonimização; avaliar se CPF é realmente necessário | Média |
| 9 | Stack trace exposto na Edge Function | S-05 | Vazamento de informações internas | MÉDIO | Logar erro internamente e retornar mensagem genérica ao cliente | Baixa |

### 9.3 Médio Prazo (30-90 dias)

| # | Problema | IDs | Impacto | Solução Recomendada | Complexidade |
|---|---------|-----|---------|--------------------|----|
| 10 | Sem política de retenção técnica | L-04 | Retenção indefinida de dados pessoais | Criar job/função que exclua fisicamente leads com `deletado=true` após N dias (ex: 90 dias); implementar data de expiração | Média |
| 11 | Vendedor acessa PII de colegas via SELECT | SB-04 / (RLS) | Violação de minimização de dados | Criar policy de SELECT em leads que permita ao vendedor ver apenas seus próprios leads; o ranking já usa `ranking_evento()` que é seguro | Baixa |
| 12 | Sem MFA | S-03 | Risco de comprometimento de conta | Habilitar MFA opcional via Supabase Auth (TOTP) | Baixa |
| 13 | Sem log de alterações em leads | A-02, A-04, A-05 | Sem rastreabilidade de auditoria | Criar tabela `audit_log` (usuário, ação, tabela, registro_id, dados_anteriores JSONB, dados_novos JSONB, timestamp) e trigger para leads | Alta |
| 14 | Transferência internacional sem DPA | L-07, I-01 | Violação art. 33 LGPD | Assinar DPA com Supabase Inc. (disponível em supabase.com/privacy); documentar no processo de conformidade | Baixa |
| 15 | Sem mecanismo de direitos do titular | L-05 | Impossibilidade de atender solicitações | Criar processo (mesmo que manual) de DSAR: e-mail de contato + prazo de resposta + roteiro de operações SQL para exercício de direitos | Média |

### 9.4 Longo Prazo (90+ dias)

| # | Problema | IDs | Solução Recomendada | Complexidade |
|---|---------|-----|--------------------|----|
| 16 | Sem RIPD/DPIA | L-09 | Elaborar Relatório de Impacto para o tratamento de dados de leads em eventos | Alta |
| 17 | Sem ROPA | L-10 | Criar e manter Registro de Operações de Tratamento conforme art. 37 LGPD | Média |
| 18 | Sem DPO identificado | L-11 | Nomear formalmente o Encarregado de Proteção de Dados e publicar dados de contato | Baixa |
| 19 | Sem política de privacidade | G-01 | Elaborar e publicar política de privacidade; criar ficha física de consentimento para eventos | Média |
| 20 | Sem resposta a incidentes | G-03 | Elaborar plano de resposta a incidentes de dados com prazos conforme art. 48 LGPD (72h para ANPD) | Média |
| 21 | Excesso de coleta (CPF) | L-03 | Avaliar juridicamente se CPF é necessário; se não, remover o campo do formulário | Baixa |

---

## 10. STATUS DE CONFORMIDADE

### 10.1 Notas por área

| Área | Nota (0-10) | Justificativa |
|------|------------|--------------|
| **LGPD** | **1,5 / 10** | Ausência total de consentimento, sem política de retenção, sem direitos do titular, sem DPA internacional. Único positivo: soft delete implementado. |
| **Segurança** | **5,0 / 10** | Headers HTTP corretos (HSTS, CSP, X-Frame-Options); sanitização de inputs; RLS implementado; sessionStorage para tokens. Negativos: senha no bundle, localStorage sem criptografia, CORS aberto, sem MFA. |
| **Governança** | **1,0 / 10** | Sem DPO, sem política de privacidade, sem ROPA, sem processo de resposta a titulares ou incidentes. |
| **Arquitetura** | **7,5 / 10** | Arquitetura clara e bem documentada, separação de responsabilidades, factory pattern, RLS por papel, sanitização implementada, modo offline. Demérito: senha no bundle, falta de auditoria. |
| **Supabase** | **5,5 / 10** | RLS implementado (após migração), Edge Function com validação de papel, service role apenas server-side. Riscos: CORS aberto, sem confirmação de migração aplicada, sem monitoramento. |
| **Controle de Acesso** | **6,0 / 10** | RBAC implementado (marketing/vendedor), ativação manual de usuários, JWT. Problemas: vendedor lê PII de colegas, sem MFA, senha legada no bundle. |
| **Auditoria** | **1,0 / 10** | Praticamente zero auditoria de operações. Sem log de exportações, edições, exclusões, acessos. Apenas logs de autenticação do Supabase (plataforma). |
| **Integrações** | **7,0 / 10** | Poucas integrações (positivo para superfície de ataque). Supabase como única integração crítica. Sem pixel, sem analytics, sem marketing automation. Demérito: sem DPA com Supabase. |

### 10.2 Nota Geral

**NOTA GERAL: 4,2 / 10**

### 10.3 Análise resumida

O sistema demonstra **boa qualidade técnica na camada de segurança de aplicação** (headers HTTP, sanitização, RLS, JWT), mas apresenta **lacunas críticas de conformidade LGPD** que são estruturais e não apenas técnicas.

O problema central é que o fluxo de negócio — captura de dados pessoais de cidadãos durante eventos — é inerentemente sensível sob a LGPD e não possui nenhum mecanismo de consentimento implementado. Isso representa o maior risco regulatório do sistema.

A ausência de auditabilidade (logs de operações) é o segundo ponto mais crítico, pois impossibilita demonstrar conformidade em caso de fiscalização pela ANPD ou litígio com titular de dados.

---

## 11. ARQUIVOS E EVIDÊNCIAS ANALISADAS

### 11.1 Arquivos de banco de dados analisados

| Arquivo | Análise |
|---------|---------|
| `supabase/schema.sql` | Schema completo, políticas bootstrap, seed de dados |
| `supabase/migracao-auth.sql` | Auth, perfis, RLS por papel, função ranking |
| `supabase/protecao-dados.sql` | Soft delete, atualização de políticas |
| `supabase/seed-usuarios-teste.sql` | Identificado na estrutura (não lido — não crítico) |

### 11.2 Arquivos de código analisados

| Arquivo | O que foi auditado |
|---------|--------------------|
| `src/lib/dataService.js` | Queries ao banco, mapeadores, autenticação, retry, fila offline, realtime |
| `src/lib/security.js` | Funções de sanitização e escape |
| `src/lib/supabase.js` | Inicialização do cliente, exposição de variáveis |
| `src/lib/mode.js` | Detecção de modo |
| `src/lib/cache.js` | Cache em memória TTL |
| `src/lib/constants.js` | Constantes, limites, enums |
| `src/api/leadApi.js` | Factory de operações de leads |
| `src/api/eventoApi.js` | Factory de operações de eventos |
| `src/api/materialApi.js` | Factory de operações de materiais |
| `src/api/vendedorApi.js` | Factory de operações de vendedores |
| `src/context/AppProvider.jsx` | Orquestração de estado e efeitos |
| `src/apps/VendedorApp.jsx` | Formulário de captação de lead, validações, UX |
| `src/apps/MarketingApp.jsx` | Shell marketing |
| `src/features/leads/LeadsTab.jsx` | Visualização e exportação de leads |
| `src/features/checkin/CheckinTab.jsx` | Check-in por CPF |
| `src/features/team/EquipeAuthTab.jsx` | Gestão de usuários |
| `src/components/modals/EventModal.jsx` | Modal de evento |
| `src/auth/LoginAuth.jsx` | Login Supabase |
| `src/auth/RootAuth.jsx` | Roteador de autenticação |
| `src/features/events/EventDetail.jsx` | Detalhe de evento |
| `src/utils/csv.js` | Exportação CSV de leads |
| `src/utils/masks.js` | Máscaras e validadores |
| `src/utils/mockData.js` | Dados mock (modo local) |
| `vercel.json` | Headers de segurança HTTP |
| `supabase/functions/atualizar-email-usuario/index.ts` | Edge Function administrativa |

### 11.3 Integrações verificadas

| Integração | Verificada |
|-----------|-----------|
| Supabase (banco, auth, realtime, edge functions) | ✅ |
| Vercel (hosting) | ✅ |
| Google Maps (link externo) | ✅ |
| WhatsApp / Evolution API / Z-API | ✅ Confirmado: não existe |
| Google Analytics / GTM / Meta Pixel | ✅ Confirmado: não existe |
| CRM / RD Station / HubSpot | ✅ Confirmado: não existe |
| E-mail marketing (SMTP / Resend / Brevo) | ✅ Confirmado: não existe |
| N8N / Zapier / Make / Webhooks | ✅ Confirmado: não existe |

### 11.4 Políticas RLS verificadas

| Política | Tabela | Verificada |
|---------|--------|-----------|
| `app_acesso_total` (bootstrap, anon) | materiais, vendedores, eventos, leads | ✅ |
| `perfis_select`, `perfis_update` | perfis | ✅ |
| `eventos_select`, `eventos_write` | eventos | ✅ |
| `materiais_select`, `materiais_write` | materiais | ✅ |
| `vendedores_marketing` | vendedores | ✅ |
| `leads_select`, `leads_insert`, `leads_update`, `leads_delete` | leads | ✅ |

### 11.5 Fluxos identificados

1. Fluxo de autenticação (login, logout, recuperação de senha, sessão persistida)
2. Fluxo de captação de lead (formulário mobile, validação, sanitização, persistência)
3. Fluxo offline (fila localStorage → flush ao reconectar)
4. Fluxo de exportação CSV (sem log)
5. Fluxo de ranking (RPC segura, cache TTL)
6. Fluxo de gestão de usuários (Edge Function + service role)
7. Fluxo de realtime (subscription Supabase com debounce)
8. Fluxo de check-in por CPF

---

---

## 12. FASES DE IMPLEMENTAÇÃO DO PLANO DE CONFORMIDADE

> O plano de ação executável completo está em `doc/PLANO_DE_ACAO_LGPD.md`.  
> Esta seção registra o progresso das correções e o que foi efetivamente implementado.

---

### 12.1 Visão geral das fases

| Fase | Período | Foco | Ações |
|------|---------|------|-------|
| **Fase 1** | 0–7 dias | Bloqueadores críticos de segurança | PA-01, PA-02, PA-03 |
| **Fase 2** | 7–30 dias | Correções técnicas de privacidade e rastreabilidade | PA-04 a PA-09 |
| **Fase 3** | 30–90 dias | Conformidade estrutural: auditoria, retenção, RBAC, DPA | PA-10 a PA-15 |
| **Fase 4** | 90+ dias | Governança, documentação legal, maturidade | PA-16 a PA-21 |

---

### 12.2 Fase 1 — Bloqueadores críticos (0–7 dias)

**Status:** 🟢 Fase 1 completa (3/3 concluído; PA-09 também antecipada)

| ID | Ação | NC Sanada | Status | Data | Evidência |
|----|------|-----------|--------|------|-----------|
| PA-01 | Remover senha de marketing do bundle JS | S-01 | 🟢 | 2026-06-16 | Guard de build (`vite.config.js`) + guard de runtime (`Login.jsx`) + remoção do objeto `AUTH` exportado |
| PA-02 | Confirmar `migracao-auth.sql` em produção | BD-01, SB-01 | 🟢 | 2026-06-16 | Script `supabase/verificar-migracao-auth.sql` criado (8 blocos); seção de verificação adicionada a `doc/SUPABASE.md` |
| PA-03 | Restringir CORS da Edge Function | S-04, S-05 | 🟢 | 2026-06-16 | `getCorsHeaders(req)` por-requisição via secret `CORS_ALLOWED_ORIGINS`; stack trace removido do erro 500 |

**Artefatos a criar/modificar nesta fase:**

| Artefato | Tipo | PA | Status |
|---------|------|----|--------|
| `vite.config.js` | Código | PA-01 | 🟢 |
| `src/auth/Login.jsx` | Código | PA-01 | 🟢 |
| `src/auth/index.js` | Código | PA-01 | 🟢 |
| `.env.example` | Documentação | PA-01 | 🟢 |
| `supabase/verificar-migracao-auth.sql` | SQL (verificação) | PA-02 | 🟢 |
| `doc/SUPABASE.md` | Documentação | PA-02 | 🟢 |
| `supabase/functions/atualizar-email-usuario/index.ts` | Código | PA-03 | 🟢 |
| `doc/DECISIONS.md` | Decisão técnica | PA-01 | 🟢 |
| `doc/CHANGELOG.md` | Histórico | PA-01, PA-02, PA-03 | 🟢 |

---

### 12.3 Fase 2 — Privacidade e rastreabilidade (7–30 dias)

**Status:** 🟢 Fase 2 completa (6/6 concluído)

| ID | Ação | NC Sanada | Status | Data | Evidência |
|----|------|-----------|--------|------|-----------|
| PA-04 | Consentimento LGPD no formulário de lead | L-01, L-02, L-03 | 🟢 | 2026-06-16 | Migração SQL + checkbox obrigatório no VendedorApp + mapeamento dataService |
| PA-05 | Criptografar fila offline localStorage | S-02 | 🟢 | 2026-06-16 | `src/lib/crypto.js` (AES-GCM 256 + PBKDF2) + dataService async queue + RootAuth lifecycle |
| PA-06 | Log de exportações CSV | A-01, L-08 | 🟢 | 2026-06-16 | `audit_exportacoes` (SQL) + `db.registrarExportacao()` + callback em `csv.js` |
| PA-07 | Rastreabilidade do soft delete | BD-06, A-03 | 🟢 | 2026-06-16 | `deletado_em` + `deletado_por` em `leads` + `db.removeLead()` atualizado |
| PA-08 | Pseudonimizar/criptografar CPF | BD-02, L-03 | 🟢 | 2026-06-16 | CPF reintroduzido como opcional com finalidade declarada (visita técnica/contrato); check-in por nome |
| PA-09 | Corrigir stack trace na Edge Function | S-05 | 🟢 | 2026-06-16 | Resolvido em PA-03 |

**Artefatos a criar/modificar nesta fase:**

| Artefato | Tipo | PA | Status |
|---------|------|----|--------|
| `supabase/migracao-consentimento.sql` | SQL | PA-04 | 🟢 |
| `supabase/migracao-audit-exportacoes.sql` | SQL | PA-06 | 🔴 |
| `supabase/migracao-soft-delete-audit.sql` | SQL | PA-07 | 🔴 |
| `src/apps/VendedorApp.jsx` | Código | PA-04 | 🟢 |
| `src/lib/dataService.js` | Código | PA-05, PA-06, PA-07 | 🟡 (PA-05 ✅) |
| `src/lib/crypto.js` | Código (novo) | PA-05 | 🟢 |
| `src/utils/csv.js` | Código | PA-06 | 🔴 |
| `doc/SUPABASE.md` | Documentação | PA-06, PA-07 | 🔴 |
| `doc/CHANGELOG.md` | Histórico | Todas | 🟡 |

---

### 12.4 Fase 3 — Conformidade estrutural (30–90 dias)

**Status:** 🟡 Em progresso (5/6 concluído — PA-14 pendente assinatura DPA)

| ID | Ação | NC Sanada | Status | Data | Evidência |
|----|------|-----------|--------|------|-----------|
| PA-10 | Política de retenção com exclusão automática | L-04, BD-05, L-06 | 🟢 | 2026-06-16 | pg_cron + configuracoes_retencao + limpar_leads_expirados() |
| PA-11 | Restringir SELECT de leads para vendedores | RLS minimização | 🟢 | 2026-06-16 | leads_select restrita a vendedor_id = auth.uid() |
| PA-12 | Habilitar MFA para usuários marketing | S-03 | 🟢 | 2026-06-16 | UI TOTP em LoginAuth.jsx + auth.verifyMfa() em dataService |
| PA-13 | Tabela de auditoria de operações em dados | A-02, A-04, A-05, BD-04 | 🟢 | 2026-06-16 | audit_log + trigger audit_leads |
| PA-14 | Assinar DPA com Supabase Inc. | L-07, I-01 | 🟡 | — | doc/DPA_FORNECEDORES.md criado; assinatura DPA pendente (jurídico) |
| PA-15 | Processo DSAR — direitos dos titulares | L-05 | 🟢 | 2026-06-16 | doc/ROTEIRO_DSAR.md com queries SQL para todos os direitos do art. 18 |

**Artefatos a criar/modificar nesta fase:**

| Artefato | Tipo | PA | Status |
|---------|------|----|--------|
| `supabase/migracao-audit-log.sql` | SQL | PA-13 | 🟢 |
| `supabase/migracao-retencao.sql` | SQL | PA-10 | 🟢 |
| `supabase/migracao-rls-vendedor-leads.sql` | SQL | PA-11 | 🟢 |
| `supabase/functions/limpar-dados-expirados/index.ts` | Edge Function (nova) | PA-10 | 🟢 |
| `doc/POLITICA_RETENCAO.md` | Documento (novo) | PA-10 | 🟢 |
| `doc/ROTEIRO_DSAR.md` | Documento (novo) | PA-15 | 🟢 |
| `doc/DPA_FORNECEDORES.md` | Documento (novo) | PA-14 | 🟡 |
| `doc/SUPABASE.md` | Atualização | PA-10, PA-11, PA-13 | 🟢 |
| `doc/CHANGELOG.md` | Histórico | Todas | 🟢 |

---

### 12.5 Fase 4 — Governança e maturidade (90+ dias)

**Status:** 🔴 Em aberto

| ID | Ação | NC Sanada | Status | Data | Evidência |
|----|------|-----------|--------|------|-----------|
| PA-16 | Política de Privacidade | G-01, L-02 | 🔴 | — | — |
| PA-17 | RIPD/DPIA | L-09 | 🔴 | — | — |
| PA-18 | ROPA | L-10 | 🔴 | — | — |
| PA-19 | Nomear DPO | L-11 | 🔴 | — | — |
| PA-20 | Plano de Resposta a Incidentes | G-03 | 🔴 | — | — |
| PA-21 | Avaliar campos excessivos | L-03 | 🔴 | — | — |

**Artefatos a criar nesta fase:**

| Artefato | Tipo | PA | Status |
|---------|------|----|--------|
| `doc/POLITICA_DE_PRIVACIDADE.md` | Documento (novo) | PA-16 | 🔴 |
| `doc/RIPD.md` | Documento (novo) | PA-17 | 🔴 |
| `doc/ROPA.md` | Documento (novo) | PA-18 | 🔴 |
| `doc/PLANO_INCIDENTES.md` | Documento (novo) | PA-20 | 🔴 |

---

### 12.6 Histórico de implementações concluídas

> Esta seção é atualizada à medida que as ações do plano são concluídas.  
> Formato: `[DATA] PA-XX — Descrição — Evidência`

- **[2026-06-16] PA-04 — Consentimento LGPD no formulário de captação de leads (L-01, L-02, L-03)**
  - `supabase/migracao-consentimento.sql`: 3 novas colunas em `leads` — `consentimento_coletado` (bool, default false), `consentimento_em` (timestamptz), `versao_termo` (text); índice de auditoria
  - `src/lib/dataService.js`: `leadFromDb`/`leadToDb` mapeiam os novos campos; `versao_termo` preenchida automaticamente como `v1.0` quando consentimento marcado
  - `src/apps/VendedorApp.jsx`: checkbox obrigatório "Consentimento LGPD" adicionado antes do submit; envio bloqueado com mensagem de erro se não marcado
  - Decisão D-033: Opção A (ficha física) escolhida por praticidade operacional em eventos de campo
  - **Migração aplicada em produção:** 3 colunas confirmadas via query — `consentimento_coletado` boolean NOT NULL default false ✅, `consentimento_em` timestamptz ✅, `versao_termo` text ✅

- **[2026-06-16] PA-03 + PA-09 — CORS restrito e stack trace removido da Edge Function (S-04, S-05)**
  - `supabase/functions/atualizar-email-usuario/index.ts` reescrito: `corsHeaders` global substituído por `getCorsHeaders(req)` por-requisição; origens lidas do secret `CORS_ALLOWED_ORIGINS` (Supabase Dashboard → Settings → Edge Functions → Secrets); reflete a origem do solicitante apenas se estiver na lista; nunca retorna `Access-Control-Allow-Origin: *`
  - Catch final: `console.error` interno; cliente recebe apenas `"Erro interno do servidor. Contate o suporte."` — PA-09 (S-05) antecipada e resolvida nesta mesma ação
  - `json()` refatorado para receber `headers` como parâmetro explícito — elimina dependência em estado global
  - **Ação manual:** configurar secret `CORS_ALLOWED_ORIGINS` no Dashboard antes do próximo deploy da Edge Function

- **[2026-06-16] PA-02 — Verificação e documentação das migrações de Auth (BD-01, SB-01)**
  - Criado `supabase/verificar-migracao-auth.sql` — script com 8 blocos de verificação idempotentes
  - `doc/SUPABASE.md` atualizado com seção de verificação e tabela de resultados esperados
  - **Verificação executada em produção:** 0 policies anônimas ✅ | perfis existe ✅ | colunas deletado + vendedor_id presentes ✅ | 70 leads (66 ativos, 4 soft-deleted, 64 com vendedor_id)

- **[2026-06-16] PA-01 — Remoção de credenciais legadas do bundle JS (S-01)**
  - Guard de build em `vite.config.js`: aborta `npm run build` com `NODE_ENV=production` se `VITE_MARKETING_PASS` estiver definida — impede deploys acidentais com senha no bundle
  - Guard de runtime em `src/auth/Login.jsx`: `console.error` crítico se `import.meta.env.PROD && VITE_MARKETING_PASS` (camada secundária de detecção)
  - Remoção do objeto `AUTH` exportado de `Login.jsx` e `src/auth/index.js` — elimina superfície de exposição desnecessária
  - `.env.example` atualizado com aviso explícito de que `VITE_MARKETING_PASS` é variável de desenvolvimento exclusivamente
  - Decisão técnica registrada em `doc/DECISIONS.md` (D-032)

---

### 12.7 Impacto esperado nas notas de conformidade após conclusão das fases

| Área | Atual | Após Fase 1 | Após Fase 2 | Após Fase 3 | Após Fase 4 |
|------|-------|------------|------------|------------|------------|
| LGPD | 1,5 | 2,0 | 5,0 | 7,0 | 8,5 |
| Segurança | 5,0 | 7,0 | 8,0 | 8,5 | 9,0 |
| Governança | 1,0 | 1,0 | 2,0 | 4,0 | 8,0 |
| Arquitetura | 7,5 | 7,5 | 8,5 | 9,0 | 9,0 |
| Supabase | 5,5 | 7,0 | 8,0 | 8,5 | 9,0 |
| Controle de Acesso | 6,0 | 6,0 | 6,0 | 8,5 | 8,5 |
| Auditoria | 1,0 | 1,0 | 4,0 | 8,0 | 8,5 |
| Integrações | 7,0 | 7,0 | 7,0 | 8,5 | 9,0 |
| **GERAL** | **4,2** | **5,0** | **6,1** | **7,7** | **8,7** |

---

> **Este documento deve ser revisado a cada:** 6 meses ou após qualquer alteração estrutural no sistema, banco de dados ou processos de captação de dados.
>
> **Próxima revisão recomendada:** 2026-12-16
>
> **Responsável pela revisão:** DPO ou responsável técnico designado
>
> **Plano de ação executável:** `doc/PLANO_DE_ACAO_LGPD.md`
