# RJNet Gestão de Eventos — CLAUDE.md

## Visão Geral

Sistema de gerenciamento de eventos para a RJNet. Permite controle de eventos, estoque de materiais, captura de leads e gestão de equipe comercial.

**Stack:** React 19 + Vite 8 + Supabase (PostgreSQL + Auth) + Chart.js 4  
**Deploy:** Vercel  
**Testes:** Playwright (E2E) + Node.js (unitários)

---

## Estrutura do Projeto

> **Refatoração em andamento** — etapas 1–10 de 18 concluídas. Ver `REFATORAÇÃO.md`.

```
src/
├── main.jsx              # App React (~1.530 linhas) — componentes ainda não extraídos
├── index.css             # Estilos globais (tema dark)
├── auth/
│   ├── Login.jsx         # Formulário de login modo legado (etapa 8)
│   ├── LoginAuth.jsx     # Formulário de login Supabase + recuperação de senha (etapa 8)
│   ├── NovaSenha.jsx     # Formulário de redefinição de senha por link (etapa 8)
│   ├── RootAuth.jsx      # Roteador de auth modo Supabase (etapa 8)
│   ├── RootLegacy.jsx    # Roteador de auth modo legado (etapa 8)
│   └── index.js          # Re-exports de auth (etapa 8)
├── components/
│   ├── ui.jsx            # Icon, StatusBadge, TipoBadge, Kpi, ChartView (etapa 6)
│   ├── SyncBadge.jsx     # Indicador visual de sincronização (etapa 7)
│   └── modals/
│       ├── EventModal.jsx    # Modal de criação/edição de evento (etapa 9)
│       ├── MaterialModal.jsx # Modal de criação de material (etapa 9)
│       └── index.js          # Re-exports de modais (etapa 9)
├── features/
│   └── events/
│       ├── Dashboard.jsx     # KPIs, gráfico de leads, próximos eventos (etapa 10)
│       ├── EventosTab.jsx    # Lista de eventos com filtros de status (etapa 10)
│       ├── EventDetail.jsx   # Detalhe do evento, materiais e leads (etapa 10)
│       └── index.js          # Re-exports de events (etapa 10)
├── hooks/
│   └── useApp.js         # Hook useApp() — wrapper de useContext(AppContext) (etapa 7)
├── utils/
│   ├── format.js         # fmtDate, fmtDateLong, initials, label maps (etapa 1)
│   ├── masks.js          # maskCpf, maskTel, validarCpf, validarTelefone (etapa 2)
│   ├── csv.js            # exportLeadsCSV (etapa 3)
│   └── mockData.js       # MOCK_MATERIAIS, MOCK_VENDEDORES, MOCK_EVENTOS, MOCK_LEADS (etapa 4)
└── lib/
    ├── supabase.js       # Inicialização do cliente Supabase + supabaseEnabled
    ├── dataService.js    # Camada de dados (queries, auth, realtime, retry)
    ├── security.js       # Sanitização e XSS prevention
    ├── cache.js          # Cache em memória com TTL
    └── constants.js      # Constantes globais — SYNC_STATUS, STATUS_EVENTO, NIVEL_ESTOQUE, limites (etapas 5)

supabase/
├── schema.sql            # Schema inicial (4 tabelas + seed)
├── migracao-auth.sql     # RLS policies + integração Auth
├── protecao-dados.sql    # Soft delete
├── seed-usuarios-teste.sql
├── config.toml           # Config local do Supabase
└── functions/
    └── atualizar-email-usuario/index.ts  # Edge Function (gerenciamento de usuários)

tests/
├── security.test.js      # E2E: SQL injection, XSS
├── security.unit.test.js # Unit: funções de sanitização
├── lead.unit.test.js     # Unit: validação de leads
├── comercial.test.js     # E2E: dashboard comercial
├── estoque.test.js       # E2E: inventário
├── marketing.test.js     # E2E: dashboard marketing
└── helpers/auth.js       # Helpers de autenticação para testes

data/
├── colaboradores.example.json
└── estoque.example.json
```

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

## Banco de Dados (Supabase / PostgreSQL)

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `materiais` | Estoque de materiais promocionais |
| `eventos` | Eventos (datas, local, tipo, status, materiais JSONB) |
| `leads` | Leads capturados por evento e vendedor |
| `perfis` | Perfis de usuários Auth (papel: marketing/vendedor/comercial) |
| `vendedores` | Tabela legada (substituída por `perfis` no modo Auth) |

### Enums usados nos dados

- **status evento:** `planejado`, `ativo`, `encerrado`
- **tipo evento:** `sinalizacao`, `presenca_comercial`, `ativacao_especial`
- **temperatura lead:** `frio`, `morno`, `quente`, `convertido`
- **papel perfil:** `marketing`, `vendedor`

### RLS (Row Level Security)

- `marketing`: acesso total a todas as tabelas
- `vendedor`: leitura de todos os leads; escrita/edição apenas nos próprios leads (`vendedor_id = auth.uid()`)

