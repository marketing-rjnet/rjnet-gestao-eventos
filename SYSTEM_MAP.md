# SYSTEM_MAP.md — RJNet Gestão de Eventos

> Fonte única de verdade sobre a arquitetura viva do sistema.
> Atualizado em: 2026-06-16

---

## 1. Visão Geral do Sistema

SPA React para gerenciamento de eventos de campo da RJNet. Permite que o time de marketing crie e gerencie eventos, estoque e equipe, enquanto vendedores em campo capturam leads e acompanham desempenho em tempo real.

Dois perfis de acesso: **marketing** (gestão completa) e **vendedor** (captura de leads + ranking).  
Dois modos de operação: **Supabase** (produção, com auth e realtime) e **local** (localStorage, sem backend).

---

## 2. Arquitetura Atual

### Frontend (React)

- React 19 + Vite 8, sem biblioteca de roteamento (tab switching via `useState`)
- Sem biblioteca de formulários (vanilla `useState`)
- Sem UI framework (CSS custom via `index.css` + CSS variables para tema dark/light)
- Chart.js 4 para gráficos (donut de leads por serviço)

### Estado Global

- `AppContext` (React Context) via `src/context/AppContext.js`
- `AppProvider` em `src/context/AppProvider.jsx` é o único orquestrador de estado e efeitos
- Hook `usePersisted()` sincroniza estado com `localStorage` / `sessionStorage`
- Hook `useApp()` é o único ponto de consumo do contexto nos componentes
- Atualizações **otimistas**: estado local muda antes da confirmação do Supabase

### Camada de API (`src/api/`)

Padrão **factory function** — cada domínio tem uma factory que recebe estado e retorna operações:

| Factory | Operações |
|---|---|
| `createEventoApi` | `addEvento`, `updateEvento`, `removeEvento`, `patchEvento` |
| `createLeadApi` | `addLead`, `updateLead`, `removeLead` |
| `createMaterialApi` | `addMaterial`, `updateMaterial`, `addMaterialEvento`, `removeMaterialEvento`, `toggleRetornadoEvento` |
| `createVendedorApi` | `addVendedor`, `updateVendedor`, `toggleVendedor` |

As factories são instanciadas dentro do `AppProvider` e expostas via contexto. **Nenhum componente acessa o banco diretamente.**

### Camada de Dados (`src/lib/dataService.js`)

Única ponte entre a aplicação e o Supabase. Responsabilidades:

- Mapeamento automático **camelCase ↔ snake_case**
- `withRetry(fn)` — backoff exponencial (base 800 ms, máx. 3 tentativas)
- `trackPerf(label, fn)` — alerta para requisições lentas (>1 s)
- **Fila offline**: operações de `saveLead` são enfileiradas no `localStorage` quando offline e sincronizadas em `flushPendingQueue()` ao reconectar
- **Cache em memória** (`src/lib/cache.js`) com TTL de 30 s para resultados de `rankingEvento`
- Subscriptions realtime via canais Supabase com debounce de 400 ms

### Detecção de Modo (`src/lib/supabase.js`)

> **`src/lib/mode.js` não existe.** A detecção de modo é feita por `supabaseEnabled` exportado de `src/lib/supabase.js`.

```js
export const supabase = url && anonKey ? createClient(...) : null;
export const supabaseEnabled = Boolean(supabase);
```

- `supabaseEnabled === true` → modo Supabase (auth, realtime, RLS)
- `supabaseEnabled === false` → modo local (localStorage, mock data)

O tema dark/light é gerenciado em `Root.jsx` via `localStorage("rjnet-theme")`, não via `mode.js`.

---

## 3. Estrutura de Diretórios

