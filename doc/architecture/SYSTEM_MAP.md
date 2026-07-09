# SYSTEM_MAP.md — RJNet Gestão de Eventos

> Fonte única de verdade sobre a arquitetura viva do sistema.
> Localização: `doc/architecture/SYSTEM_MAP.md` — carregado automaticamente via `@import` no `CLAUDE.md`.
> Atualizado em: 2026-07-09 (D-076 — Simulador vira 2 fluxos públicos independentes por campanha, nunca mais encadeados na mesma sessão: tipo `oferta` (renomeado de `perfil_consumo`) só tem a etapa fixa de perfil de uso → pacote + combo, sem perguntas; tipo `demanda` (novo) só tem as perguntas configuráveis (D-075) → mensagem de resultado PERSONALIZADA pela campanha (`simuladores.mensagem_resultado`, novo), sem perfil/pacote; botão de QR/Link de uma campanha `demanda` só fica disponível depois de ter ao menos 1 pergunta salva; tipo `territorial` (D-073) removido do seletor de criação e dos fluxos públicos — relatório "Demanda por região" continua ativo, pois agrega qualquer lead com cidade/bairro, não só os de origem territorial); 2026-07-09 (D-075 — Perguntas de intenção do Simulador viram um questionário PRÓPRIO por campanha (`simuladores.perguntas`, jsonb), com peso editável por opção, criado num construtor na gestão (`PerguntasBuilder`); pontuação passa a ser um PERCENTUAL da máxima possível daquela campanha (não mais número fixo); perguntas condicionais removidas (v1 linear); `leads.perfil_consumo` grava snapshot das perguntas usadas; a pergunta de "perfil de uso" (D-074) continua fixa e separada; combo de upsell ganha popup "ⓘ" mostrando os apps reais de cada bundle); 2026-07-08 (D-074 — Pacote fixo por perfil de uso + combo de upsell no Simulador: nova pergunta de perfil (`PERFIS_SIMULADOR`, 4 categorias com pacote fixo associado) substitui a recomendação por soma de sinais; tela de resultado ganha checkboxes de add-on (Apps Yellow/Black, upgrade de pacote) com total ao vivo, sempre recalculado a partir de `PACOTES_INTERNET`/`APPS_ADICIONAIS` — catálogo único também reaproveitado pela aba Pacotes do vendedor; Apps Black destacado quando `usos` inclui streaming; gravado em `leads.perfil_consumo.perfil`/`.combo`, sem migração nova); 2026-07-08 (D-073 — Campanha territorial do Simulador (F5): `tipo='territorial'` — cidade/bairro/interesse sem quiz/score, Edge Function ramifica pelo tipo gravado no banco, temperatura fixa morno; relatório interno "Demanda por região" em Relatórios via RPC `demanda_por_regiao()` (`migracao-demanda.sql`, agregado sem dado pessoal, padrão ranking_mes); seletor de tipo na `SimuladorTab`); 2026-07-08 (D-072 — Simulador de Perfil de Consumo: terceira porta pública de captação — quiz gamificado em `/s/:slug` (`SimuladorPublico.jsx`), campanhas na tabela `simuladores` (identidade apenas: nome/slug/agrupador), catálogo FIXO de perguntas versionado em `src/lib/simulador.js` (mesmo princípio D-062), scoring de intenção RECALCULADO no servidor pela Edge Function `submeter-simulador` (pontuação → temperatura frio/morno/quente + oferta recomendada), atribuição de tráfego pago via `leads.utm` (whitelist utm_*; QR gerado já embute `utm_source=qrcode&utm_medium=impresso` — um link por campanha atende anúncio e impresso), miolo das Edge Functions públicas extraído pra `supabase/functions/_shared/captacao.ts` (submeter-formulario refatorada, requer redeploy), contexto "QR Code" do vendedor generalizado pra "Captação" (`fetchLeadsQrCode` agora filtra qrcode/formulario/simulador), fila de distribuição ordenada por pontuação com coluna Perfil; migração `migracao-simulador.sql` DEVE rodar antes do deploy do frontend; plano/fases em `doc/simulador/SIMULADOR_IMPLEMENTATION_PLAN.md`); 2026-07-07 (D-070 — Removido `.tbl-wrap::after` ("TableScrollHint"): a real causa da sombra preta em tabelas roláveis no mobile — gradiente fixo na borda direita do container, quase opaco por usar `var(--bg)` quase preto, cobrindo texto real de células (`LeadsTab.jsx`, `MesDetail.jsx`, `EventDetail.jsx`) permanentemente, não só durante o scroll; D-068/D-069 corrigiram bugs reais mas não essa causa raiz específica); 2026-07-07 (D-069 — Sombras globais do tema escuro suavizadas: `--shadow-card`/`--shadow-float`/`--shadow-glow` em `src/index.css` tinham alpha desproporcional para um fundo quase preto (`--bg: #090909`), lendo como mancha preta sólida em vez de sombra suave em qualquer card do app, mobile ou web; alpha reduzido mantendo a mesma estrutura/direção de design da V3); 2026-07-07 (D-068 — Correção pós-D-066 em `MesDetail.jsx`: coluna "Horário" (HH:MM de `criadoEm`) na tabela de cada dia, leads ordenados do mais recente para o mais antigo dentro do dia, e fix de artefato de sombra preta sólida causado por combinar `box-shadow` + `overflow: hidden` no mesmo elemento — isolado num wrapper interno); 2026-07-07 (D-067 — Moderação e mitigação de abuso no formulário público: bloqueio de link em texto livre (client + Edge Function), `leads.origem_ip` capturado na submissão pública, rate limit de 5/10min por IP, botão de exclusão na fila de distribuição, `doc/SEGURANCA_MODERACAO.md` com processo de remoção/denúncia; avaliada e descartada migração da captação para Google Forms como forma de transferir responsabilidade legal — não transfere, e a proteção real do Google é sobre upload de arquivo, que este sistema não tem); 2026-07-07 (D-066 — Leads da Atividade do Mês agrupados por dia num accordion em `MesDetail.jsx`, derivado de `criadoEm`; dia mais recente aberto por padrão, busca expande dias com resultado, sem dias vazios/futuros e sem migração de banco); 2026-07-06 (D-065 — Navegação do Marketing reorganizada em 3 botões diretos + "Mais" agrupado por categoria (Captação/Comercial/Operação/Sistema); gerador de QR Code standalone retirado — Form Builder passa a ser o único ponto de geração de QR Code/link, por ser superconjunto funcional; rota `/qr/:id`, `QrCodeGeradorTab.jsx`, `QrCapturaPublica.jsx` e Edge Function `captar-lead-qrcode` removidos; colunas `origem`/`qr_code_id`/`qr_code_label` e o seletor "QR Code" em `VendedorApp.jsx` mantidos sem alteração); 2026-07-06 (D-064 — correções pós-implementação: persistência da fila de distribuição em modo Supabase e modo local, retenção LGPD para leads sem contexto operacional, CORS das Edge Functions públicas); 2026-07-06 (D-063 — Campos personalizados: marketing/comercial criam campos de texto livre reutilizáveis em qualquer formulário, sem deploy de código; `leads.campos_extras`); 2026-07-06 (D-062 — Form Builder: catálogo fixo de campos configurável por formulário — não motor de campo genérico; tabela `formularios`, Edge Function `submeter-formulario`, primeira leitura anônima (RLS `anon`) do projeto); 2026-07-06 (D-061 — QR Code como canal de captação: atributo de proveniência (`origem`/`qr_code_id`), nunca um terceiro contexto operacional ao lado de Evento/Atividade do Mês; Edge Function pública `captar-lead-qrcode`, distribuição manual de leads sem vendedor, alternativa de Google Forms via Apps Script); 2026-07-06 (D-060 — Cards clicáveis "Evento" e "Mês/Dia a dia" no Início, levando a `EventDetail.jsx`/novo `MesDetail.jsx`; stats do Início via `obterRanking`/`obterRankingMes` em vez do array `leads` local); 2026-07-06 (D-059 — Terceiro perfil "comercial": mesmo nível de eventos/ofertas/relatórios do marketing, sem estoque nem gestão de equipe; novo shell `ComercialApp.jsx`); 2026-07-02 (D-058 — Captação de leads no dia a dia via "mês de referência": vendedor alterna entre Evento e Atividade do Mês em `VendedorApp.jsx`, ambos contextos mutuamente exclusivos em `leads`; ranking, retenção LGPD e exportação do marketing espelhados para o novo contexto); 2026-07-02 (D-057 — Área de Ofertas: imagem+copy prontas por serviço geridas pelo marketing, envio manual 1:1 via `wa.me` pelo vendedor; primeiro uso de Supabase Storage no projeto); 2026-06-30 (D-056 — Estoque: edição de nome e quantidade de material existente via `MaterialModal` em modo dual create/edit); 2026-06-30 (correção de coesão documental: renumeração de D-043 duplicado → D-055 em `DECISIONS.md`; sincronização do status de PA-04/consentimento suspenso em `LGPD_AUDIT_AND_COMPLIANCE.md`; correção de status `v1.0` em `UI_VERSIONS.md`; `CLAUDE.md` atualizado para refletir V3 como versão de UI corrente); 2026-06-30 (D-054 — Estoque: checklist de importação persistente em localStorage, com formulário de novo item e exclusão por linha do rascunho); 2026-06-29 (D-053 — Estoque: importação em lote via checklist + exclusão de material; restrito ao perfil marketing); 2026-06-20 (D-052 — Monitor: timeout 15s em escrita, sync_error com vendedor via meta, stats.leads líquido, filtro Sync inclui lead_sync_ok; D-051 — fix contagem sessão; D-050 — status vendedor nos cards; D-049 — sync_ok removeLead + perf tiers; D-048 — marcadores de sessão + limpar log; D-047 — fix canal único Realtime; D-046 — Monitor Realtime entre dispositivos; D-045 — Monitor histórico por dia; D-044b — Monitor v2; D-044 — aba Monitor; D-036, D-037, D-038 — quick wins de performance)> Documentação de performance: `doc/performance/` (backlog, auditoria, planos de teste, homologação)
> Documentação de UI/UX: `doc/ui/UI_VERSIONS.md` — catálogo de versões da interface. **V3 é a versão atual** (redesign visual, 2026-06-18); V2 foi implementada por completo (22/22 etapas) e superada pela V3 no mesmo dia; V1.0 é o baseline histórico.
> Nota: o sistema é desenvolvido e mantido por uma única pessoa (alta velocidade de iteração é resultado de aprendizado contínuo e engenharia reversa assistida, não de equipe múltipla); o status de conformidade LGPD depende de definições externas (terceiros) ainda pendentes — ver `doc/lgpd/PLANO_DE_ACAO_LGPD.md`.

