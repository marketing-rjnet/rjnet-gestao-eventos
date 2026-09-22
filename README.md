# RJNet Gestão de Eventos

Sistema de gerenciamento de eventos de campo **e do dia a dia comercial** da RJNet. Permite que o time de marketing (e, no mesmo nível para eventos/ofertas/relatórios, o time comercial) crie e gerencie eventos, estoque, ofertas, formulários públicos de captação, campanhas do Simulador, Landing Pages com monitoramento de aquisição, o Desafio RJNET (ativação com cronômetro) e equipe, enquanto vendedores capturam leads — em eventos de campo, na atividade comercial mensal ou via canais públicos (formulário/QR Code, Simulador, Landing Page) — e acompanham desempenho em tempo real. Tudo em um único SPA React com suporte offline e sincronização automática via Supabase.

---

## Visão Geral


O sistema nasceu para resolver um problema operacional concreto: eventos de campo da RJNet envolviam equipes de vendedores capturando leads em locais com conexão instável, e um time de marketing que precisava acompanhar resultados e controlar materiais em tempo real. Ele evoluiu para cobrir também o **dia a dia do vendedor fora de eventos** (D-058) — o vendedor alterna livremente entre o contexto "Evento" (campo) e "Atividade do Mês" (comercial contínuo, por mês de referência) — e **canais de captação públicos sem sessão**, todos convergindo para o mesmo Lead via Edge Function pública:

- **Form Builder** (D-062, D-063): formulários configuráveis pelo marketing, cada um com seu próprio QR Code/link.
- **Simulador** (D-072–D-084): campanhas gamificadas em `/s/:slug` em 3 tipos independentes — **Oferta** (quiz fixo → perfil deduzido → pacote + combo), **Demanda** (perguntas com peso → mensagem personalizada) e **Quiz de Acertos** (cadastro antes do quiz → perguntas certo/errado → faixa → sorteio). Score/perfil sempre recalculados no servidor; duplicidade do Quiz bloqueada por número de WhatsApp.
- **Landing Pages + Aquisição** (D-104): infraestrutura genérica de LPs externas (a LP Fibra é a primeira) com SDK público `rjnet-lp.js`, sessão anônima com UTM first-touch, eventos internos (`page_view` → `whatsapp_click`) e dashboard de funil Visitas → Interações → Leads → WhatsApp.

Fora da captação de leads, o **Desafio RJNET — Acerte 00:03:33** (D-089–D-102) é um módulo de ativação de evento: cadastro de participantes com até N tentativas no cronômetro, ranking Top 10 pela melhor tentativa, ganhadores instantâneos, prêmios por posição e uma tela pública de TV (`/tv/:slug`) em tempo real.

**Três perfis de acesso:**

| Perfil | O que faz |
|--------|-----------|
| `marketing` | Cria eventos, gerencia estoque de materiais, mantém as ofertas prontas por serviço, cria formulários (Form Builder), campanhas do Simulador e Landing Pages, opera o Desafio RJNET, acompanha KPIs e funil de aquisição, exporta leads (por evento, por mês e fila em espera), distribui leads sem vendedor, gerencia equipe |
| `comercial` | Mesmo nível do marketing em eventos, ofertas e relatórios de leads; Desafio só em leitura + export CSV (D-101); **sem** acesso a estoque, equipe, Monitor, captação digital ou Aquisição (D-059) |
| `vendedor` | Registra leads em campo ou no dia a dia mensal, acompanha ranking, gerencia os próprios leads, envia ofertas prontas por WhatsApp; leads de captação digital (Formulário/Simulador/Landing Page) aparecem só depois de distribuídos pelo marketing/comercial |

**Dois modos de operação:**

| Modo | Quando usar | Comportamento |
|------|-------------|---------------|
| Supabase | Produção | Auth com RBAC, realtime entre dispositivos, persistência no banco |
| Local | Desenvolvimento / demo | `localStorage`, credenciais de `.env.local`, sem dependências externas |

O modo é detectado automaticamente pela presença de `VITE_SUPABASE_URL`. Sem a variável, o app funciona 100% offline.

---

## Arquitetura

O sistema é um SPA React sem biblioteca de roteamento — a navegação entre telas é feita via `useState`. O estado global é gerenciado por React Context (`AppContext`), exposto via hook `useApp()`.

