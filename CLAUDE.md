# RJNet Gestão de Eventos — CLAUDE.md

## Visão Geral

Sistema de gerenciamento de eventos para a RJNet. Permite controle de eventos, estoque de materiais, captura de leads e gestão de equipe comercial.

Opera em dois modos: **modo Supabase** (produção, com Auth + RLS + Realtime) e **modo local** (localStorage, sem dependência de rede).

**Stack:** React 19 + Vite 8 + Supabase (PostgreSQL + Auth) + Chart.js 4  
**Deploy:** Vercel  
**Testes:** Playwright (E2E) + Node.js (unitários)

---

## Estado Atual da Refatoração

> Arquivo de referência: `REFATORAÇÃO.md`

**Objetivo:** Reduzir `src/main.jsx` de 2.270 linhas para < 100 linhas, extraindo módulos sem alterar comportamento.

**Progresso:** 6 de 18 etapas concluídas — **33%**

### Etapas concluídas

| # | Etapa | Destino |
|---|-------|---------|
| 1 | Format Utils | `src/utils/format.js` |
| 2 | Masks & Validators | `src/utils/masks.js` |
| 3 | CSV Export | `src/utils/csv.js` |
| 4 | Mock Data | `src/utils/mockData.js` |
| 5 | Constants | `src/lib/constants.js` |
| 6 | UI Components | `src/components/ui.jsx` |

### Próxima etapa

**Etapa 7 — SyncBadge + useApp hook**
- Extrair `SyncBadge` de `main.jsx` para `src/components/ui.jsx`
- Extrair `useApp` de `main.jsx` para `src/hooks/useApp.js`

### Etapas futuras (aguardando autorização)

8. Auth components → `src/components/auth/`
9. Modal components → `src/components/modals/`
10–12. Feature tabs (Events, Inventory, Leads, Checkin, Team) → `src/features/`
13. VendedorApp shell → `src/apps/`
14. Layout shells (Root, MarketingApp) → `src/apps/`
15. Domain hooks (usePersisted, useRanking) → `src/hooks/`
16. AppContext/AppProvider → `src/context/`
17. API modules por domínio → `src/api/`
18. Centralizar detecção de modo dual → `src/lib/`

### Riscos conhecidos

- `useApp` tem dependência circular temporária até a Etapa 16 (AppContext)
- `EventDetail` (~230 linhas) é o componente mais complexo — extrair por último
- Polling/intervals devem ser limpos no `cleanup` dos hooks
- Listener de mudança de Auth deve ser cancelado no unmount

---

## Estrutura Atual do Projeto