---

## Arquitetura

### Gerenciamento de Estado

- `AppContext` (React Context) envolve o app inteiro
- Hook `usePersisted()` sincroniza estado com localStorage/sessionStorage
- Atualizações otimistas: UI muda imediatamente, sync com DB é assíncrono

### Camada de Dados (`src/lib/dataService.js`)

- Mapeamento automático camelCase ↔ snake_case
- Retry com backoff exponencial (800ms inicial, 2x por tentativa)
- Subscriptions realtime via canais Supabase (debounce de 400ms)
- Rastreamento de performance com alertas para requisições lentas
- Suporte a `AbortController` para cancelamento de fetches

### Segurança

- `sanitizeText()` em todos os inputs antes de gravar no DB
- XSS prevenido por: auto-escaping do JSX + `escapeHtml()` explícito quando necessário
- SQL injection prevenido por: Supabase usa queries parametrizadas (sem concatenação)
- RLS como segunda linha de defesa
- Headers CSP, HSTS, X-Frame-Options configurados no `vercel.json`

### Performance

- Cache com TTL de 30s para rankings de eventos
- Chart.js destruído no unmount (evita memory leak)

---

## Módulos da UI

| Tab | Papel | Funcionalidade |
|-----|-------|---------------|
| Dashboard | marketing | KPIs, gráfico de leads por serviço, alertas de estoque |
| Eventos | marketing | CRUD de eventos, alocação de materiais, resumo de leads por vendedor |
| Estoque | marketing | Gestão de materiais, status de disponibilidade |
| Leads | marketing | Visualização e filtros, export CSV, gráfico por evento |
| Equipe | marketing | CRUD de vendedores, desempenho por evento |

---

## Autenticação

Dois modos:

1. **Local:** Credenciais simples (`VITE_MARKETING_USER` / `VITE_MARKETING_PASS`), sem Supabase
2. **Supabase Auth:** Login email/senha com RBAC via RLS — recomendado para produção

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

## Deploy (Vercel)

- Build: `npm run build` → `dist/`
- Headers de segurança aplicados via `vercel.json`:
  - CSP com `connect-src` permitindo `*.supabase.co`
  - `X-Frame-Options: DENY`, HSTS, `nosniff`, `Permissions-Policy`

---

## Arquivos Críticos

| Arquivo | Linhas | Propósito |
|---------|--------|-----------|
| `src/main.jsx` | ~1.530 | Context, AppProvider, EstoqueTab, LeadsTab, EquipeTab, CheckinTab, MarketingApp, VendedorApp (refatoração em andamento) |
| `src/auth/Login.jsx` | ~55 | Login modo legado (etapa 8) |
| `src/auth/LoginAuth.jsx` | ~75 | Login Supabase + recuperação de senha (etapa 8) |
| `src/auth/NovaSenha.jsx` | ~55 | Redefinição de senha por link (etapa 8) |
| `src/auth/RootAuth.jsx` | ~38 | Roteador de auth modo Supabase (etapa 8) |
| `src/auth/RootLegacy.jsx` | ~25 | Roteador de auth modo legado (etapa 8) |
| `src/components/ui.jsx` | ~80 | Componentes UI atômicos extraídos (etapa 6) |
| `src/components/SyncBadge.jsx` | ~14 | Indicador de sincronização (etapa 7) |
| `src/components/modals/EventModal.jsx` | ~90 | Modal de criação/edição de evento (etapa 9) |
| `src/components/modals/MaterialModal.jsx` | ~50 | Modal de criação de material (etapa 9) |
| `src/features/events/Dashboard.jsx` | ~70 | KPIs, gráfico donut, próximos eventos (etapa 10) |
| `src/features/events/EventosTab.jsx` | ~60 | Lista de eventos com filtros (etapa 10) |
| `src/features/events/EventDetail.jsx` | ~175 | Detalhe do evento, materiais e leads (etapa 10) |
| `src/hooks/useApp.js` | ~8 | Hook de acesso ao contexto (etapa 7) |
| `src/utils/format.js` | ~21 | Formatação de datas, labels e iniciais (etapa 1) |
| `src/utils/masks.js` | ~34 | Máscaras e validadores de CPF/telefone (etapa 2) |
| `src/utils/csv.js` | ~20 | Exportação CSV de leads (etapa 3) |
| `src/utils/mockData.js` | ~57 | Dados mock para modo local (etapa 4) |
| `src/lib/constants.js` | ~29 | Constantes centralizadas (etapa 5) |
| `src/lib/dataService.js` | ~394 | Queries Supabase, auth, realtime, retry |
| `src/lib/security.js` | ~50 | Sanitização de inputs |
| `supabase/schema.sql` | ~135 | Schema e seed |
| `supabase/migracao-auth.sql` | ~195 | RLS e Auth |
| `vercel.json` | ~35 | Headers CSP e segurança |
| `playwright.config.js` | ~71 | Config E2E dual-server |