```
Componente UI
    ↓  useApp()
AppContext / AppProvider          ← orquestra estado + efeitos
    ↓  factory functions
src/api/*.js                      ← update otimista + chamada assíncrona ao banco
    ↓  dataService
src/lib/dataService.js            ← queries Supabase, retry, realtime, camelCase↔snake_case
    ↓
Supabase (PostgreSQL + RLS)
    ↓  subscription realtime (debounce 1500ms — D-038)
AppProvider re-sincroniza estado
```

**Fluxo paralelo — captação pública sem sessão (D-062, D-072, D-104):** as páginas públicas (`/f/:slug` Form Builder, `/s/:slug` Simulador) e as Landing Pages externas (via SDK `public/rjnet-lp.js`) não passam por `AppProvider`/`useApp()`. Em modo Supabase chamam Edge Functions públicas (`submeter-formulario`, `submeter-simulador`, `submeter-lp`, `rastrear-lp`) que validam, sanitizam e recalculam tudo no servidor; em modo local/preview, `src/lib/localPublicSubmit.js` grava direto no `localStorage` (nunca é o caminho de produção). O lead cai na mesma tabela `leads`, sem `vendedor_id` — fica na fila "Leads sem vendedor" do marketing/comercial até ser distribuído manualmente.

**Tela pública de TV do Desafio (`/tv/:slug`, D-089):** 100% leitura via RPC `timer_challenge_painel_publico` (SECURITY DEFINER) + Supabase Realtime Broadcast — nunca lê as tabelas diretamente nem usa `postgres_changes`.

**Decisões arquiteturais chave:**

- **Updates otimistas** (D-006): a UI muda na hora; o banco sincroniza em segundo plano. Falhas são indicadas pelo `SyncBadge`.
- **Retry com backoff exponencial** (D-007): 800ms inicial, 3 tentativas — essencial para conexões instáveis em eventos.
- **Fila offline** (D-003): leads capturados sem internet são enfileirados em `localStorage` e sincronizados ao reconectar.
- **RLS como segunda linha de defesa** (D-004, D-078): as permissões são validadas no banco, não apenas no frontend. Leitura anônima só onde a página pública precisa (metadado de formulário) ou via RPC SECURITY DEFINER (`simulador_publico`, `landing_page_publica`, `timer_challenge_painel_publico` — D-103/D-104/D-089); escrita anônima só via Edge Function.
- **Regra de negócio sensível no servidor** (D-072, D-083, D-104): score/perfil do Simulador, acertos do Quiz, UTM de LP e dedupe são recalculados nas Edge Functions — o cliente nunca manda resultado pronto.
- **Sanitização obrigatória** (D-005): todo input passa por `sanitizeText()` antes de qualquer escrita.
- **Factory pattern na API** (D-024): todo CRUD passa por `src/api/`, nunca acessa `dataService` diretamente.

---

## Estrutura de Módulos