```
rjnet-gestao-eventos/
├── CLAUDE.md
├── REFATORAÇÃO.md           # Plano detalhado de refatoração (18 etapas)
├── SUPABASE.md              # Documentação de setup do Supabase
├── index.html
├── vite.config.js
├── vercel.json              # Headers CSP e segurança
├── playwright.config.js     # Config E2E (2 servidores)
├── package.json
├── .env.example
├── public/
│   └── logo-rjnet.svg
├── src/
│   ├── main.jsx             # Monólito principal — 2.270 linhas
│   ├── index.css            # Estilos globais (tema dark)
│   ├── components/
│   │   └── ui.jsx           # Componentes genéricos de UI (78 linhas)
│   ├── lib/
│   │   ├── supabase.js      # Inicialização do cliente Supabase (23 linhas)
│   │   ├── dataService.js   # Camada de dados completa (394 linhas)
│   │   ├── constants.js     # Constantes de domínio (29 linhas)
│   │   ├── security.js      # Sanitização browser (47 linhas)
│   │   └── cache.js         # Cache em memória com TTL (32 linhas)
│   └── utils/
│       ├── format.js        # Formatadores e labels (21 linhas)
│       ├── masks.js         # Validação e máscara CPF/telefone (34 linhas)
│       ├── csv.js           # Export CSV de leads (20 linhas)
│       └── mockData.js      # Dados mock para modo local (57 linhas)
├── supabase/
│   ├── schema.sql           # Schema inicial (134 linhas)
│   ├── migracao-auth.sql    # RLS + integração Auth (194 linhas)
│   ├── protecao-dados.sql   # Soft delete (60 linhas)
│   ├── migrar-comercial-para-vendedor.sql  # Migração de dados (27 linhas)
│   ├── seed-usuarios-teste.sql (40 linhas)
│   ├── config.toml
│   └── functions/
│       └── atualizar-email-usuario/
│           └── index.ts     # Edge Function — gerenciamento de usuários (101 linhas)
├── tests/
│   ├── helpers/
│   │   └── auth.js          # Helpers de autenticação para testes (31 linhas)
│   ├── auth.test.js         # E2E: login/logout (75 linhas)
│   ├── security.test.js     # E2E: SQL injection, XSS (276 linhas)
│   ├── security.unit.test.js # Unit: sanitização (108 linhas)
│   ├── lead.unit.test.js    # Unit: validação de leads (181 linhas)
│   ├── comercial.test.js    # E2E: dashboard comercial (116 linhas)
│   ├── comercial-supabase.test.js # E2E: criação de leads no Supabase (196 linhas)
│   ├── estoque.test.js      # E2E: inventário (58 linhas)
│   ├── formularios.test.js  # E2E: submissão de formulários (100 linhas)
│   ├── marketing.test.js    # E2E: dashboard marketing (72 linhas)
│   └── navegacao.test.js    # E2E: fluxos de navegação (76 linhas)
├── config/
│   └── security.js          # Utilitários de segurança Node.js (espelha src/lib/security.js)
└── data/
    ├── colaboradores.example.json
    └── estoque.example.json
```

---

## Arquitetura Atual

### Apps (em `src/main.jsx`)

| Componente | Papel | Descrição |
|------------|-------|-----------|
| `Root` | Roteador | Detecta modo (Auth vs Legacy) e renderiza o app correto |
| `RootAuth` | Supabase mode | Gerencia estado de sessão Auth + renderiza MarketingApp ou VendedorApp |
| `RootLegacy` | Local mode | Gerencia login simples via env vars |
| `MarketingApp` | marketing | App completo com todas as tabs |
| `VendedorApp` | vendedor | App reduzido — só captura de leads e checkin |

### Features (componentes em `src/main.jsx`)

| Componente | Tab | Acesso |
|------------|-----|--------|
| `Dashboard` | Dashboard | marketing |
| `EventosTab` | Eventos | marketing |
| `EventDetail` | Detalhe do evento | marketing |
| `EstoqueTab` | Estoque | marketing |
| `LeadsTab` | Leads | marketing |
| `EquipeTab` | Equipe (modo local) | marketing |
| `EquipeAuthTab` | Equipe (modo Auth) | marketing |
| `CheckinTab` | Checkin | vendedor |
| `EventModal` | Modal de evento | marketing |
| `MaterialModal` | Modal de material | marketing |
| `LeadEditInline` | Edição inline de lead | vendedor |
| `Login` | Login local | — |
| `LoginAuth` | Login Supabase | — |
| `NovaSenha` | Troca de senha | — |

### Componentes Compartilhados (`src/components/ui.jsx`)

| Componente | Descrição |
|------------|-----------|
| `Icon` | Sistema de ícones SVG (16 variantes) |
| `StatusBadge` | Badge de status do evento |
| `TipoBadge` | Badge de tipo do evento |
| `Kpi` | Card de KPI com ícone e alerta |
| `ChartView` | Wrapper Chart.js com lifecycle correto |

### Contextos

| Contexto | Localização | Descrição |
|----------|-------------|-----------|
| `AppContext` | `src/main.jsx:69` | Contexto React criado com `createContext(null)` |
| `AppProvider` | `src/main.jsx:104–268` | Provider com estado global e ações expostas |

