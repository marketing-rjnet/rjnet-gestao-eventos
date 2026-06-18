# SYSTEM_MAP.md — RJNet Gestão de Eventos

> Fonte única de verdade sobre a arquitetura viva do sistema.
> Localização: `doc/architecture/SYSTEM_MAP.md` — carregado automaticamente via `@import` no `CLAUDE.md`.
> Atualizado em: 2026-06-18 (D-051 — fix contagem sessão; D-050 — status vendedor nos cards; D-049 — sync_ok removeLead + perf tiers; D-048 — marcadores de sessão + limpar log; D-047 — fix canal único Realtime; D-046 — Monitor Realtime entre dispositivos; D-045 — Monitor histórico por dia; D-044b — Monitor v2; D-044 — aba Monitor; D-036, D-037, D-038 — quick wins de performance)
> Documentação de performance: `doc/performance/` (backlog, auditoria, planos de teste, homologação)
> Documentação de UI/UX: `doc/ui/UI_VERSIONS.md` — catálogo de versões da interface (v1.0 baseline catalogado em 2026-06-18)

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
| `createLeadApi` | `addLead`, `updateLead`, `removeLead`, `obterRanking` |
| `createMaterialApi` | `addMaterial`, `updateMaterial`, `addMaterialEvento`, `removeMaterialEvento`, `toggleRetornadoEvento` |
| `createVendedorApi` | `addVendedor`, `updateVendedor`, `toggleVendedor` |
| `createEquipeApi` | `criarUsuario`, `atualizarPerfil`, `excluirUsuario` |

As factories são instanciadas dentro do `AppProvider` e expostas via contexto. **Nenhum componente acessa o banco diretamente.**

### Camada de Dados (`src/lib/dataService.js`)

Única ponte entre a aplicação e o Supabase. Responsabilidades:

- Mapeamento automático **camelCase ↔ snake_case**
- `withRetry(fn)` — backoff exponencial (base 800 ms, máx. 3 tentativas)
- `trackPerf(label, fn)` — alerta para requisições lentas (>1 s)
- **Fila offline**: operações de `saveLead` são enfileiradas no `localStorage` quando offline e sincronizadas em `flushPendingQueue()` ao reconectar
- **Cache em memória** (`src/lib/cache.js`) com TTL de 30 s para resultados de `rankingEvento`
- Subscriptions realtime via canais Supabase com debounce de 400 ms

### Detecção de Modo (`src/lib/supabase.js` + `src/lib/mode.js`)

`src/lib/supabase.js` inicializa o cliente e exporta `supabaseEnabled`:

```js
export const supabase = url && anonKey ? createClient(...) : null;
export const supabaseEnabled = Boolean(supabase);
```

`src/lib/mode.js` exporta `isSupabaseMode()` e `getMode()` como abstração sobre `supabaseEnabled`. Todos os módulos que precisam detectar o modo ativo **devem importar `isSupabaseMode` de `./mode`**, nunca `supabaseEnabled` diretamente de `./supabase`.

- `isSupabaseMode() === true` → modo Supabase (auth, realtime, RLS)
- `isSupabaseMode() === false` → modo local (localStorage, mock data)

O tema dark/light é gerenciado em `Root.jsx` via `localStorage("rjnet-theme")`.

---

## 3. Estrutura de Diretórios