```
src/
├── main.jsx                    # Ponto de entrada — ErrorBoundary + createRoot; desvio mínimo pra /f/:slug, /s/:slug e /tv/:slug ANTES do AppProvider (D-062, D-072, D-089)
├── index.css                   # Estilos globais (tema dark/light via CSS variables)
│
├── apps/
│   ├── Root.jsx                # Detecta modo (Supabase/local) e dark mode
│   ├── MarketingApp.jsx        # Shell do marketing: 3 tabs diretas + "Mais" agrupado por categoria (D-065)
│   ├── ComercialApp.jsx        # Shell do comercial: Início/Eventos/Ofertas/Relatórios/Desafio (leitura), sem estoque/equipe/monitor (D-059, D-101)
│   └── VendedorApp.jsx         # Shell do vendedor: 4 tabs + seletor Evento/Atividade do Mês/QR Code (D-058, D-061)
│
├── auth/
│   ├── RootAuth.jsx / RootLegacy.jsx   # Roteadores de auth por modo (RootAuth cobre 3 papéis, D-059)
│   ├── LoginAuth.jsx / Login.jsx       # Formulários de login
│   ├── NovaSenha.jsx                   # Redefinição de senha por link
│   └── index.js
│
├── features/
│   ├── events/        # Dashboard (KPIs + cards clicáveis Evento/Mês, D-060), EventosTab (lista), EventDetail (detalhe)
│   ├── inventory/     # EstoqueTab (gestão de materiais por nível, importação em lote)
│   ├── offers/        # OfertasTab — oferta ativa por serviço, marketing/comercial (D-057, D-059)
│   ├── leads/         # LeadsTab (filtros, export CSV, fila "Leads sem vendedor" com export dos em espera, accordions, Demanda por região), MesDetail (detalhe do mês por dia) (D-060, D-066, D-085–D-087, D-096)
│   ├── checkin/       # CheckinTab (busca de lead por CPF)
│   ├── team/          # EquipeTab (modo local) / EquipeAuthTab (modo Supabase + RBAC) — marketing only
│   ├── monitoring/    # MonitoringTab — diagnóstico ao vivo de sincronização e atividade, marketing only (D-044+)
│   ├── formularios/   # FormBuilderTab — Form Builder: catálogo fixo de campos + campos personalizados, gera QR Code/link por formulário, marketing only (D-062, D-063, D-065)
│   ├── simulador/     # SimuladorTab — campanhas Oferta/Demanda/Quiz, construtores de perguntas/faixas, Sorteador, QR/link, export CSV, marketing only (D-072–D-084, D-096)
│   ├── aquisicao/     # AquisicaoTab — Dashboard/Landing Pages/Campanhas/Conversões, detalhe da LP com snippet de integração, marketing only (D-104)
│   └── desafio/       # DesafioTab (marketing) / DesafioComercialTab (comercial, leitura) — cadastro, tentativas, ranking, ganhadores, prêmios, painel, Tela de TV (D-089–D-102)
│
├── public/
│   ├── FormularioPublico.jsx   # Página pública do Form Builder (`/f/:slug`), sem sessão, sem AppContext (D-062)
│   ├── SimuladorPublico.jsx    # Página pública do Simulador (`/s/:slug`) — 3 fluxos por tipo de campanha (D-072, D-076, D-080, D-083, D-084)
│   └── DesafioPublico.jsx      # Tela pública de TV do Desafio (`/tv/:slug`) — ranking + ganhadores em tempo real (D-089)
│
├── components/
│   ├── ui.jsx          # Icon, StatusBadge, TipoBadge, Kpi, ChartView
│   ├── SyncBadge.jsx   # Indicador visual de sincronização
│   ├── CronometroInput.jsx # Campo MM:SS:CC com máscara automática (Desafio, D-098)
│   └── modals/         # EventModal, MaterialModal, MaterialChecklistModal, OfertaModal
│
├── context/
│   ├── AppContext.js   # createContext(null)
│   ├── AppProvider.jsx # Provider: estado + efeitos + factories de API
│   └── index.js
│
├── api/
│   ├── eventoApi.js               # createEventoApi — add, update, remove, patch
│   ├── leadApi.js                 # createLeadApi — add, update, remove, obterRanking/obterRankingMes
│   ├── materialApi.js             # createMaterialApi — add, update, addEvento, removeEvento, toggleRetornado
│   ├── vendedorApi.js             # createVendedorApi — add, update, toggle
│   ├── ofertaApi.js               # createOfertaApi — saveOferta, removeOferta, registrarOfertaEnviada (D-057)
│   ├── equipeApi.js               # createEquipeApi — CRUD de usuários Auth com RBAC (modo Supabase)
│   ├── formularioApi.js           # createFormularioApi — CRUD de formulários do Form Builder (D-062)
│   ├── campoPersonalizadoApi.js   # createCampoPersonalizadoApi — CRUD de campos personalizados reutilizáveis (D-063)
│   ├── simuladorApi.js            # createSimuladorApi — CRUD de campanhas do Simulador (D-072, D-076, D-080)
│   ├── desafioApi.js              # createDesafioApi — dias, participantes, tentativas, prêmios do Desafio (D-089–D-100)
│   └── landingPageApi.js          # createLandingPageApi — CRUD de Landing Pages (D-104)
│
├── hooks/
│   ├── useApp.js        # Único ponto de consumo do AppContext
│   ├── usePersisted.js  # Sincronização de estado com localStorage/sessionStorage
│   ├── useRanking.js    # Polling de ranking com debounce e cleanup automático
│   ├── useDesafioPainelPublico.js # Tela de TV do Desafio — RPC pública + Broadcast (D-089)
│   └── useAquisicaoMetricas.js    # Métricas de aquisição — RPC ou calcularFunil() local (D-104)
│
├── utils/
│   ├── format.js    # fmtDate, fmtDateLong, initials, label maps, mesesDoAno/mesReferenciaLabel (D-058)
│   ├── masks.js     # maskCpf, maskTel, validarCpf, validarTelefone
│   ├── csv.js       # exportLeadsCSV (evento/mês), exportLeadsSemVendedorCSV (fila em espera, D-085), exportDesafioEntriesCSV (D-089)
│   ├── ids.js       # genId(prefix) — gerador de IDs temporários para modo local
│   └── mockData.js  # MOCK_* para modo local
│
└── lib/
    ├── supabase.js          # Cliente Supabase + supabaseEnabled (feature flag)
    ├── mode.js              # isSupabaseMode(), getMode(), MODE — fonte única de verdade do modo
    ├── dataService.js       # Queries, auth, realtime, retry, fila offline, camelCase↔snake_case
    ├── activityLog.js       # Log de atividade (Monitor): buffer local + broadcast Realtime
    ├── crypto.js            # AES-GCM + PBKDF2 para a fila offline no localStorage (LGPD)
    ├── security.js          # sanitizeText() + containsLink() — sanitização e bloqueio de link em texto livre (D-067)
    ├── cache.js             # Cache em memória com TTL (30s para rankings)
    ├── constants.js         # Constantes globais: STATUS_EVENTO, NIVEL_ESTOQUE, META_*, CAMPOS_FORMULARIO (D-062)
    ├── localPublicSubmit.js # Fallback local (sem Supabase) pras páginas públicas (Form Builder, Simulador) — dev/teste only (D-062)
    ├── simulador.js         # Catálogos e scoring do Simulador — sem imports, espelhado em Deno (D-072+)
    ├── desafioCronometro.js # Domínio puro do Desafio: MM:SS:CC↔centésimos, acerto exato, melhorTentativa() (D-089, D-098)
    ├── desafioRealtime.js   # Broadcast do painel do Desafio por dia (D-089)
    └── aquisicao.js         # Domínio puro de Aquisição: EVENTOS_LP, calcularFunil(), sanitização de tracking (D-104)

public/
└── rjnet-lp.js              # SDK público das Landing Pages (Tracking Layer: sessão, UTM, eventos, lead, WhatsApp) (D-104)

supabase/functions/
├── _shared/captacao.ts      # CORS, sanitização, bloqueio de link, rate limit — compartilhado pelas funções públicas
├── atualizar-email-usuario/ # Gestão de usuários (Admin API)
├── submeter-formulario/     # Lead do Form Builder (D-062, D-067)
├── submeter-simulador/      # Lead do Simulador — 3 tipos, 2 fases no Quiz (D-072, D-083, D-084)
├── rastrear-lp/             # Tracking das Landing Pages — sessão + eventos, nunca cria lead (D-104)
└── submeter-lp/             # Lead da Landing Page + evento lead_created (D-104)
```