**Valores expostos pelo AppProvider:**
- Estado: `materiais`, `eventos`, `leads`, `vendedores`, `isLoading`, `syncStatus`
- Ações: `addEvento`, `updateEvento`, `getEvento`, `getEventosAtivos`, `addLead`, `updateLead`, `removeLead`, `getLeadsEvento`, `obterRanking`, `addMaterial`, `updateMaterial`, `getMateriaisDisponiveis`, `addVendedor`, `updateVendedor`, `toggleVendedor`, `recarregar`

### Hooks

| Hook | Localização | Descrição |
|------|-------------|-----------|
| `useApp()` | `src/main.jsx:70–74` | Consumer do AppContext (wrapper fino) |
| `usePersisted()` | `src/main.jsx:77–102` | Sincroniza estado com localStorage/sessionStorage |
| `useRanking()` | Inline em VendedorApp | Polling de ranking com debounce (não exportado) |

> Nenhum hook foi extraído para arquivo próprio ainda — previsto nas Etapas 7 e 15.

### Utilitários (`src/utils/`)

| Arquivo | Exports principais |
|---------|-------------------|
| `format.js` | `SERVICO_LABEL`, `TIPO_LABEL`, `STATUS_LABEL`, `servicoLabel()`, `tipoLabel()`, `fmtDate()`, `fmtDateLong()`, `initials()` |
| `masks.js` | `validarCpf()`, `validarTelefone()`, `maskCpf()`, `maskTel()` |
| `csv.js` | `exportLeadsCSV()` — gera CSV UTF-8 BOM com 11 colunas |
| `mockData.js` | `MOCK_MATERIAIS` (12), `MOCK_VENDEDORES` (6), `MOCK_EVENTOS` (2), `MOCK_LEADS` (1) |

### Camada de Dados (`src/lib/dataService.js` — 394 linhas)

- Mapeamento automático camelCase ↔ snake_case
- Retry com backoff exponencial (800ms inicial, 2× por tentativa)
- Subscriptions realtime via canais Supabase (debounce 400ms)
- Fila offline: operações enfileiradas ao perder conexão, sincronizadas ao reconectar
- Rastreamento de performance com alertas para requisições lentas
- `AbortController` para cancelamento de fetches

---

## Fluxos Críticos

### Login

**Modo local:** credenciais via `VITE_MARKETING_USER` / `VITE_MARKETING_PASS`, sem Supabase.  
**Modo Supabase:** `auth.signIn()` → sessão persistida → `RootAuth` reage ao `onAuthStateChange`.

### Eventos

`EventosTab` → `addEvento` / `updateEvento` (AppProvider) → `db.eventos.*` (dataService) → Supabase ou localStorage.

### Leads

`CheckinTab` (vendedor) ou `LeadsTab` (marketing) → `addLead` / `updateLead` → `db.leads.*` → tabela `leads` com `vendedor_id = auth.uid()`.

### Estoque

`EstoqueTab` → `addMaterial` / `updateMaterial` → `db.materiais.*` → tabela `materiais`.

### Ranking

`obterRanking(eventoId)` → `rankingEvento()` (dataService) → cache TTL 30s → RPC Supabase ou cálculo local.

### Realtime

`subscribeChanges(tabela, callback)` → canal Supabase Realtime → debounce 400ms → recarrega dados afetados.

### Sincronização

`syncStatus` no contexto rastreia o estado: `SYNC_STATUS.SYNCED | SYNCING | OFFLINE | ERROR`.  
`flushPendingQueue()` processa fila de operações acumuladas offline.

### Modo Local

Sem `VITE_SUPABASE_URL` → `supabaseEnabled = false` → `mockData.js` como seed inicial → tudo salvo em localStorage.

### Modo Supabase

Com `VITE_SUPABASE_URL` → cliente Supabase inicializado → Auth + RLS + Realtime ativos.

---