```
src/
├── main.jsx                    # ErrorBoundary + ReactDOM.createRoot
├── index.css                   # Estilos globais (tema dark/light via CSS variables)
├── api/
│   ├── eventoApi.js            # Factory CRUD de eventos
│   ├── leadApi.js              # Factory CRUD de leads + obterRanking
│   ├── materialApi.js          # Factory CRUD de materiais
│   ├── vendedorApi.js          # Factory CRUD de vendedores (modo local)
│   └── equipeApi.js            # Factory de gestão de usuários Auth (modo Supabase)
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
│   ├── team/
│   │   ├── EquipeTab.jsx       # Vendedores (modo local)
│   │   ├── EquipeAuthTab.jsx   # Usuários com RBAC (modo Supabase)
│   │   └── index.js
│   └── monitoring/
│       ├── MonitoringTab.jsx   # Diagnóstico ao vivo + histórico por dia: cards, feed com descrições, seletor de dias (D-044, D-044b, D-045)
│       └── index.js
├── hooks/
│   ├── useApp.js               # Wrapper de useContext(AppContext)
│   ├── usePersisted.js         # Persistência em localStorage/sessionStorage
│   └── useRanking.js           # Polling de ranking com debounce e cache
├── utils/
│   ├── format.js               # fmtDate, fmtDateLong, initials, label maps
│   ├── masks.js                # maskCpf, maskTel, validarCpf, validarTelefone
│   ├── csv.js                  # exportLeadsCSV
│   ├── ids.js                  # genId(prefix) — gerador de IDs temporários para modo local
│   └── mockData.js             # MOCK_* para modo local
└── lib/
    ├── supabase.js             # Cliente Supabase + supabaseEnabled (feature flag de modo)
    ├── dataService.js          # Queries, auth, realtime, retry, fila offline
    ├── activityLog.js          # Buffer circular localStorage + Supabase Realtime broadcast (D-044, D-045, D-046)
    ├── crypto.js               # PA-05/LGPD: AES-GCM 256 + PBKDF2 para fila offline no localStorage
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

Shell do time de marketing. Navegação por 6 tabs:

| Tab | Componente | Função |
|---|---|---|
| Eventos | `EventosTab` / `EventDetail` | CRUD de eventos, materiais alocados, leads por vendedor |
| Estoque | `EstoqueTab` | Gestão de materiais com nível de disponibilidade |
| Leads | `LeadsTab` | Visão consolidada de leads, filtros, export CSV, gráfico |
| Equipe | `EquipeAuthTab` / `EquipeTab` | CRUD de vendedores / usuários com RBAC |
| Check-in | `CheckinTab` | Busca de lead por CPF em evento ativo |
| Monitor | `MonitoringTab` | Diagnóstico ao vivo + histórico por dia: seletor de datas, cards com status de atividade do vendedor, feed 9 tipos, filtros Sync/Perf, descrições de campo, toolbar de sessão (▶/■) + limpar log (D-044–D-051) |

### `VendedorApp.jsx`

Shell do vendedor em campo. Navegação por 4 tabs (bottom nav mobile-first):

| Tab | Função |
|---|---|
| Registrar | Formulário de captura de lead com modo rápido, multi-seleção de serviços, controle Sim/Não para "já é cliente", auto-sanitização, toast com undo, barra de meta em 3 níveis (Bronze/Prata/Ouro) |
| Meus Leads | Lista filtrável, edição inline, ciclo de temperatura, links tel/WhatsApp, exclusão de lead com confirmação inline em dois passos |
| Evento | Detalhes do evento ativo, link Maps, ranking da equipe |
| Pacotes | Tabela de preços dos serviços RJNet (hardcoded) |

---

## 5. Domínios de Negócio

### Eventos
Unidade central. Possui `status` (`planejado` / `ativo` / `encerrado`), `tipo`, datas, local, e um array `materiais` (JSONB no Supabase). Leads e rankings são sempre associados a um evento.

### Leads
Capturados por vendedores em campo, vinculados a `eventoId` e `vendedorNome`. Têm `temperatura` (`frio` / `morno` / `quente` / `convertido`) e `servicoInteresse` (array de strings — ver D-026). Suportam soft delete via flag `deletado`.

> **`servicoInteresse` é array:** no frontend sempre `string[]`; no banco (`servico_interesse` TEXT) armazenado como JSON string. `leadFromDb` normaliza strings legadas para `[string]` automaticamente. `servicoLabel()` aceita string ou array.

### Estoque
Materiais promocionais com `quantidade` e `nivel` derivado (`crit` / `warn` / `ok`). Alocados a eventos via `evento.materiais[]`.

### Check-in
Busca de lead por CPF dentro de um evento. Registra presença sem criar novo lead.

### Equipe
- Modo local: tabela `vendedores` (CRUD simples, `ativo` flag)
- Modo Supabase: tabela `perfis` com `papel` e `ativo`; criação via Edge Function `atualizar-email-usuario`
- **Troca de email:** `atualizarPerfil` chama a Edge Function (`atualizar-email`) para atualizar `auth.users` via Admin API e, em seguida, dispara automaticamente `resetPasswordForEmail()` para o novo endereço — o usuário recebe um link para definir a senha antes do primeiro login

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
    ↓ subscription realtime notifica AppProvider (debounce 1500ms — D-038)
AppProvider re-sincroniza estado com dados do banco
```

**Erros de sync** são despachados via `window.dispatchEvent(new CustomEvent('rjnet:sync-error'))` e capturados pelo `SyncBadge` e pelo `activityLog`.

**Log de atividade** — `src/lib/activityLog.js` instrumenta 7 pontos do fluxo, despacha `CustomEvent('rjnet:activity')` e transmite via Supabase Realtime Broadcast (canal `rjnet-monitor`) para cobertura entre dispositivos (D-044, D-044b, D-046). `MonitoringTab` escuta 3 canais: CustomEvent (mesma aba), `storage` event (outra aba/janela) e Realtime Broadcast (outro dispositivo):
- `dataService.trackPerf` → `perf_warn` quando req > 1 s
- `dataService.exec` → `sync_error` junto ao dispatch de `rjnet:sync-error`
- `dataService.addToQueue` → `offline_queue` ao enfileirar lead
- `leadApi.addLead` → `lead_add` com vendedorNome + eventoId
- `leadApi.addLead` onSuccess → `lead_sync_ok` após confirmação do Supabase (D-044b)
- `leadApi.updateLead` → `lead_update` com vendedorNome + eventoId
- `leadApi.updateLead` onSuccess → `lead_sync_ok` após confirmação do Supabase (D-044b)
- `leadApi.removeLead` → `lead_remove` com vendedorNome + eventoId