---

## Regras Importantes do Sistema

Estas regras **não devem ser alteradas sem registrar uma decisão** em `doc/architecture/DECISIONS.md`:

| Regra | Por quê |
|-------|---------|
| Todo CRUD passa por `src/api/`, nunca direto ao `dataService` | Isola domínios, facilita teste e rastreamento. Exceção documentada: `LeadsTab.jsx` (fila de distribuição) e `FormularioPublico.jsx` (sem sessão) chamam `dataService` direto (D-062/D-064) |
| `useApp()` é o único ponto de consumo do `AppContext` | Evita acoplamento direto ao contexto em componentes |
| `supabaseEnabled` de `src/lib/supabase.js` + `src/lib/mode.js` é a única fonte de verdade do modo | Centraliza a lógica de detecção; nenhum arquivo acessa `VITE_SUPABASE_URL` diretamente |
| `sanitizeText()` em todos os inputs antes de gravar | Previne XSS armazenado |
| Updates otimistas: UI primeiro, banco depois | Latência percebida aceitável em campo com 3G/4G |
| `servicoInteresse` é sempre `string[]` no frontend | `leadFromDb` normaliza strings legadas; `leadToDb` serializa como JSON string na coluna TEXT existente |
| `META_BRONZE=20`, `META_PRATA=40`, `META_OURO=60` em `constants.js` | `META_DIARIA` é alias de `META_OURO` para backward-compat |
| Sem lógica de negócio em componentes UI | Componentes chamam operações via `useApp()`, sem acesso ao banco |
| `CAMPOS_FORMULARIO` é o catálogo fixo de campos do Form Builder | Nunca um motor de campo genérico — o cliente nunca decide o `tipo` de um campo (D-062) |
| QR Code/origem do lead é atributo de proveniência, nunca um terceiro contexto operacional | `origem`/`qr_code_id` são colunas paralelas a `evento_id`/`mes_referencia`, não substituem o modelo de ranking/meta ao vivo (D-061) |
| Nunca aceitar score, perfil, acertos ou pacote prontos do cliente | Edge Functions recalculam a partir da config gravada no banco (D-072, D-077, D-080) |
| Leitura pública de dado com regra de negócio só via RPC SECURITY DEFINER | RLS de linha não esconde coluna — ver vazamento do `peso` corrigido em D-103 |
| Toda função `SECURITY DEFINER` nova revoga `EXECUTE` de `public`/`anon` (salvo RPC pública deliberada) | Evita RPC destrutiva chamável via REST (D-078) |
| `melhorTentativa()` é a única fonte de "qual tentativa vale" no Desafio | Replicada em SQL na RPC pública, nunca reimplementada em tela (D-098) |
| Landing Page é linha em `landing_pages`, nunca código por LP; campanha é dimensão UTM, não tabela | Novas LPs entram pela UI; plataformas externas (GA4/Ads/Meta) entram como adapter do SDK (D-104) |

