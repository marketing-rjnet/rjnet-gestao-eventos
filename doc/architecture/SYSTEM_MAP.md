# SYSTEM_MAP.md — RJNet Gestão de Eventos

> Fonte única de verdade sobre a arquitetura viva do sistema.
> Localização: `doc/architecture/SYSTEM_MAP.md` — carregado automaticamente via `@import` no `CLAUDE.md`.
> Atualizado em: 2026-06-30 (D-056 — Estoque: edição de nome e quantidade de material existente via `MaterialModal` em modo dual create/edit); 2026-06-30 (correção de coesão documental: renumeração de D-043 duplicado → D-055 em `DECISIONS.md`; sincronização do status de PA-04/consentimento suspenso em `LGPD_AUDIT_AND_COMPLIANCE.md`; correção de status `v1.0` em `UI_VERSIONS.md`; `CLAUDE.md` atualizado para refletir V3 como versão de UI corrente); 2026-06-30 (D-054 — Estoque: checklist de importação persistente em localStorage, com formulário de novo item e exclusão por linha do rascunho); 2026-06-29 (D-053 — Estoque: importação em lote via checklist + exclusão de material; restrito ao perfil marketing); 2026-06-20 (D-052 — Monitor: timeout 15s em escrita, sync_error com vendedor via meta, stats.leads líquido, filtro Sync inclui lead_sync_ok; D-051 — fix contagem sessão; D-050 — status vendedor nos cards; D-049 — sync_ok removeLead + perf tiers; D-048 — marcadores de sessão + limpar log; D-047 — fix canal único Realtime; D-046 — Monitor Realtime entre dispositivos; D-045 — Monitor histórico por dia; D-044b — Monitor v2; D-044 — aba Monitor; D-036, D-037, D-038 — quick wins de performance)
> Documentação de performance: `doc/performance/` (backlog, auditoria, planos de teste, homologação)
> Documentação de UI/UX: `doc/ui/UI_VERSIONS.md` — catálogo de versões da interface. **V3 é a versão atual** (redesign visual, 2026-06-18); V2 foi implementada por completo (22/22 etapas) e superada pela V3 no mesmo dia; V1.0 é o baseline histórico.
> Nota: o sistema é desenvolvido e mantido por uma única pessoa (alta velocidade de iteração é resultado de aprendizado contínuo e engenharia reversa assistida, não de equipe múltipla); o status de conformidade LGPD depende de definições externas (terceiros) ainda pendentes — ver `doc/lgpd/PLANO_DE_ACAO_LGPD.md`.

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
| `createMaterialApi` | `removeMaterial`, `addMaterial`, `updateMaterial`, `addMaterialEvento`, `removeMaterialEvento`, `toggleRetornadoEvento` |
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
│       ├── MaterialChecklistModal.jsx  # Importação em lote: 14 itens pré-definidos, seleção e ajuste de quantidade (D-053, marketing only)
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
| Estoque | `EstoqueTab` | Gestão de materiais com nível de disponibilidade; importação em lote via checklist (`MaterialChecklistModal`) com 14 itens pré-definidos do inventário físico; edição de nome/quantidade por linha via `MaterialModal` em modo edit (D-056); exclusão de material por linha com confirmação inline em dois passos (D-053) |
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
- `dataService.exec` → `sync_error` junto ao dispatch de `rjnet:sync-error`; carrega `vendedor`/`eventoId` via parâmetro `meta` quando originado de mutação de lead (D-052)
- `dataService.addToQueue` → `offline_queue` ao enfileirar lead
- `leadApi.addLead` → `lead_add` com vendedorNome + eventoId
- `leadApi.addLead` onSuccess → `lead_sync_ok` após confirmação do Supabase (D-044b)
- `leadApi.updateLead` → `lead_update` com vendedorNome + eventoId
- `leadApi.updateLead` onSuccess → `lead_sync_ok` após confirmação do Supabase (D-044b)
- `leadApi.removeLead` → `lead_remove` com vendedorNome + eventoId
- `leadApi.removeLead` onSuccess → `lead_sync_ok` após confirmação do Supabase (D-049)

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
- **`exec(promise, acao, onFail, onSuccess, meta = {})`**: 4º parâmetro `onSuccess` — chamado após escrita bem-sucedida no Supabase (1ª tentativa ou retry) e imediatamente no modo local; 5º parâmetro `meta` — spread no `logActivity` do `sync_error`, permitindo atribuição direta ao vendedor/evento sem heurística de timestamp; timeout de 15 s por tentativa via `Promise.race` — escrivas travadas viram `sync_error` visível em vez de penderem silenciosamente; `db.saveLead` e `db.removeLead` passam `{ vendedor: l.vendedorNome, eventoId: l.eventoId }` como meta (D-044b, D-052)
- **9 tipos de evento no Monitor**: `lead_add`, `lead_update`, `lead_remove`, `lead_sync_ok`, `sync_error`, `perf_warn`, `offline_queue`, `session_start`, `session_end` — cada tipo tem marca visual e cor; `session_start`/`session_end` rendem como separadores roxos no feed e não aparecem nos filtros Leads/Sync/Perf nem nos stats; filtro `Perf` é separado; filtro `Sync` inclui tanto `sync_error` quanto `lead_sync_ok` — botão verde com contagem de oks quando sem erros, vermelho com contagem de erros quando há falha; `stats.leads` é líquido (`lead_add − lead_remove`, `Math.max(0)`); header exibe stat `syncOks` condicionalmente em verde quando há confirmações (D-044b, D-048, D-052)
- **Contagem de leads ao encerrar sessão**: `lead_add - lead_remove` desde o `ts` do último `session_start`; `Math.max(0)` protege contra negativo; fallback conta tudo se não houver session_start (D-051)
- **Status de atividade do vendedor nos cards**: `vendorStatus(lastTs)` — 4 tiers por elapsed time (< 5min verde, < 30min amarelo, < 24h cinza, ≥ 24h inativo); ponto colorido sobreposto ao avatar; tick de 30s interno ao VendedorCard (D-050)
- **perf_warn com severidade dinâmica**: `getPerfCfg(ms)` — 4 tiers (lenta/muito lenta/possível timeout/timeout de rede) com cor e label distintos; `getDesc` adiciona prefixo de contexto para ms ≥ 30s (D-049)
- **sync_ok para todos os tipos de mutação de lead**: `lead_add`, `lead_update` e `lead_remove` disparam `lead_sync_ok` após confirmação do Supabase via `onSuccess` em `exec()`; `db.removeLead` aceita 3º param `onSuccess` e 4º param `meta`; `leadApi.removeLead` passa `{ vendedor, eventoId }` como meta (D-049, D-052)
- **Gestão de estoque exclusiva do marketing (D-053)**: `removeMaterial` e `MaterialChecklistModal` são operações de `EstoqueTab`, que só renderiza em `MarketingApp`. A proteção é dupla: UI (tab inexistente no `VendedorApp`) e RLS (política `marketing` tem acesso total a `materiais`; `vendedor` não tem permissão de INSERT/DELETE na tabela). `removeMaterial` em `materialApi.js` faz atualização otimista local + `db.removeMaterial()` assíncrono. Importação em lote via `MaterialChecklistModal` itera sobre os selecionados chamando `addMaterial()` sequencialmente — sem endpoint especial.
- **Checklist de importação persistente (D-054)**: `MaterialChecklistModal` usa `usePersisted('rjnet_checklist_estoque', ...)` em vez de `useState` — o rascunho da lista (itens marcados/desmarcados, quantidades, itens customizados) sobrevive ao fechar o modal e a recarregar a página. Formulário inline permite adicionar itens livres (nome + quantidade) além dos 14 pré-definidos; cada item tem botão de remoção individual do rascunho. Ao confirmar a importação, apenas os itens selecionados são removidos do rascunho (via `addMaterial()`) — os desmarcados permanecem salvos para uma importação futura. Dado local apenas (sem persistência no Supabase); não contém dados pessoais.
- **Edição de material existente (D-056)**: `MaterialModal` aceita prop opcional `material` — quando presente, pré-preenche o formulário (`nome`, `quantidade`, `descricao`) e o submit chama `updateMaterial(id, patch)` em vez de `addMaterial()`; título e label do botão mudam para "Editar Material"/"Salvar". `EstoqueTab` adiciona um botão de edição (ícone `edit`) ao lado do botão de exclusão em cada linha de estoque, abrindo `MaterialModal` com o material selecionado via estado `editMaterial`. Reaproveita a operação `updateMaterial` já existente em `materialApi.js` (sem mudança na API/backend); restrito ao marketing pela mesma proteção dupla do D-053 (UI + RLS).
- **Realtime Broadcast do Monitor (canal único)**: `activityLog.js` é o único dono do canal `rjnet-monitor` — registra `.on('broadcast', { event: 'log' }, handler)` ANTES de `.subscribe()` (requisito do Supabase JS v2). `MonitoringTab` registra callbacks via `subscribeToRemoteLogs(callback)` — nunca abre canal próprio. Fila `_queue` garante entrega de mensagens enviadas antes de `SUBSCRIBED`. Canal público (anon key), multiplexado na WebSocket existente. **Limitação conhecida (D-052)**: Realtime Broadcast não tem replay/history — eventos emitidos enquanto o MonitoringTab não está subscrito são perdidos irrecuperávelmente; `lead_sync_ok` pode não aparecer no log do marketing se a aba estava fechada no momento da confirmação pelo vendedor. Alternativa estrutural: persistir `activity_log` no Supabase para garantir consistência cross-device sem depender de presença ativa do canal (D-046, D-047)

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