---

## 7. Regras Técnicas Atuais

- **`supabaseEnabled` de `src/lib/supabase.js`** é a única fonte de verdade sobre o modo ativo
- **API factory pattern é obrigatório**: todo CRUD passa por `src/api/`, nunca direto ao `dataService`
- **RLS ativo no Supabase**: `marketing` tem acesso total; `vendedor` só escreve/edita próprios leads (`vendedor_id = auth.uid()`)
- **Updates otimistas**: estado local muda antes da resposta do banco
- **Retry com backoff**: `withRetry()` — base 800 ms, fator 2x, máx. 3 tentativas
- **Timeout de fetch**: `carregar()` usa `AbortSignal.any([controller, AbortSignal.timeout(15s)])` — evita loading infinito (D-036)
- **Realtime com debounce**: subscriptions Supabase com 1500 ms de debounce (`REALTIME_DEBOUNCE_MS` — D-038, era 400 ms; agora corretamente referenciado em `subscribeChanges`)
- **Leads on-demand por evento**: `fetchAll` não carrega leads no boot. Leads são carregados via `carregarLeadsEvento(eventoId)` — D-039:
  - Vendedor: ao selecionar evento ativo
  - Marketing/EventDetail: ao abrir detalhe do evento
  - Export: `fetchLeadsEvento` (1 evento) ou `fetchLeadsEventos` (N eventos, consolidado)
- **Fila offline**: leads capturados offline são enfileirados e sincronizados ao reconectar
- **Sanitização obrigatória**: `sanitizeText()` em todos os inputs antes de persistir
- **Cache de ranking**: TTL de 30 s, invalidado a cada mutação de lead
- **`servicoInteresse` é sempre array no frontend**: `leadFromDb` normaliza strings legadas; `leadToDb` serializa como JSON string na coluna TEXT existente (D-026)
- **Metas em 3 níveis**: `META_BRONZE=20`, `META_PRATA=40`, `META_OURO=60` em `constants.js`; `META_DIARIA` é alias de `META_OURO` (D-027)
- **Log de atividade em localStorage por data**: `activityLog.js` mantém buffer circular de 200 entradas por dia em chave `rjnet_activity_YYYY-MM-DD`; persiste entre fechamentos de aba; auto-purge após 30 dias; sem persistência no banco (D-044, D-045)
- **`exec(promise, acao, onFail, onSuccess)`**: 4º parâmetro opcional — chamado após escrita bem-sucedida no Supabase (1ª tentativa ou retry) e imediatamente no modo local; usado por `db.saveLead` para acionar `lead_sync_ok` no feed do Monitor (D-044b)
- **9 tipos de evento no Monitor**: `lead_add`, `lead_update`, `lead_remove`, `lead_sync_ok`, `sync_error`, `perf_warn`, `offline_queue`, `session_start`, `session_end` — cada tipo tem marca visual e cor; `session_start`/`session_end` rendem como separadores roxos no feed e não aparecem nos filtros Leads/Sync/Perf nem nos stats; filtros `Sync` e `Perf` são separados (D-044b, D-048)
- **Contagem de leads ao encerrar sessão**: `lead_add - lead_remove` desde o `ts` do último `session_start`; `Math.max(0)` protege contra negativo; fallback conta tudo se não houver session_start (D-051)
- **Status de atividade do vendedor nos cards**: `vendorStatus(lastTs)` — 4 tiers por elapsed time (< 5min verde, < 30min amarelo, < 24h cinza, ≥ 24h inativo); ponto colorido sobreposto ao avatar; tick de 30s interno ao VendedorCard (D-050)
- **perf_warn com severidade dinâmica**: `getPerfCfg(ms)` — 4 tiers (lenta/muito lenta/possível timeout/timeout de rede) com cor e label distintos; `getDesc` adiciona prefixo de contexto para ms ≥ 30s (D-049)
- **sync_ok para todos os tipos de mutação de lead**: `lead_add`, `lead_update` e `lead_remove` disparam `lead_sync_ok` após confirmação do Supabase via `onSuccess` em `exec()`; `db.removeLead` aceita 3º param `onSuccess` (D-049)
- **Realtime Broadcast do Monitor (canal único)**: `activityLog.js` é o único dono do canal `rjnet-monitor` — registra `.on('broadcast', { event: 'log' }, handler)` ANTES de `.subscribe()` (requisito do Supabase JS v2). `MonitoringTab` registra callbacks via `subscribeToRemoteLogs(callback)` — nunca abre canal próprio. Fila `_queue` garante entrega de mensagens enviadas antes de `SUBSCRIBED`. Canal público (anon key), multiplexado na WebSocket existente (D-046, D-047)

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