---

## Banco de Dados e Integrações

### Tabelas principais

| Tabela | Descrição |
|--------|-----------|
| `eventos` | Eventos (datas, local, tipo, status, materiais JSONB) |
| `leads` | Leads capturados por vendedor, vinculados a **evento OU mês de referência** — mutuamente exclusivos (D-058); atributos de proveniência `origem`/`qr_code_id`/`qr_code_label`/`formulario_id`/`simulador_id`/`landing_page_id`/`lp_session_id`/`campos_extras`/`utm`/`origem_ip`, qualificação `perfil_consumo`/`pontuacao` (D-061–D-063, D-067, D-072, D-104); soft delete via `deletado` |
| `materiais` | Estoque de materiais promocionais |
| `perfis` | Perfis de usuários Auth (papel: `marketing` / `comercial` / `vendedor` — D-059) |
| `ofertas` | Oferta ativa por serviço (imagem + copy), `servico` como chave primária — máx. 5 linhas (D-057) |
| `oferta_envios` | Indicador de clique em "Enviar oferta" por lead/serviço — não é confirmação de entrega (D-057) |
| `formularios` | Formulários do Form Builder — campos do catálogo fixo + campos personalizados vinculados, `slug` único (D-062) |
| `campos_personalizados` | Catálogo de campos de texto livre reutilizáveis entre formulários (D-063) |
| `simuladores` | Campanhas do Simulador — tipo `oferta`/`demanda`/`quiz`, perguntas/pesos (`perguntas`), gabarito e faixas (`quiz_perguntas`/`quiz_faixas`), `mensagem_resultado`; leitura pública só via RPC `simulador_publico` (D-072, D-076, D-080, D-103) |
| `timer_challenge_events` | Dias/edições do Desafio RJNET — tempo-alvo, `max_attempts`, prêmio do dia e prêmios por posição do ranking (D-089, D-091–D-093, D-098) |
| `timer_challenge_entries` | Participantes do Desafio — nome/telefone, prêmio, controle de entrega, `ja_cliente_rjnet` (D-089, D-098, D-099) |
| `timer_challenge_attempts` | Tentativas do Desafio (1 linha por tentativa) — resultado, diferença, acerto exato (D-098) |
| `landing_pages` | Landing Pages (entidade genérica) — serviço, status, WhatsApp, IDs de tracking; leitura pública só via RPC `landing_page_publica` (D-104) |
| `lp_sessions` / `lp_events` | Sessões anônimas de visita (UTM first-touch, sem IP) e eventos internos das LPs; escrita só pelas Edge Functions (D-104) |

### Enums de domínio