---

## 1. Visão Geral do Sistema

SPA React para gerenciamento de eventos de campo da RJNet. Permite que o time de marketing crie e gerencie eventos, estoque e equipe, enquanto vendedores em campo capturam leads e acompanham desempenho em tempo real.

Três perfis de acesso: **marketing** (gestão completa), **comercial** (D-059 — mesmo nível de marketing em eventos/ofertas/relatórios, sem estoque nem gestão de equipe) e **vendedor** (captura de leads + ranking).  
Dois modos de operação: **Supabase** (produção, com auth e realtime) e **local** (localStorage, sem backend).

Além da captação presencial (Evento/Atividade do Mês, mediada por um vendedor), o sistema aceita canais de captação **públicos, sem sessão**: o **Form Builder** (D-062 — formulários configuráveis, cada um já com seu próprio QR Code/link) e o **Simulador de Perfil de Consumo** (D-072 — quiz gamificado por campanha, acessado por link de tráfego pago e QR Code, que entrega o lead já qualificado com perfil/pontuação/temperatura). Ambos convergem para o mesmo Lead via Edge Function pública — nunca um pipeline de escrita paralelo. Existiu também um gerador de QR Code standalone (D-061), retirado em D-065 por redundância — ver seção 5 (Domínios de Negócio) e D-061–D-065 em `DECISIONS.md`.

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
| `createOfertaApi` | `saveOferta`, `removeOferta`, `registrarOfertaEnviada` (D-057) |
| `createFormularioApi` | `addFormulario`, `updateFormulario`, `removeFormulario` (D-062) |
| `createCampoPersonalizadoApi` | `addCampoPersonalizado`, `updateCampoPersonalizado`, `removeCampoPersonalizado` (D-063) |
| `createSimuladorApi` | `addSimulador`, `updateSimulador`, `removeSimulador` (D-072) |

As factories são instanciadas dentro do `AppProvider` e expostas via contexto. **Nenhum componente acessa o banco diretamente** — exceção documentada: `LeadsTab.jsx` (fila de distribuição) e a página pública (`src/public/FormularioPublico.jsx`) chamam funções de `dataService.js` diretamente, por não terem (ou não deverem depender de) `AppProvider`/sessão. Ver nota em D-062/D-064.

### Camada de Dados (`src/lib/dataService.js`)

Única ponte entre a aplicação e o Supabase. Responsabilidades:

- Mapeamento automático **camelCase ↔ snake_case**
- `withRetry(fn)` — backoff exponencial (base 800 ms, máx. 3 tentativas)
- `trackPerf(label, fn)` — alerta para requisições lentas (>1 s)
- **Fila offline**: operações de `saveLead` são enfileiradas no `localStorage` quando offline e sincronizadas em `flushPendingQueue()` ao reconectar
- **Cache em memória** (`src/lib/cache.js`) com TTL de 30 s para resultados de `rankingEvento`
- Subscriptions realtime via canais Supabase com debounce de 1500 ms (`REALTIME_DEBOUNCE_MS` — D-038)

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
├── main.jsx                    # ErrorBoundary + ReactDOM.createRoot; desvio mínimo pra /f/:slug ANTES do AppProvider (D-062, sem biblioteca de rotas; rota /qr/:id retirada em D-065)
├── index.css                   # Estilos globais (tema dark/light via CSS variables)
├── api/
│   ├── eventoApi.js            # Factory CRUD de eventos
│   ├── leadApi.js              # Factory CRUD de leads + obterRanking
│   ├── materialApi.js          # Factory CRUD de materiais
│   ├── vendedorApi.js          # Factory CRUD de vendedores (modo local)
│   ├── equipeApi.js            # Factory de gestão de usuários Auth (modo Supabase)
│   ├── ofertaApi.js            # Factory de ofertas prontas por serviço + registro de envio (D-057)
│   ├── formularioApi.js        # Factory CRUD de formulários do Form Builder (D-062)
│   └── campoPersonalizadoApi.js # Factory CRUD de campos personalizados reutilizáveis (D-063)
├── context/
│   ├── AppContext.js           # createContext(null)
│   ├── AppProvider.jsx         # Provider: estado + efeitos + factories
│   └── index.js                # Re-exports
├── apps/
│   ├── Root.jsx                # Roteador raiz: modo + tema
│   ├── MarketingApp.jsx        # Shell marketing (5 tabs)
│   ├── ComercialApp.jsx        # Shell comercial (4 tabs: Início/Eventos/Ofertas/Relatórios, D-059)
│   └── VendedorApp.jsx         # Shell vendedor (4 tabs + LeadEditInline + OfertaPickerModal, D-057)
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
│       ├── OfertaModal.jsx             # Edição de oferta (imagem+copy) por serviço, marketing only (D-057)
│       └── index.js
├── features/
│   ├── events/
│   │   ├── Dashboard.jsx       # KPIs, gráfico donut, próximos eventos; cards clicáveis Evento/Mês (D-060)
│   │   ├── EventosTab.jsx      # Lista de eventos com filtros de status
│   │   ├── EventDetail.jsx     # Detalhe: materiais e leads do evento
│   │   └── index.js
│   ├── inventory/
│   │   ├── EstoqueTab.jsx
│   │   └── index.js
│   ├── offers/
│   │   ├── OfertasTab.jsx      # Lista fixa (5 serviços): oferta ativa por serviço, marketing only (D-057)
│   │   └── index.js
│   ├── leads/
│   │   ├── LeadsTab.jsx        # Filtros, gráfico, export CSV
│   │   ├── MesDetail.jsx       # Detalhe do mês: leads por vendedor + tabela agrupada por dia (accordion, com horário), espelha EventDetail sem materiais (D-060, D-066, D-068)
│   │   └── index.js
│   ├── checkin/
│   │   ├── CheckinTab.jsx      # Busca de lead por CPF
│   │   └── index.js
│   ├── team/
│   │   ├── EquipeTab.jsx       # Vendedores (modo local)
│   │   ├── EquipeAuthTab.jsx   # Usuários com RBAC (modo Supabase)
│   │   └── index.js
│   ├── monitoring/
│   │   ├── MonitoringTab.jsx   # Diagnóstico ao vivo + histórico por dia: cards, feed com descrições, seletor de dias (D-044, D-044b, D-045)
│   │   └── index.js
│   └── formularios/
│       ├── FormBuilderTab.jsx  # Cria formulário (catálogo fixo + campos personalizados) e gestão de campos personalizados; cada formulário já gera seu próprio QR Code/link (D-062, D-063, D-065)
│       └── index.js
├── public/
│   └── FormularioPublico.jsx   # Página pública dinâmica do Form Builder — sem sessão, sem AppContext (D-062)
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
    ├── constants.js            # Constantes globais, enums de domínio e CAMPOS_FORMULARIO (catálogo fixo, D-062)
    └── localPublicSubmit.js    # Fallback local/preview (sem Supabase) pra página pública do Form Builder — grava direto em localStorage, nunca é o caminho de produção (D-062)