```
src/
├── main.jsx                    # ErrorBoundary + ReactDOM.createRoot
├── index.css                   # Estilos globais (tema dark/light via CSS variables)
├── api/
│   ├── eventoApi.js            # Factory CRUD de eventos
│   ├── leadApi.js              # Factory CRUD de leads
│   ├── materialApi.js          # Factory CRUD de materiais
│   └── vendedorApi.js          # Factory CRUD de vendedores
├── context/
│   ├── AppContext.js           # createContext(null)
│   ├── AppProvider.jsx         # Provider: estado + efeitos + factories
│   └── index.js                # Re-exports
├── apps/
│   ├── Root.jsx                # Roteador raiz: modo + tema
│   ├── MarketingApp.jsx        # Shell marketing (5 tabs)
│   └── VendedorApp.jsx         # Shell vendedor (4 tabs + LeadEditInline)
├── auth/
│   ├── RootAuth.jsx            # Fluxo auth Supabase
│   ├── RootLegacy.jsx          # Fluxo auth local
│   ├── LoginAuth.jsx           # Login email/senha (Supabase)
│   ├── Login.jsx               # Login legado
│   ├── NovaSenha.jsx           # Redefinição de senha por link
│   └── index.js
├── components/
│   ├── ui.jsx                  # Icon, StatusBadge, TipoBadge, Kpi, ChartView
│   ├── SyncBadge.jsx           # Indicador visual de sincronização
│   └── modals/
│       ├── EventModal.jsx
│       ├── MaterialModal.jsx
│       └── index.js
├── features/
│   ├── events/
│   │   ├── Dashboard.jsx       # KPIs, gráfico donut, próximos eventos
│   │   ├── EventosTab.jsx      # Lista de eventos com filtros de status
│   │   ├── EventDetail.jsx     # Detalhe: materiais e leads do evento
│   │   └── index.js
│   ├── inventory/
│   │   ├── EstoqueTab.jsx
│   │   └── index.js
│   ├── leads/
│   │   ├── LeadsTab.jsx        # Filtros, gráfico, export CSV
│   │   └── index.js
│   ├── checkin/
│   │   ├── CheckinTab.jsx      # Busca de lead por CPF
│   │   └── index.js
│   └── team/
│       ├── EquipeTab.jsx       # Vendedores (modo local)
│       ├── EquipeAuthTab.jsx   # Usuários com RBAC (modo Supabase)
│       └── index.js
├── hooks/
│   ├── useApp.js               # Wrapper de useContext(AppContext)
│   ├── usePersisted.js         # Persistência em localStorage/sessionStorage
│   └── useRanking.js           # Polling de ranking com debounce e cache
├── utils/
│   ├── format.js               # fmtDate, fmtDateLong, initials, label maps
│   ├── masks.js                # maskCpf, maskTel, validarCpf, validarTelefone
│   ├── csv.js                  # exportLeadsCSV
│   └── mockData.js             # MOCK_* para modo local
└── lib/
    ├── supabase.js             # Cliente Supabase + supabaseEnabled (feature flag de modo)
    ├── dataService.js          # Queries, auth, realtime, retry, fila offline
    ├── security.js             # sanitizeText() — sanitização de inputs
    ├── cache.js                # Cache em memória com TTL
    └── constants.js            # Constantes globais e enums de domínio
```

---

## 4. Apps Principais

### `Root.jsx`

Ponto de entrada após `main.jsx`. Detecta modo (`supabaseEnabled`) e gerencia tema via `localStorage`.

- `supabaseEnabled` → `RootAuth` → Supabase session → papel do usuário → `MarketingApp` ou `VendedorApp`
- `!supabaseEnabled` → `RootLegacy` → credenciais de env → `MarketingApp` ou `VendedorApp`

### `MarketingApp.jsx`

Shell do time de marketing. Navegação por 5 tabs:

| Tab | Componente | Função |
|---|---|---|
| Eventos | `EventosTab` / `EventDetail` | CRUD de eventos, materiais alocados, leads por vendedor |
| Estoque | `EstoqueTab` | Gestão de materiais com nível de disponibilidade |
| Leads | `LeadsTab` | Visão consolidada de leads, filtros, export CSV, gráfico |
| Equipe | `EquipeAuthTab` / `EquipeTab` | CRUD de vendedores / usuários com RBAC |
| Check-in | `CheckinTab` | Busca de lead por CPF em evento ativo |

### `VendedorApp.jsx`

Shell do vendedor em campo. Navegação por 4 tabs (bottom nav mobile-first):

| Tab | Função |
|---|---|
| Registrar | Formulário de captura de lead com modo rápido, auto-sanitização, toast com undo |
| Meus Leads | Lista filtrável, edição inline, ciclo de temperatura, links tel/WhatsApp |
| Evento | Detalhes do evento ativo, link Maps, ranking da equipe |
| Pacotes | Tabela de preços dos serviços RJNet (hardcoded) |