- **status evento:** `planejado` · `ativo` · `encerrado`
- **tipo evento:** `sinalizacao` · `presenca_comercial` · `ativacao_especial`
- **temperatura lead:** `frio` · `morno` · `quente` · `convertido`
- **serviços:** `internet_residencial` · `internet_empresarial` · `rjnet_movel` · `streamings` · `outro`
- **papel perfil:** `marketing` · `comercial` · `vendedor` (D-059)
- **origem do lead:** `evento` · `mes` · `qrcode` · `formulario` · `simulador` · `landing_page` (D-061, D-062, D-072, D-104)
- **tipo de campanha do Simulador:** `oferta` · `demanda` · `quiz` (D-076, D-080)
- **status da Landing Page:** `ativa` · `preparacao` · `inativa` (D-104)
- **eventos de LP:** `page_view` · `cta_click` · `form_start` · `form_submit` · `lead_created` · `whatsapp_click` (D-104)

### RLS, realtime, performance e erros de sync

Fonte oficial: `doc/architecture/SYSTEM_MAP.md` §5 "Domínios de Negócio" e §7 "Regras Técnicas Atuais" — cobre as regras de RLS por papel (`marketing`/`comercial`/`vendedor`/`anon`), debounce de realtime, cache de ranking, `withRetry()`, fila offline e o despacho de erros de sync via `rjnet:sync-error`. Detalhes de RLS a nível de banco (schema, policies, ordem de migrações): `doc/architecture/SUPABASE.md`.

---

## Como Rodar o Projeto

### Pré-requisitos

- Node.js 18+
- npm

### Instalação

```bash
git clone <repo>
cd rjnet-gestao-eventos
npm install
```

### Modo local (sem Supabase)

```bash
cp .env.example .env.local
# Preencha VITE_MARKETING_USER e VITE_MARKETING_PASS
npm run dev   # http://localhost:3000
```

### Modo Supabase

```bash
# .env.local
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima

npm run dev
```

**Setup inicial do banco:**
1. SQL Editor do Supabase → executar `supabase/schema.sql`
2. Executar as demais migrações **na ordem definida em `doc/architecture/SUPABASE.md`** (o projeto já acumula dezenas — auth, ofertas, leads mensais, Simulador, Desafio, Landing Pages etc.; a ordem importa porque algumas dependem de colunas criadas por outras). `migracao-hardening-seguranca.sql` roda por último, seguido de `NOTIFY pgrst, 'reload schema';` (D-078)
3. Publicar as Edge Functions públicas (`submeter-formulario`, `submeter-simulador`, `rastrear-lp`, `submeter-lp`) e configurar o secret `CORS_ALLOWED_ORIGINS` — checklist em `doc/SEGURANCA_HARDENING.md` e `doc/aquisicao/INTEGRACAO_LP.md`
4. Criar primeiro usuário marketing:
   ```sql
   UPDATE perfis SET papel = 'marketing', ativo = true WHERE email = 'seu@email.com';
   ```

### Scripts disponíveis

```bash
npm run dev           # Dev server (localhost:3000)
npm run build         # Build de produção → dist/
npm run preview       # Preview do build

npm test              # E2E Playwright completo
npm run test:unit     # Testes unitários (Node.js): segurança, leads, Simulador, cronômetro do Desafio, Aquisição
npm run test:all      # Suite completa
npm run test:security # Testes de segurança E2E
npm run test:report   # Relatório HTML
```

### Deploy (Vercel)

Push na branch principal dispara deploy automático. Variáveis de ambiente configuradas em Settings → Environment Variables. Headers de segurança (CSP, HSTS, X-Frame-Options) aplicados via `vercel.json`.

---

## Convenções e Padrões de Código

| Área | Convenção |
|------|-----------|
| **Nomenclatura JS** | camelCase — a conversão para snake_case do banco é automática no `dataService` |
| **Novos CRUDs** | Sempre via factory em `src/api/` — nunca chamar `dataService` diretamente de componentes ou contexto |
| **Novos inputs** | Sempre passar por `sanitizeText()` antes de gravar |
| **Acesso ao contexto** | Sempre via `useApp()` — nunca `useContext(AppContext)` diretamente |
| **Detecção de modo** | Sempre via `src/lib/mode.js` — nunca verificar `VITE_SUPABASE_URL` fora de `supabase.js` e `mode.js` |
| **Constantes** | Magic strings e numbers vão para `src/lib/constants.js` |
| **Novos campos no banco** | Adicionar ao mapeamento em `dataService.js` (funções `leadFromDb`, `eventoFromDb`, etc.) |
| **Comentários** | Apenas quando o motivo não for óbvio pelo código — sem JSDoc em funções simples |

### Estrutura de uma factory de API