```

---

## 4. Apps Principais

### `Root.jsx`

Ponto de entrada após `main.jsx`. Detecta modo (`supabaseEnabled`) e gerencia tema via `localStorage`.

- `supabaseEnabled` → `RootAuth` → Supabase session → papel do usuário → `MarketingApp`, `ComercialApp` (D-059) ou `VendedorApp`
- `!supabaseEnabled` → `RootLegacy` → credenciais de env → `MarketingApp` ou `VendedorApp` (papel `comercial` não existe no modo local/legado — só em modo Supabase Auth)

### `MarketingApp.jsx`

Shell do time de marketing. Navegação por 9 tabs, em duas camadas (D-065): **3 botões diretos** (Início, Eventos, Relatórios) sempre visíveis no header (desktop) e no bottom nav (mobile), e um **botão "Mais"** que abre um dropdown (desktop, `.nav-more-dropdown`) ou bottom sheet (mobile, `.more-sheet`) com o restante agrupado por categoria: **Captação** (Formulários), **Comercial** (Ofertas), **Operação** (Estoque, Check-in), **Sistema** (Equipe, Monitor). Mesmo agrupamento renderizado nos dois formatos — um único array `MORE_GROUPS` alimenta ambos.

| Tab | Componente | Grupo em "Mais" | Função |
|---|---|---|---|
| Início | `Dashboard` | — (direto) | KPIs + 2 cards clicáveis lado a lado, "Evento Ativo" (abre `EventDetail` na aba Eventos) e "Mês/Dia a dia" (abre `MesDetail` **embutido no próprio Início**, sem trocar de aba — D-060) |
| Eventos | `EventosTab` / `EventDetail` | — (direto) | CRUD de eventos, materiais alocados, leads por vendedor |
| Relatórios | `LeadsTab` | — (direto) | Visão consolidada de leads, filtros, export CSV, gráfico; seção "Leads sem vendedor" pra distribuir leads de QR Code/Formulário (D-061, D-064) |
| Formulários | `FormBuilderTab` | Captação | Cria formulários escolhendo campos de um catálogo fixo + campos personalizados que a própria equipe cadastra (sempre texto livre); cada formulário já gera seu próprio QR Code/link (D-062, D-063). Absorve o antigo gerador de QR Code standalone (`QrCodeGeradorTab`, rota `/qr/:id`), retirado em D-065 por ser redundante — o Form Builder já cobre o mesmo catálogo de campos e já gera QR por formulário |
| Ofertas | `OfertasTab` | Comercial | Uma oferta ativa por serviço (imagem 1080x1080 via Supabase Storage + copy) editada via `OfertaModal`; congelada para o vendedor, que só consome (D-057) |
| Estoque | `EstoqueTab` | Operação | Gestão de materiais com nível de disponibilidade; importação em lote via checklist (`MaterialChecklistModal`) com 14 itens pré-definidos do inventário físico; edição de nome/quantidade por linha via `MaterialModal` em modo edit (D-056); exclusão de material por linha com confirmação inline em dois passos (D-053) |
| Check-in | `CheckinTab` | Operação | Busca de lead por CPF em evento ativo |
| Equipe | `EquipeAuthTab` / `EquipeTab` | Sistema | CRUD de vendedores / usuários com RBAC |
| Monitor | `MonitoringTab` | Sistema | Diagnóstico ao vivo + histórico por dia: seletor de datas, cards com status de atividade do vendedor, feed 9 tipos, filtros Sync/Perf, descrições de campo, toolbar de sessão (▶/■) + limpar log (D-044–D-051) |

### `ComercialApp.jsx` (D-059)

Shell do gerente comercial. Mesma casca visual do `MarketingApp` (header, tema, `SyncBadge`), navegação por 4 tabs:

| Tab | Componente | Função |
|---|---|---|
| Início | `Dashboard` | Mesmos KPIs e cards clicáveis Evento/Mês do marketing (D-060), somente leitura (inclusive "Materiais Críticos" — RLS de `materiais` continua leitura para qualquer papel autenticado) |
| Eventos | `EventosTab` / `EventDetail` | CRUD de eventos, mesmo nível de escrita do marketing (RLS `eventos_write` aceita `marketing` ou `comercial`) |
| Ofertas | `OfertasTab` | Edição de oferta por serviço, mesmo nível do marketing (RLS `ofertas_write` + bucket Storage aceitam `comercial`) |
| Relatórios | `LeadsTab` | Visão consolidada de leads, filtros, export CSV — comercial pode editar/excluir qualquer lead, igual marketing (RLS `leads_insert/update/delete`) |

**Sem** Estoque, Equipe ou Monitor — nem no menu, nem na RLS (`materiais` e `perfis` continuam exclusivos de `marketing`). Contas comerciais são criadas pelo próprio marketing em `EquipeAuthTab`. Os 4 tabs permanecem diretos, sem o dropdown "Mais" do Marketing (D-065) — com só 4 itens, agrupar não reduziria cliques.

### `VendedorApp.jsx`

Shell do vendedor em campo. Navegação por 4 tabs (bottom nav mobile-first):

| Tab | Função |
|---|---|
| Registrar | Formulário de captura de lead com modo rápido, multi-seleção de serviços, controle Sim/Não para "já é cliente", auto-sanitização, toast com undo, barra de meta em 3 níveis (Bronze/Prata/Ouro). Seletor de contexto sempre visível — **Evento** (evento ativo criado pelo marketing), **Atividade do Mês** (D-058, dia a dia fora de eventos, 12 meses do ano corrente) ou **QR Code** (D-061, só leitura — sem registro manual, mensagem informativa: leads de QR Code chegam sozinhos e são distribuídos pelo marketing) — o vendedor alterna livremente a qualquer momento |
| Meus Leads | Lista filtrável do contexto ativo (evento, mês — D-058 — ou QR Code — D-061, só os já distribuídos a esse vendedor, sem ranking/meta), edição inline, ciclo de temperatura, botão WhatsApp, ícones discretos de editar/excluir no topo do card (excluir com confirmação inline em dois passos); campos personalizados (D-063) exibidos como `rótulo: valor` quando presentes; botão único "Enviar oferta" abre `OfertaPickerModal` (D-057) listando todas as ofertas configuradas pelo marketing — as do interesse declarado do lead aparecem primeiro, mas todas ficam disponíveis; cada item abre `wa.me` com copy pronta e tem um botão "Baixar" (download via `fetch`+blob) para a imagem |
| Evento | Em contexto Evento: detalhes do evento ativo, link Maps, ranking da equipe. Em contexto Atividade do Mês (D-058): só o placar da equipe do mês selecionado (sem local/data, que não existem nesse contexto) |
| Pacotes | Tabela de preços dos serviços RJNet (hardcoded) — acessível em ambos os contextos |

---

## 5. Domínios de Negócio

### Eventos
Unidade central para captação de campo. Possui `status` (`planejado` / `ativo` / `encerrado`), `tipo`, datas, local, e um array `materiais` (JSONB no Supabase). Leads capturados em campo e o ranking por evento são associados a um evento (ver D-058 para a captação alternativa fora de eventos).

### Leads
Capturados por vendedores, vinculados a `vendedorNome` e a **exatamente um** dos dois contextos (D-058): `eventoId` (evento de campo) OU `mesReferencia` (dia a dia, fora de eventos — primeiro dia do mês, ex. `2026-07-01`). Têm `temperatura` (`frio` / `morno` / `quente` / `convertido`) e `servicoInteresse` (array de strings — ver D-026). Suportam soft delete via flag `deletado`.

> **`servicoInteresse` é array:** no frontend sempre `string[]`; no banco (`servico_interesse` TEXT) armazenado como JSON string. `leadFromDb` normaliza strings legadas para `[string]` automaticamente. `servicoLabel()` aceita string ou array.

> **Contexto evento vs. mês (D-058):** `leads.evento_id`/`leads.mes_referencia` são mutuamente exclusivos entre si via `check (num_nonnulls(evento_id, mes_referencia) <= 1` — relaxado de `= 1` em D-061 pra aceitar leads sem nenhum dos dois (QR Code, Form Builder). Ranking, carregamento on-demand e retenção LGPD têm um caminho espelhado para cada contexto (`ranking_evento`/`ranking_mes`, `fetchLeadsEvento`/`fetchLeadsMes`, retenção por evento encerrado/por mês encerrado). O vendedor escolhe o contexto em `VendedorApp.jsx` via seletor sempre visível ("Evento" / "Atividade do Mês" / "QR Code" — D-061); a lista de 12 meses é gerada a partir do ano corrente (`mesesDoAno`), sem necessidade de cadastro ou manutenção anual.

> **Atribuição vs. contexto operacional (D-061):** `origem`/`qr_code_id`/`qr_code_label`/`formulario_id`/`campos_extras` são um eixo **independente** de `evento_id`/`mes_referencia` — respondem "de onde o Lead veio", nunca "em que contexto o vendedor está trabalhando agora". Um lead pode ter um contexto operacional (Evento OU Mês OU nenhum) e, separadamente, um atributo de proveniência (QR Code, Formulário, ou nenhum — captação presencial direta). Leads com `origem` preenchido e sem vendedor (`vendedor_id is null`) ficam invisíveis ao papel `vendedor` via RLS até serem distribuídos manualmente por marketing/comercial (fila "Leads sem vendedor" em `LeadsTab.jsx`).

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

### Ofertas (D-057)
Conteúdo pronto (imagem 1080x1080 + copy) por serviço, gerido exclusivamente pelo marketing. `servico` é a própria chave primária — no máximo 5 linhas (mesmo enum de `servicoInteresse`), sobrescritas ao editar; sem histórico/versionamento. O vendedor só consome: na aba "Meus Leads", um botão "Enviar oferta" abre um seletor (`OfertaPickerModal`) com **todas** as ofertas configuradas — as que batem com o interesse declarado do lead aparecem primeiro, mas todas ficam disponíveis (o vendedor pode perceber interesse em outro serviço durante a conversa e enviar na hora, sem precisar editar o lead antes). Cada item do seletor abre `wa.me` com a copy pré-preenchida e tem um botão "Baixar" que baixa a imagem via `fetch`+blob (anexo à mensagem continua manual — limitação do próprio `wa.me`, que não permite pré-anexar mídia). `oferta_envios` registra o clique como indicador visual ("✓ Oferta enviada"), **não** como confirmação de entrega ou leitura.

### QR Code (D-061, retirado como gerador standalone em D-065)
Nunca foi um terceiro contexto operacional (ver "Atribuição vs. contexto operacional" acima) — sempre um atributo de proveniência (`origem='qrcode'`, `qr_code_id`/`qr_code_label`). O gerador dedicado (`QrCodeGeradorTab.jsx`, rota pública `/qr/:id`, página `QrCapturaPublica.jsx`, Edge Function `captar-lead-qrcode`) foi **retirado em D-065**: nenhum QR desse fluxo chegou a ser impresso/distribuído, e o Form Builder (abaixo) já cobre o mesmo catálogo de campos e já gera QR Code + link por formulário — manter os dois era a própria redundância que D-065 resolveu. Todo QR Code novo nasce de um formulário do Form Builder, com `origem='formulario'`.
**O que continua existindo no código, sem mudança (D-065 não tocou o lado vendedor):** as colunas `origem`/`qr_code_id`/`qr_code_label` em `leads` (compartilhadas com o pipeline de distribuição, que não distingue origem), `fetchLeadsQrCode`/`carregarLeadsQrCode` em `dataService.js`/`AppProvider.jsx`, e o seletor "QR Code" em `VendedorApp.jsx` (contexto só-leitura dos leads já distribuídos). Esse caminho fica vestigial pra leads novos — sem gerador, nenhum lead novo nasce com `origem='qrcode'` — mas não foi removido porque a interface do vendedor foi mantida deliberadamente inalterada; qualquer lead de `origem='qrcode'` que já exista no banco continua visível normalmente.

### Simulador (D-072, D-076)
Terceira porta pública de captação — quiz gamificado ("valor antes do dado": a pessoa responde perguntas, recebe algo em troca e só então deixa nome/WhatsApp/bairro/cidade). Cada linha de `simuladores` é uma **campanha** (nome, slug, agrupador) com link próprio (`/s/:slug`) pra tráfego pago e QR Code pra material impresso — o QR embute `utm_source=qrcode&utm_medium=impresso`, então **uma campanha só** distingue os dois canais via `leads.utm`. A Edge Function `submeter-simulador` **recalcula no servidor** tudo que decide o lead (o cliente nunca manda score/pacote pronto); o lead nasce com `origem='simulador'`, `perfil_consumo` (jsonb), `pontuacao`, `oferta_recomendada`, `cidade`/`bairro`, `utm` e `vendedor_id` nulo — cai na mesma fila de distribuição do Form Builder, ordenada por pontuação. Gestão em `SimuladorTab.jsx` (grupo Captação do "Mais"). **D-076: 2 tipos de campanha, cada um com seu PRÓPRIO fluxo público, nunca encadeados na mesma sessão:**
- **`oferta`** (D-074, renomeado de `perfil_consumo`): só a etapa fixa de perfil de uso (`PERFIS_SIMULADOR` — Básico/Streaming/Home Office/Gamer, cada um com pacote de internet FIXO) → pacote + combo de upsell (Apps Yellow/Black, upgrade de pacote) → contato. Sem quiz de intenção — lead sempre nasce `temperatura='quente'`, `pontuacao=null`.
- **`demanda`** (D-075, substitui o antigo tipo `territorial` removido em D-076): só as perguntas de intenção **configuráveis por campanha** (`simuladores.perguntas`, jsonb — texto + peso por opção, editadas pelo marketing num construtor, `PerguntasBuilder`) → **mensagem de resultado personalizada pela campanha** (`simuladores.mensagem_resultado`, já que não há pacote pra recomendar nesse fluxo) → contato. `calcularPerfilDinamico()` soma os pesos das opções escolhidas e calcula a temperatura como PERCENTUAL da pontuação máxima possível DAQUELA campanha (≥60% quente, 30–59% morno, <30% frio). O botão de QR/Link só fica disponível na gestão depois de pelo menos 1 pergunta salva.

`leads.perfil_consumo` grava um SNAPSHOT do que decidiu o lead (perguntas+respostas pra `demanda`; perfil+combo pra `oferta`) — não uma referência à campanha, que pode mudar depois; `resumoPerfil()` renderiza os dois blocos de forma independente (um lead só carrega o bloco relevante ao seu tipo). Ver `doc/simulador/SIMULADOR_IMPLEMENTATION_PLAN.md`.

### Form Builder (D-062, D-063, D-065, D-067)
Formulários configuráveis pelo marketing/comercial — catálogo **fixo** de campos (`CAMPOS_FORMULARIO`: nome, telefone, endereço, bairro, cpf, servicoInteresse), nunca um motor de campo genérico. Tabela `formularios` (`campos`/`campos_obrigatorios`, `slug` único). `FormBuilderTab.jsx` cria o formulário **e já gera o QR Code + link daquele formulário** (único caminho de geração de QR Code do sistema desde D-065). `FormularioPublico.jsx` (`/f/:slug`) renderiza só os campos habilitados; converge pro Lead via Edge Function `submeter-formulario` (honeypot antispam) ou fallback local. **Campos personalizados (D-063):** tabela `campos_personalizados`, gerida pela própria equipe — sempre texto livre, só a legenda é livre; reutilizável em qualquer formulário; respostas gravadas em `leads.campos_extras` (jsonb, chave = `key` do campo), exibidas genericamente (`rótulo: valor`) onde quer que o Lead apareça. `formularios`/`campos_personalizados` são as **primeiras tabelas com leitura anônima** (RLS `to anon`, restrita a `ativo=true`, sem dado sensível) do projeto — necessário pra página pública renderizar sem sessão. **Moderação (D-067):** único ponto do sistema com escrita não-autenticada — `submeter-formulario` bloqueia link em texto livre, captura `leads.origem_ip` e aplica rate limit de 5 submissões/10min por IP; `LeadsTab.jsx` (fila de distribuição) permite excluir um lead suspeito sem atribuí-lo antes; processo de remoção/denúncia documentado em `doc/SEGURANCA_MODERACAO.md`.

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

**Fluxo paralelo — captação pública sem sessão (D-062, D-065):**
```
Página pública (FormularioPublico.jsx)
    ↓ sem AppProvider, sem sessão, sem useApp()
    ↓ modo Supabase: fetch() direto pra Edge Function pública
supabase/functions/submeter-formulario
    ↓ valida/sanitiza no servidor (catálogo fixo replicado em Deno)
    ↓ insere em `leads` com service_role — vendedor_id nasce nulo
Supabase (mesmo banco, mesma tabela leads)
    ↓ modo local/preview: localPublicSubmit.js grava direto em localStorage
    (nunca é o caminho de produção)
```
Esse fluxo não passa por `addLead()`/`AppProvider`/`leadApi.js` — é a única exceção documentada ao "pipeline único via `useApp()`", porque a página pública não tem (e não deve ter) sessão autenticada. A regra de negócio (validação/sanitização/consentimento) é replicada no servidor, não reaproveitada do bundle do frontend.

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
- **RLS ativo no Supabase**: `marketing` tem acesso total; `comercial` (D-059) escreve em `eventos`/`ofertas`/`leads` no mesmo nível de `marketing`, mas não em `materiais`/`perfis`; `vendedor` só escreve/edita próprios leads (`vendedor_id = auth.uid()`)
- **Updates otimistas**: estado local muda antes da resposta do banco
- **Retry com backoff**: `withRetry()` — base 800 ms, fator 2x, máx. 3 tentativas
- **Timeout de fetch**: `carregar()` usa `AbortSignal.any([controller, AbortSignal.timeout(15s)])` — evita loading infinito (D-036)
- **Realtime com debounce**: subscriptions Supabase com 1500 ms de debounce (`REALTIME_DEBOUNCE_MS` — D-038, era 400 ms; agora corretamente referenciado em `subscribeChanges`)
- **Leads on-demand por evento (ou por mês, D-058)**: `fetchAll` não carrega leads no boot. Leads são carregados via `carregarLeadsEvento(eventoId)` — D-039 — ou `carregarLeadsMes(mesReferencia)` — D-058, mesmo modelo:
  - Vendedor: ao selecionar evento ativo (contexto Evento) ou mês (contexto Atividade do Mês)
  - Marketing/EventDetail: ao abrir detalhe do evento
  - Export: `fetchLeadsEvento`/`fetchLeadsEventos` (evento, 1 ou N) ou `fetchLeadsMes`/`fetchLeadsMeses` (mês, 1 ou N, consolidado) — `LeadsTab.jsx` tem uma seção própria para cada contexto
  - `AppProvider` rastreia qual contexto está com leads carregados (`leadsContextRef = { tipo: 'evento'|'mes', id }`) para o realtime recarregar o certo
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
- **Perfil comercial: mesmo nível do marketing só em eventos/ofertas/relatórios (D-059)**: `ComercialApp.jsx` é um terceiro shell (ao lado de `MarketingApp`/`VendedorApp`), roteado por `RootAuth.jsx` quando `session.role === 'comercial'`. Proteção dupla, mesmo padrão do D-053: UI (tabs de Estoque/Equipe/Monitor simplesmente não existem nesse shell) e RLS (`eventos_write`/`ofertas_write`/bucket `ofertas`/`leads_insert`/`leads_update`/`leads_delete` aceitam `papel_atual() in ('marketing', 'comercial')`; `materiais_write` e as policies de `perfis` continuam checando só `papel_atual() = 'marketing'`, e a Edge Function `atualizar-email-usuario` também não muda). `RootLegacy.jsx` (modo local sem Supabase) não ganhou esse papel — só existe em modo Supabase Auth.
- **Cards clicáveis Evento/Mês no Início + `MesDetail.jsx` (D-060)**: `Dashboard.jsx` renderiza 2 hero cards lado a lado (`grid-2`) — "Evento Ativo" (já existia) e "Mês/Dia a dia" (novo, sempre visível, mês corrente via `mesAtualRef()`). O card **Evento** chama `onOpenEvento` (prop vinda de `MarketingApp`/`ComercialApp`) e troca de aba para Eventos, abrindo `EventDetail` — mesmo padrão de `detailId` que já existia. O card **Mês** é diferente por pedido explícito do responsável pelo sistema: **não troca de aba** — `mesAberto` é estado local do próprio `Dashboard.jsx`, que troca sua renderização para `<MesDetail>` no lugar do conteúdo normal do Início, mantendo "Início" ativo no menu o tempo todo. `MesDetail.jsx` (`src/features/leads/`) é o equivalente de `EventDetail.jsx` para mês — mesmo gráfico "Leads por Vendedor" + tabela — **sem** materiais (mês não tem estoque alocado); seu botão de voltar ("Voltar para o Início") reflete que só é aberto a partir do Dashboard. Os 2 cards calculam "leads"/"vendedores" via `obterRanking`/`obterRankingMes` (RPC agregada, cache 30s) em vez do array `leads` do contexto compartilhado — esse array só reflete o último contexto (evento/mês) carregado em outra tela (D-039/D-058), então ficaria zerado na maioria das visitas ao Início; esse ajuste vale para os dois cards, inclusive o de evento que já existia antes. Mudança 100% frontend, sem migração de banco.
- **Checklist de importação persistente (D-054)**: `MaterialChecklistModal` usa `usePersisted('rjnet_checklist_estoque', ...)` em vez de `useState` — o rascunho da lista (itens marcados/desmarcados, quantidades, itens customizados) sobrevive ao fechar o modal e a recarregar a página. Formulário inline permite adicionar itens livres (nome + quantidade) além dos 14 pré-definidos; cada item tem botão de remoção individual do rascunho. Ao confirmar a importação, apenas os itens selecionados são removidos do rascunho (via `addMaterial()`) — os desmarcados permanecem salvos para uma importação futura. Dado local apenas (sem persistência no Supabase); não contém dados pessoais.
- **Edição de material existente (D-056)**: `MaterialModal` aceita prop opcional `material` — quando presente, pré-preenche o formulário (`nome`, `quantidade`, `descricao`) e o submit chama `updateMaterial(id, patch)` em vez de `addMaterial()`; título e label do botão mudam para "Editar Material"/"Salvar". `EstoqueTab` adiciona um botão de edição (ícone `edit`) ao lado do botão de exclusão em cada linha de estoque, abrindo `MaterialModal` com o material selecionado via estado `editMaterial`. Reaproveita a operação `updateMaterial` já existente em `materialApi.js` (sem mudança na API/backend); restrito ao marketing pela mesma proteção dupla do D-053 (UI + RLS).
- **Área de Ofertas — 1 oferta por serviço, Storage público, envio manual (D-057)**: tabela `ofertas` tem `servico` como chave primária (máx. 5 linhas, mesmo enum de `servicoInteresse`), sobrescrita ao editar — sem histórico/versionamento. Imagem vai para o bucket público `ofertas` do Supabase Storage (primeiro uso de Storage no projeto), path determinístico `<servico>.<ext>`, `upsert: true`; URL renderizada com `?v=<atualizado_em>` para cache-busting. `db.saveOferta` é a única exceção ao padrão 100%-síncrono de `db.save*` (upload precisa terminar antes do upsert). `ofertas` carrega no boot via `fetchAll` (tabela pequena e estática, mesmo tratamento de `materiais`); `oferta_envios` (indicador de clique, não de entrega) é buscado on-demand por evento junto com `fetchLeadsEvento`, preservando a decisão TB-004/D-039. Proteção dupla UI+RLS marketing-only, mesmo padrão do D-053. CSP `img-src` em `vercel.json` ampliada para `https://*.supabase.co` — sem isso a imagem não carrega em produção/preview (CSP não existe em `npm run dev`).
- **Captação por mês de referência, mutuamente exclusiva a evento (D-058)**: `leads.mes_referencia` (date, primeiro dia do mês) e `leads.evento_id` são protegidos por `check (num_nonnulls(evento_id, mes_referencia) = 1)` — nenhum lead pode ter os dois ou nenhum. RLS não muda (já era escopada por `vendedor_id`/papel, nunca por evento). Ranking espelhado via RPC `ranking_mes(mref)` (mesmo padrão de `ranking_evento`, cache de 30s com chave própria `ranking_mes:`). Retenção LGPD (PA-10) ganha um terceiro bloco em `limpar_leads_expirados()`: leads de mês cujo mês terminou há mais de `retencao_leads_mensais_dias` (365 por padrão) são expurgados fisicamente, simétrico ao bloco de "evento encerrado há N dias". `VendedorApp.jsx` expõe um seletor "Evento"/"Atividade do Mês" sempre visível (`contextoTipo`), com default inteligente (evento se houver um ativo, senão mês) mas troca livre a qualquer momento; o caminho "evento" preexistente não foi reescrito, só ganhou um branch condicional.
- **QR Code como atributo, não contexto operacional (D-061)**: `origem`/`qr_code_id`/`qr_code_label` são colunas paralelas a `evento_id`/`mes_referencia`, nunca substituem o modelo de contexto ao vivo (ranking/meta/fetch sob demanda). RLS de `leads_select` restringe o papel `vendedor` a `vendedor_id is not null` — zero impacto em leads existentes (100% já nascem com vendedor). Distribuição é manual (`LeadsTab.jsx`, seção "Leads sem vendedor"), usando `db.saveLead()` direto (não `updateLead()` do contexto) porque esses leads não estão no array `leads` compartilhado do `AppProvider` em modo Supabase. **D-065:** essas colunas e o pipeline de distribuição continuam ativos (compartilhados com `origem='formulario'`), mas o único gerador que produzia `origem='qrcode'` foi retirado — a partir de D-065, nenhum lead novo nasce com essa origem.
- **Navegação do Marketing em 3 diretos + "Mais" agrupado (D-065)**: `MarketingApp.jsx` define `DIRECT_TABS` (Início, Eventos, Relatórios) e `MORE_GROUPS` (array de `{ title, items }`, um por categoria — Captação/Comercial/Operação/Sistema). O mesmo `MORE_GROUPS` alimenta tanto o dropdown desktop (`.nav-more-dropdown`, ancorado no botão "Mais" do `.header-nav`) quanto o bottom sheet mobile (`.more-sheet`, já existente desde antes) — um único array evita divergência entre os dois formatos. `ComercialApp.jsx` não ganhou esse padrão: com só 4 tabs, todas continuam diretas (decisão explícita, não omissão).
- **Form Builder — catálogo fixo, não motor genérico (D-062)**: `CAMPOS_FORMULARIO` (`src/lib/constants.js`) é a única fonte de tipos de campo aceitos; `formularios.campos`/`campos_obrigatorios` guardam só chaves desse catálogo. Edge Function `submeter-formulario` nunca aceita um `tipo` vindo do cliente — sempre a config já gravada em `formularios` (escrita restrita a marketing/comercial). Primeira leitura `anon` do projeto (RLS `to anon`, só `ativo=true`) em `formularios`/`campos_personalizados` — necessária pra página pública renderizar sem sessão, mas expõe só metadado não sensível (nome, lista de campos).
- **Campos personalizados — sempre texto livre (D-063)**: `campos_personalizados` é gerido por marketing/comercial, mas o **tipo nunca é escolha da equipe** — só a legenda (`label`). Respostas em `leads.campos_extras` (jsonb, chave = `key`), fora das colunas fixas do catálogo. Exibição genérica (`rótulo: valor`) reaproveitada em qualquer tela que já mostra o Lead — não redesenha nada a cada campo novo.
- **Retenção LGPD para leads sem contexto operacional (D-064)**: `limpar_leads_expirados()` ganha um 4º bloco (`migracao-qrcode-retencao.sql`) — leads sem `evento_id` nem `mes_referencia` (QR Code, Form Builder) expiram por `criado_em` (não existe "fim de contexto" pra eles, ao contrário de evento/mês).
- **CORS das Edge Functions públicas**: `Access-Control-Allow-Headers` deve incluir `authorization, apikey, content-type` — o frontend sempre envia `apikey`/`authorization` (exigidos pela própria plataforma Supabase antes de chegar na função), não só `content-type`. Faltar isso quebra a chamada real com "Failed to fetch" no navegador (D-064).
- **Realtime Broadcast do Monitor (canal único)**: `activityLog.js` é o único dono do canal `rjnet-monitor` — registra `.on('broadcast', { event: 'log' }, handler)` ANTES de `.subscribe()` (requisito do Supabase JS v2). `MonitoringTab` registra callbacks via `subscribeToRemoteLogs(callback)` — nunca abre canal próprio. Fila `_queue` garante entrega de mensagens enviadas antes de `SUBSCRIBED`. Canal público (anon key), multiplexado na WebSocket existente. **Limitação conhecida (D-052)**: Realtime Broadcast não tem replay/history — eventos emitidos enquanto o MonitoringTab não está subscrito são perdidos irrecuperávelmente; `lead_sync_ok` pode não aparecer no log do marketing se a aba estava fechada no momento da confirmação pelo vendedor. Alternativa estrutural: persistir `activity_log` no Supabase para garantir consistência cross-device sem depender de presença ativa do canal (D-046, D-047)
- **Leads da Atividade do Mês agrupados por dia (D-066, D-068)**: `MesDetail.jsx` agrupa `mesLeads` por `diaKey(l.criadoEm)` (chave local `YYYY-MM-DD`, não UTC — evita virar o dia errado perto da meia-noite) em vez de renderizar uma tabela única. Cada grupo vira um cartão colapsável (`"Hoje"` / `"Ontem"` / `"DD/MM — dia da semana"`), ordenado do mais recente pro mais antigo; só o primeiro (`grupos[0]`) abre por padrão, controlado por `diasAbertos` (Set) + um ref que aplica o padrão uma única vez por `mesReferencia` (sem sobrescrever toggles manuais do usuário quando os leads terminam de carregar de forma assíncrona). Busca por nome ignora `diasAbertos` e força abertos só os dias com match, ocultando os demais. Como os grupos nascem só de leads já existentes, não há geração de dias vazios (passados sem captação ou futuros) — um dia novo aparece sozinho assim que o primeiro lead dele é gravado. Dentro de cada dia, leads ordenados do mais recente pro mais antigo e a tabela ganha coluna "Horário" (`fmtHora`, HH:MM de `criadoEm`) como primeira coluna — D-068. **Nota de CSS (D-068):** o `overflow: hidden` do cartão do dia vive num `<div>` wrapper interno, nunca no mesmo elemento que carrega `box-shadow` (`.card`) — combinar as duas propriedades no mesmo elemento causa artefato de sombra preta sólida em navegadores mobile Chromium/Samsung Internet durante o scroll; regra vale para qualquer novo componente com cantos arredondados + sombra + clipping. Mudança 100% frontend, sem migração de banco.
- **Sombras do tema escuro proporcionais ao fundo quase preto (D-069)**: `--shadow-card`/`--shadow-float`/`--shadow-glow` em `:root` (`src/index.css`) usam alpha bem mais baixo que o valor original (`.5`→`.25`, `.7`→`.35`, `.4`→`.2`, mesma estrutura de offset/blur). Motivo: `--bg`/`--surface` são quase pretos (`#090909`/`#111111`, decisão V3 de "fundos mais escuros"), e sombra preta com alpha alto sobre fundo quase preto não degrada suavemente — lê como bloco preto sólido, mais visível onde cards ficam próximos/empilhados (ex: accordion de D-066). O tema claro (`.light .card`) já usava um alpha proporcional (`.08`); só o escuro estava desproporcional. Qualquer novo `box-shadow` no tema escuro deve usar essas variáveis (nunca `rgba(0,0,0, >.3)` hardcoded) para não reintroduzir o problema.
- **`.tbl-wrap::after` ("TableScrollHint") removido (D-070)**: era um gradiente `linear-gradient(to right, transparent, var(--bg))` de 32px fixo na borda direita de toda tabela rolável no mobile (`LeadsTab.jsx`, `MesDetail.jsx`, `EventDetail.jsx`, todas via `.tbl-wrap`), pensado como indicador de "tem mais conteúdo pra rolar". Como era `position: absolute` preso à borda do **container visível** (não do conteúdo) e `var(--bg)` é quase preto, ele cobria texto real de célula permanentemente — não some ao rolar até o fim, é CSS estático sem lógica de scroll. Essa era a real causa raiz da "sombra preta" reportada em sessões anteriores, distinta dos bugs corrigidos em D-068 (box-shadow+overflow:hidden pontual) e D-069 (alpha global das variáveis de sombra) — as três eram problemas reais e independentes, só a combinação delas explicava as sucessivas reincidências da mesma queixa visual. Scroll horizontal das tabelas continua funcionando por gesto de toque (`overflow-x: auto` em `.tbl-wrap` não foi tocado); só o indicador visual de fade foi retirado. Qualquer novo indicador de scroll no futuro não deve sobrepor a área de texto das células.
- **Simulador — catálogo fixo, scoring no servidor, UTM como eixo de canal (D-072)**: `PERGUNTAS_SIMULADOR` (`src/lib/simulador.js`, sem imports de propósito — testável standalone em Node e espelhado em Deno) é a única fonte de perguntas/opções aceitas; `calcularPerfil()` no cliente é só UX — a Edge Function `submeter-simulador` recalcula pontuação (soma ponderada), temperatura (≥60 quente, 30–59 morno, <30 frio) e oferta a partir das respostas brutas. `leads.perfil_consumo` vive na linha do lead de propósito (retenção D-064 expurga junto). `leads.utm` (whitelist de 5 chaves utm_*, sanitizadas) é o eixo de canal: QR embute `utm_source=qrcode&utm_medium=impresso`, anúncios trazem os próprios UTMs — nunca duplicar campanha por canal. `fetchLeadsQrCode` filtra `origem in ('qrcode','formulario','simulador')` (contexto "Captação" do vendedor); a fila de distribuição ordena por `pontuacao` desc (sem score por último). **Ordem de deploy**: `migracao-simulador.sql` + `NOTIFY pgrst` antes do frontend — `LEADS_COLS`/`leadToDb` referenciam as colunas novas. As duas Edge Functions públicas importam de `supabase/functions/_shared/captacao.ts` (CORS/sanitização/rate limit) — mudança lá exige redeploy das duas.
- **Pacote fixo por perfil de uso + combo de upsell (D-074)**: no tipo `perfil_consumo`, a primeira etapa do wizard passou a ser uma pergunta de perfil (`PERFIS_SIMULADOR` — Básico/Streaming/Home Office/Gamer, cada um com pacote de internet FIXO associado, nunca calculado por soma de sinais). As demais perguntas (de intenção) alimentam só `pontuacao`/`temperatura` da fila — nunca o pacote. A tela de resultado monta um combo de checkboxes (Apps Yellow +R$15, Apps Black +R$30, upgrade pro próximo pacote) via `montarCombo()`, sempre recalculado a partir de `PACOTES_INTERNET`/`APPS_ADICIONAIS` (mesmo catálogo compartilhado com a aba "Pacotes" do vendedor, `VendedorApp.jsx` — preço único, sem duplicação) — nunca aceita um total pronto do cliente, mesmo princípio do score. Cada checkbox tem um botão "ⓘ" que abre um popup com os apps reais daquele bundle (D-075). Apps Black ganha destaque visual (não pré-marcado) quando o PERFIL escolhido é `streaming` (D-075 — antes dependia de uma resposta específica de quiz, que deixou de ser garantida). Gravado em `leads.perfil_consumo.perfil`/`.combo` (mesmo jsonb do D-072).
- **Perguntas de intenção configuráveis POR CAMPANHA, com peso por opção (D-075)**: cada campanha `demanda` guarda seu PRÓPRIO questionário em `simuladores.perguntas` (jsonb — `{id, texto, tipo, opcoes:[{id, texto, peso}]}`), criado/editado pelo marketing num construtor (`PerguntasBuilder`, botão "Perguntas" em `SimuladorTab.jsx`) — não é mais um catálogo fixo global (D-072). Campanha nova já nasce com um molde padrão (`perguntasPadrao()`) pré-preenchido e editável. `calcularPerfilDinamico()` soma os pesos das opções escolhidas e calcula a temperatura como PERCENTUAL da pontuação máxima possível DAQUELA campanha (≥60% quente, 30–59% morno, <30% frio) — não um número fixo, porque cada campanha pode ter perguntas/pesos diferentes. Score sempre recalculado no servidor a partir da própria config gravada (nunca aceita peso vindo do cliente). Perguntas condicionais (`exibirSe`) foram removidas — v1 é uma lista linear. `leads.perfil_consumo` grava um SNAPSHOT das perguntas usadas na submissão (não só uma referência à campanha, que pode mudar/ser apagada depois); `resumoPerfil()` detecta dois formatos (leads novos com snapshot vs. leads legados D-072 sem ele).
- **Simulador vira 2 fluxos independentes, Territorial removido (D-076)**: até aqui uma campanha `perfil_consumo` encadeava a etapa fixa de perfil (D-074) E as perguntas configuráveis (D-075) na MESMA sessão pública — confundia o marketing (editava "Pergunta 1" no construtor, ela aparecia como a 2ª tela do quiz, atrás do perfil). Virou 2 tipos mutuamente exclusivos, cada um com seu fluxo público próprio, nunca mais chained: `oferta` (só perfil→pacote+combo, sem perguntas, lead sempre `temperatura='quente'`/`pontuacao=null`) e `demanda` (só perguntas→`mensagem_resultado` PERSONALIZADA pela campanha, sem perfil/pacote, `pontuacao`/`temperatura` calculados). `mensagem_resultado` (novo, `migracao-simulador-tipos.sql`) substitui o pacote como "valor antes do dado" do fluxo `demanda`, já que não há o que recomendar sem a etapa de perfil. `SimuladorTab.jsx` só libera o botão "QR / Link" de uma campanha `demanda` depois de `perguntas.length > 0` — campanha nova desse tipo já abre direto no construtor. Tipo `territorial` (D-073) retirado do seletor de criação e dos 2 fluxos — linhas existentes são desativadas pela migração, não apagadas; RPC `demanda_por_regiao()`/relatório "Demanda por região" continuam ativos (agregam qualquer lead com cidade/bairro, não só os de origem territorial). `resumoPerfil()` não mudou: já tratava `perfil`/`combo` e `perguntas`/`respostas` como blocos independentes desde o D-075.
- **Moderação do formulário público (D-067, estendida ao simulador em D-072)**: `submeter-formulario` e `submeter-simulador` são as únicas escritas não-autenticadas do sistema (ambas herdam as camadas abaixo via `_shared/captacao.ts`) — três camadas além do honeypot/sanitização já existentes: (1) `containsLink()` (`src/lib/security.js`, duplicada em Deno na Edge Function) rejeita link em `nome`/`endereco`/`bairro`/campos personalizados; (2) `leads.origem_ip` capturado via `x-forwarded-for`, sem retenção própria (apagado junto do lead pela retenção D-064); (3) rate limit de 5 submissões/10min por IP, contado direto em `leads` (sem tabela nova) antes de cada insert. `FilaDistribuicao` (`LeadsTab.jsx`) ganha exclusão em dois passos pra descartar lead suspeito sem atribuí-lo antes. Processo de remoção/denúncia de conteúdo ilegal em `doc/SEGURANCA_MODERACAO.md` — a responsabilidade por conteúdo submetido é de quem opera o formulário, não de quem hospeda a infraestrutura (por isso a decisão foi reforçar o Form Builder próprio em vez de migrar para Google Forms).

---

## 8. Dependências Críticas

| Dependência | Versão | Papel |
|---|---|---|
| `react` + `react-dom` | ^19.2.7 | Framework UI |
| `@supabase/supabase-js` | ^2.108.1 | Backend (auth, DB, realtime) |
| `chart.js` | ^4.5.1 | Gráfico donut de leads por serviço |
| `qrcode` | ^1.5.4 | Geração de imagem QR 100% client-side, usada pelo Form Builder por formulário (D-062, D-065) |
| `vite` + `@vitejs/plugin-react` | ^8.0.16 / ^6.0.2 | Build e dev server |
| `@playwright/test` | ^1.44.0 | Testes E2E |

**Sem dependências de:** React Router, Axios, Zustand, Redux, Tailwind, Material UI, i18n.

---

## 9. Restrições Arquiteturais

- **Sem lógica de negócio em componentes UI** — componentes só chamam operações via `useApp()`
- **Sem acesso a `import.meta.env` fora de `src/lib/supabase.js`** — demais módulos consomem `supabaseEnabled` ou `supabaseConfig`
- **Sem CRUD direto fora de `src/api/`** — nem contexto, nem componente acessa `dataService` diretamente. **Exceção documentada (D-062/D-064):** `LeadsTab.jsx` (fila de distribuição) e a página pública (`src/public/FormularioPublico.jsx`) chamam `dataService.js` direto — a primeira porque busca leads que não fazem parte do array `leads` do `AppProvider`; a segunda porque não tem `AppProvider`/sessão nenhuma por design.
- **Sem "god services"** — cada factory de API tem escopo de um único domínio
- **Sem biblioteca de roteamento** — navegação por `useState` de tab ativa. **Exceção mínima (D-062):** `main.jsx` checa `window.location.pathname` pra `/f/:slug` antes de renderizar `AppProvider`/`Root` — não é um roteador, é um desvio único no boot pra essa página pública (a rota irmã `/qr/:id`, do gerador de QR Code standalone, foi retirada em D-065).
- **Sem modo server-side** — SPA puro, deploy estático via Vercel. O backend limita-se a Supabase (Postgres + RLS) e a Edge Functions pontuais e públicas (`atualizar-email-usuario`, `submeter-formulario`) — nunca um servidor de aplicação próprio.