---

## 5. Domínios de Negócio

### Eventos
Unidade central. Possui `status` (`planejado` / `ativo` / `encerrado`), `tipo`, datas, local, e um array `materiais` (JSONB no Supabase). Leads e rankings são sempre associados a um evento.

### Leads
Capturados por vendedores em campo, vinculados a `eventoId` e `vendedorNome`. Têm `temperatura` (`frio` / `morno` / `quente` / `convertido`) e `servicoInteresse`. Suportam soft delete via flag `deletado`.

### Estoque
Materiais promocionais com `quantidade` e `nivel` derivado (`crit` / `warn` / `ok`). Alocados a eventos via `evento.materiais[]`.

### Check-in
Busca de lead por CPF dentro de um evento. Registra presença sem criar novo lead.

### Equipe
- Modo local: tabela `vendedores` (CRUD simples, `ativo` flag)
- Modo Supabase: tabela `perfis` com `papel` e `ativo`; criação via Edge Function `atualizar-email-usuario`

### Materiais de Evento
Sub-domínio de estoque. Array JSONB dentro de cada evento. Suporta `quantidade`, `retornado` (flag de devolução).

---

## 6. Fluxo de Dados

```
Componente UI
    ↓ chama operação via useApp()
AppContext (exposto pelo AppProvider)
    ↓ chama factory de API (createEventoApi, createLeadApi, etc.)
src/api/*.js (factory)
    ↓ atualiza estado local (setState) — atualização otimista imediata
    ↓ chama db.save* / db.remove* de forma assíncrona
src/lib/dataService.js
    ↓ se online: upsert/delete no Supabase com withRetry()
    ↓ se offline (leads): enfileira em localStorage para flush posterior
Supabase (PostgreSQL + RLS)
    ↓ subscription realtime notifica AppProvider (debounce 400ms)
AppProvider re-sincroniza estado com dados do banco
```

**Erros de sync** são despachados via `window.dispatchEvent(new CustomEvent('rjnet:sync-error'))` e capturados pelo `SyncBadge`.

---

## 7. Regras Técnicas Atuais

- **`supabaseEnabled` de `src/lib/supabase.js`** é a única fonte de verdade sobre o modo ativo
- **API factory pattern é obrigatório**: todo CRUD passa por `src/api/`, nunca direto ao `dataService`
- **RLS ativo no Supabase**: `marketing` tem acesso total; `vendedor` só escreve/edita próprios leads (`vendedor_id = auth.uid()`)
- **Updates otimistas**: estado local muda antes da resposta do banco
- **Retry com backoff**: `withRetry()` — base 800 ms, fator 2x, máx. 3 tentativas
- **Realtime com debounce**: subscriptions Supabase com 400 ms de debounce
- **Fila offline**: leads capturados offline são enfileirados e sincronizados ao reconectar
- **Sanitização obrigatória**: `sanitizeText()` em todos os inputs antes de persistir
- **Cache de ranking**: TTL de 30 s, invalidado a cada mutação de lead

---

## 8. Dependências Críticas

| Dependência | Versão | Papel |
|---|---|---|
| `react` + `react-dom` | ^19.2.7 | Framework UI |
| `@supabase/supabase-js` | ^2.108.1 | Backend (auth, DB, realtime) |
| `chart.js` | ^4.5.1 | Gráfico donut de leads por serviço |
| `vite` + `@vitejs/plugin-react` | ^8.0.16 / ^6.0.2 | Build e dev server |
| `@playwright/test` | ^1.44.0 | Testes E2E |

**Sem dependências de:** React Router, Axios, Zustand, Redux, Tailwind, Material UI, i18n.

---

## 9. Restrições Arquiteturais

- **Sem lógica de negócio em componentes UI** — componentes só chamam operações via `useApp()`
- **Sem acesso a `import.meta.env` fora de `src/lib/supabase.js`** — demais módulos consomem `supabaseEnabled` ou `supabaseConfig`
- **Sem CRUD direto fora de `src/api/`** — nem contexto, nem componente acessa `dataService` diretamente
- **Sem "god services"** — cada factory de API tem escopo de um único domínio
- **Sem biblioteca de roteamento** — navegação por `useState` de tab ativa
- **Sem modo server-side** — SPA puro, deploy estático via Vercel