```js
// src/api/exemploApi.js
import * as db from '../lib/dataService';

export function createExemploApi({ itens, setItens }) {
  async function addItem(dados) {
    const novoItem = { id: crypto.randomUUID(), ...dados };
    setItens(prev => [...prev, novoItem]);        // update otimista
    await db.saveItem(novoItem);                  // sync assíncrono
  }
  return { addItem };
}
```

---

## Evolução do Projeto

### Histórico de versões (resumo)

> Lista completa e detalhada em `doc/CHANGELOG.md`. Abaixo, só os marcos mais relevantes.

| Versão | Data | Mudança principal |
|--------|------|-------------------|
| v5.29 | Set/2026 | Módulo de Landing Pages + Aquisição: LPs genéricas, SDK `rjnet-lp.js`, funil Visitas → Leads → WhatsApp (D-104) |
| — | Set/2026 | Segurança: `peso` das opções do Simulador escondido da leitura pública via RPC `simulador_publico` (D-103) |
| — | Ago–Set/2026 | **Desafio RJNET — Acerte 00:03:33**: cronômetro de ativação, ranking, ganhadores, Tela de TV (D-089, D-090); prêmio do dia e por posição (D-091–D-095, D-102); múltiplas tentativas + máscara do cronômetro (D-098); "Já é cliente" (D-099); correção de tentativa (D-100); leitura/export para comercial (D-101) |
| — | Ago/2026 | Separação por tema/campanha na fila, Demanda por região e export do Simulador (D-096); "Já é cliente RJNET?" no Quiz + grafia RJNET (D-097) |
| v5.26–v5.28 | Jul/2026 | Export CSV dos leads em espera (D-085); accordions em Relatórios (D-086, D-087) |
| v5.24–v5.25 | Jul/2026 | Quiz de Acertos: cadastro antes do quiz, 2 fases no servidor (D-083); duplicidade bloqueada por WhatsApp (D-084) |
| — | Jul/2026 | Quiz de Acertos: 3º tipo de campanha do Simulador + Sorteador (D-080); ajustes mobile (D-081) |
| v5.23 | Jul/2026 | Hardening de segurança pós-auditoria: RLS de leads, RPC destrutiva, rate limit, CSP, auto-cadastro off (D-078) |
| v5.16–v5.22 | Jul/2026 | Simulador: captação gamificada por link/QR com UTM (D-072) → pacote por perfil + combo (D-074) → perguntas por campanha (D-075) → fluxos Oferta/Demanda independentes (D-076) → perfil deduzido por quiz + plano Móvel (D-077) |
| v5.12–v5.15 | Jul/2026 | Horário no MesDetail e correções de sombra/scroll no tema escuro (D-068–D-070); drift de RLS de leads |
| v5.11 | 07/Jul/2026 | Moderação do formulário público: bloqueio de link, captura de IP, rate limit por IP (D-067) |
| v5.10 | 06/Jul/2026 | Leads da Atividade do Mês agrupados por dia num accordion (D-066) |
| v5.9 | 06/Jul/2026 | Navegação do marketing reorganizada (3 diretos + "Mais"); gerador de QR Code standalone retirado, absorvido pelo Form Builder (D-065) |
| v5.8 | 06/Jul/2026 | Campos personalizados: extensão self-service do Form Builder (D-063) |
| v5.7 | 06/Jul/2026 | Form Builder: formulários dinâmicos com QR Code/link próprio (D-062) |
| v5.6 | 06/Jul/2026 | Captação de leads via QR Code — atributo de proveniência, sem sessão (D-061) |
| — | 06/Jul/2026 | Terceiro perfil `comercial` (novo shell `ComercialApp.jsx`, D-059) e cards clicáveis "Evento"/"Mês" no Início com `MesDetail.jsx` (D-060) — sem bump de versão dedicado no `CHANGELOG.md` |
| v5.5 | 02/Jul/2026 | Captação de leads por mês de referência, fora de eventos — dia a dia comercial (D-058) |
| v5.x | Jun–Jul/2026 | Área de Ofertas: imagem+copy prontas por serviço, envio manual via WhatsApp pelo vendedor (D-057) |
| v3.x–v4.x | Jun/2026 | Ciclo de conformidade LGPD: criptografia da fila offline, retenção automática, remoção de CPF do check-in, auditoria de exportação |
| v2.x | Jun/2026 | Redesign visual V3 (versão de UI atual); aba Monitor com diagnóstico de sincronização ao vivo (D-044+) |
| v1.4 | Jun/2026 | Controle Sim/Não para "já é cliente"; exclusão de lead pelo vendedor com confirmação inline |
| v1.2 | Jun/2026 | Multi-seleção de serviços por lead; metas em 3 níveis Bronze/Prata/Ouro |
| v1.1 | Jun/2026 | Centralização do dual mode em `src/lib/mode.js` (etapa 18/18 da refatoração) |
| v1.0 | Jun/2026 | Refatoração completa: `main.jsx` de 2.354 → 35 linhas; 25+ módulos extraídos |
| v0.7 | Jun/2026 | Fila offline para leads + logo RJNet |
| v0.6 | Jun/2026 | Migração de Babel/CDN para Vite; deploy estável no Vercel |
| v0.5 | Jun/2026 | Check-in por CPF, exportação CSV, exclusão de evento, persistência localStorage |
| v0.2 | Jun/2026 | Tema dark, gráficos Chart.js, responsividade mobile, sanitização, testes E2E |

