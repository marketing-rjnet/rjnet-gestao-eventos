# RJNet Gestão de Eventos — CLAUDE.md

## Visão Geral

Sistema de gerenciamento de eventos para a RJNet. Permite controle de eventos, estoque de materiais, captura de leads e gestão de equipe comercial.

**Stack:** React 19 + Vite 8 + Supabase (PostgreSQL + Auth) + Chart.js 4  
**Deploy:** Vercel  
**Testes:** Playwright (E2E) + Node.js (unitários)

---

## Estrutura do Projeto

```
src/
├── main.jsx              # App React completo (~2.500 linhas) — todos os componentes
├── index.css             # Estilos globais (tema dark)
└── lib/
    ├── supabase.js       # Inicialização do cliente Supabase
    ├── dataService.js    # Camada de dados (queries, auth, realtime, retry)
    ├── security.js       # Sanitização e XSS prevention
    ├── cache.js          # Cache em memória com TTL
    └── constants.js      # Constantes globais (validações, metadados)

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

config/
└── security.js           # Utilitários de segurança Node.js (espelha src/lib/security.js)

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
- **papel perfil:** `marketing`, `vendedor`, `comercial`

### RLS (Row Level Security)

- `marketing`: acesso total a todas as tabelas
- `vendedor`: leitura de todos os leads; escrita/edição apenas nos próprios leads (`vendedor_id = auth.uid()`)
- `comercial`: somente leitura em leads e eventos

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
| Leads | marketing/comercial | Visualização e filtros, export CSV, gráfico por evento |
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
| `src/main.jsx` | ~2.500 | App inteiro: componentes, context, formulários, gráficos |
| `src/lib/dataService.js` | ~330 | Queries Supabase, auth, realtime, retry |
| `src/lib/security.js` | ~50 | Sanitização de inputs |
| `supabase/schema.sql` | ~135 | Schema e seed |
| `supabase/migracao-auth.sql` | ~195 | RLS e Auth |
| `vercel.json` | ~35 | Headers CSP e segurança |
| `playwright.config.js` | ~71 | Config E2E dual-server |