## Dependências Entre Módulos

```
Root / RootAuth / RootLegacy
        ↓
  MarketingApp / VendedorApp
        ↓
  Feature Components (Tabs, Modals)
        ↓
  useApp() → AppContext
        ↓
  AppProvider (estado global)
        ↓
  src/lib/dataService.js
        ↓
  src/lib/supabase.js → Supabase Cloud
        ↓
  src/lib/cache.js (ranking)
        ↓
  src/lib/security.js (sanitização antes de gravar)

  Feature Components também usam:
  ├── src/components/ui.jsx (Icon, Kpi, ChartView, badges)
  ├── src/utils/format.js (labels, datas)
  ├── src/utils/masks.js (validação de formulários)
  ├── src/utils/csv.js (export)
  └── src/lib/constants.js (enums e limites)
```

---

## Banco de Dados (Supabase / PostgreSQL)

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `materiais` | Estoque de materiais promocionais |
| `eventos` | Eventos (datas, local, tipo, status, materiais JSONB) |
| `leads` | Leads capturados por evento e vendedor |
| `perfis` | Perfis de usuários Auth (papel: marketing/vendedor) |
| `vendedores` | Tabela legada (substituída por `perfis` no modo Auth) |

### Enums

- **status evento:** `planejado`, `ativo`, `encerrado`
- **tipo evento:** `sinalizacao`, `presenca_comercial`, `ativacao_especial`
- **temperatura lead:** `frio`, `morno`, `quente`, `convertido`
- **papel perfil:** `marketing`, `vendedor`

### RLS (Row Level Security)

- `marketing`: acesso total a todas as tabelas
- `vendedor`: leitura de todos os leads; escrita/edição apenas nos próprios leads (`vendedor_id = auth.uid()`)

---

## Autenticação

Dois modos:

1. **Local:** Credenciais simples (`VITE_MARKETING_USER` / `VITE_MARKETING_PASS`), sem Supabase
2. **Supabase Auth:** Login email/senha com RBAC via RLS — recomendado para produção

---

## Segurança

- `sanitizeText()` em todos os inputs antes de gravar no DB
- XSS prevenido por: auto-escaping do JSX + `escapeHtml()` explícito quando necessário
- SQL injection prevenido por: Supabase usa queries parametrizadas (sem concatenação)
- RLS como segunda linha de defesa
- Headers CSP, HSTS, X-Frame-Options configurados no `vercel.json`

---

## Convenções de Desenvolvimento

- **Não alterar comportamento** durante refatorações — mover código, nunca reescrever.
- **Uma etapa por commit** — nunca misturar etapas em um mesmo commit.
- **Executar build após cada etapa** — `npm run build` deve passar sem erros.
- **Atualizar `REFATORAÇÃO.md`** após concluir uma etapa (marcar como ✅).
- **Atualizar `CLAUDE.md`** sempre que a arquitetura mudar.
- **Não executar etapas futuras** sem autorização explícita do usuário.
- **Não mover código** sem validar todos os imports e exports afetados.
- **Sempre analisar o estado atual** antes de modificar qualquer arquivo.
- **Não inventar estrutura** — documentar apenas o que existe no código.

---

## Decisões Arquiteturais

### 2026-06-15 — Etapa 4: Mock Data mantido inline até extração

Pacotes de dados mock (`MOCK_LEADS`, `MOCK_VENDEDORES`) foram mantidos em `main.jsx` temporariamente devido ao forte acoplamento com a renderização do `VendedorApp`. Extraídos na Etapa 4 para `src/utils/mockData.js`.

### 2026-06-15 — Etapa 6: Componentes visuais agrupados em `ui.jsx`

Componentes genéricos reutilizáveis (`Icon`, `StatusBadge`, `TipoBadge`, `Kpi`, `ChartView`) foram agrupados em um único arquivo `src/components/ui.jsx` para evitar fragmentação prematura antes de existir estrutura de pastas por feature.