### Refatoração (concluída)

O projeto nasceu como um único `main.jsx` com ~2.354 linhas. Foi decomposto em 18 etapas progressivas sem alterar nenhum comportamento. Cada etapa gerou um commit independente. Resultado: 25+ módulos com responsabilidades únicas, zero importações circulares.

Detalhes completos em `doc/architecture/historico/REFATORAÇÃO.md`.

---

## Próximos Passos Sugeridos

Com a base modular estabilizada, as evoluções mais naturais são:

- **Migração de `servico_interesse` para JSONB**: atualmente é uma coluna TEXT com JSON serializado (D-026). Uma migração de schema tornaria possível filtros SQL nativos por serviço.
- **Testes unitários para as factories de API**: `src/api/*.js` são funções puras que recebem estado e retornam operações — candidatos ideais para testes isolados com mocks de `dataService`.
- **Notificações push**: vendedores em campo poderiam receber alertas de novos eventos ou metas atingidas via Web Push API + Supabase Edge Functions.
- **Relatórios por evento**: exportação de PDF com resumo de leads, materiais e ranking, gerado via Edge Function.
- **Configuração de metas por evento**: atualmente `META_BRONZE/PRATA/OURO` são constantes globais (D-027). Torná-las configuráveis por evento exigiria um campo extra em `eventos` e UI no `EventModal`.

---

## Documentação de Referência

| Arquivo | Conteúdo |
|---------|----------|
| `doc/architecture/SYSTEM_MAP.md` | Arquitetura viva — estrutura, fluxo de dados e restrições |
| `doc/architecture/DECISIONS.md` | Histórico de decisões arquiteturais com justificativas |
| `doc/architecture/SUPABASE.md` | Configuração detalhada do Supabase (schema, ordem de migrações, RLS, usuários de teste) |
| `doc/CHANGELOG.md` | Histórico completo de mudanças por versão |
| `doc/BOAS_PRATICAS.md` | Fluxo de desenvolvimento, git, convenção de commits, onde registrar cada tipo de mudança |
| `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` + `PLANO_DE_ACAO_LGPD.md` | Auditoria e plano de ação de conformidade LGPD |
| `doc/SEGURANCA_MODERACAO.md` | Moderação da captação pública — processo de remoção/denúncia, proteções técnicas do formulário público (D-067) |
| `doc/SEGURANCA_HARDENING.md` | Checklist de hardening (painel + deploy): ordem de migrações, auto-cadastro off, CORS, padrão `revoke` em SECURITY DEFINER (D-078) |
| `doc/aquisicao/AQUISICAO_ANALISE.md` + `INTEGRACAO_LP.md` | Análise do módulo de Landing Pages e guia de integração de uma LP (SDK, UTMs, deploy) (D-104) |
| `doc/simulador/SIMULADOR_IMPLEMENTATION_PLAN.md` | Plano original do Simulador (histórico — estado atual no `SYSTEM_MAP.md`) |
| `doc/performance/TECHNICAL_BACKLOG.md` | Backlog técnico de performance priorizado |
| `doc/ui/UI_VERSIONS.md` | Catálogo de versões de UI/UX — V3 é a versão atual |
| `CLAUDE.md` | Instruções para sessões de IA (stack, scripts, variáveis, banco) |