---

## Variáveis de Ambiente

Copie `.env.example` para `.env.local` e preencha:

```bash
VITE_SUPABASE_URL=        # URL do projeto Supabase
VITE_SUPABASE_ANON_KEY=   # Chave pública anon

VITE_MARKETING_USER=marketing   # Modo local (sem Supabase)
VITE_MARKETING_PASS=

TEST_MARKETING_USER=marketing   # Credenciais para testes E2E
TEST_MARKETING_PASS=
```

Sem `VITE_SUPABASE_URL`, o app usa localStorage como fallback.

---

## Scripts

```bash
npm run dev          # Dev server em localhost:3000
npm run build        # Build de produção → dist/
npm run preview      # Preview do build

npm test             # E2E Playwright completo
npm run test:unit    # Testes unitários (security + lead)
npm run test:all     # Suite completa
npm run test:ui      # Playwright modo UI
npm run test:report  # Relatório HTML
npm run test:security # Testes de segurança E2E
```

---

## Setup para Produção (Supabase)

1. Executar `supabase/schema.sql` no SQL Editor do Supabase
2. Executar `supabase/migracao-auth.sql` para Auth + RLS
3. Criar primeiro usuário marketing:
   ```sql
   UPDATE perfis SET papel = 'marketing', ativo = true WHERE email = 'seu@email.com';
   ```
4. Configurar variáveis de ambiente na Vercel (Settings → Environment Variables)
5. Deploy automático ao fazer push na branch principal

---

## Testes

### E2E (Playwright)

Dois servidores configurados no `playwright.config.js`:
- `localhost:3000` — modo local (localStorage, sem Supabase)
- `localhost:3001` — modo Supabase simulado (env mocked, REST interceptado via `page.route`)

Execução sequencial (1 worker) para evitar conflitos de estado React.

### Unitários (Node.js)

```bash
node tests/security.unit.test.js  # sanitização e validação
node tests/lead.unit.test.js       # validação de leads
```

---

## Métricas do Projeto

| Métrica | Valor |
|---------|-------|
| Arquivos totais (src/) | 12 |
| Componentes React | 21 (em main.jsx + ui.jsx) |
| Hooks definidos | 3 (useApp, usePersisted, useRanking) |
| Contextos | 1 (AppContext / AppProvider) |
| Módulos de dados | 1 (dataService.js) |
| Tamanho atual de main.jsx | 2.270 linhas |
| Arquivos de teste | 11 (1.289 linhas totais) |
| Refatoração concluída | 33% (6/18 etapas) |

---

## Arquivos Críticos

| Arquivo | Linhas | Propósito |
|---------|--------|-----------|
| `src/main.jsx` | 2.270 | Monólito: contexto, provider, todos os componentes e hooks |
| `src/lib/dataService.js` | 394 | Queries Supabase, auth, realtime, fila offline, retry |
| `src/components/ui.jsx` | 78 | Componentes visuais genéricos reutilizáveis |
| `src/utils/mockData.js` | 57 | Dados mock para modo local (seed inicial) |
| `src/lib/security.js` | 47 | Sanitização de inputs (browser) |
| `src/utils/masks.js` | 34 | Validação e máscaras de CPF/telefone |
| `src/lib/cache.js` | 32 | Cache em memória TTL (ranking) |
| `src/lib/constants.js` | 29 | Enums e limites de domínio |
| `src/utils/format.js` | 21 | Formatadores de data e labels |
| `src/utils/csv.js` | 20 | Export CSV de leads |
| `src/lib/supabase.js` | 23 | Inicialização do cliente Supabase |
| `supabase/schema.sql` | 134 | Schema e seed |
| `supabase/migracao-auth.sql` | 194 | RLS e Auth |
| `vercel.json` | ~35 | Headers CSP e segurança |
| `REFATORAÇÃO.md` | ~1.400 | Plano completo de refatoração (18 etapas) |
