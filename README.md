# RJNet Gestão de Eventos

Sistema de gerenciamento de eventos de campo **e do dia a dia comercial** da RJNet. Permite que o time de marketing (e, no mesmo nível para eventos/ofertas/relatórios, o time comercial) crie e gerencie eventos, estoque, ofertas, formulários públicos de captação e equipe, enquanto vendedores capturam leads — em eventos de campo, na atividade comercial mensal ou via formulário público/QR Code — e acompanham desempenho em tempo real. Tudo em um único SPA React com suporte offline e sincronização automática via Supabase.

---

## Visão Geral

O sistema nasceu para resolver um problema operacional concreto: eventos de campo da RJNet envolviam equipes de vendedores capturando leads em locais com conexão instável, e um time de marketing que precisava acompanhar resultados e controlar materiais em tempo real. Ele evoluiu para cobrir também o **dia a dia do vendedor fora de eventos** (D-058) — o vendedor alterna livremente entre o contexto "Evento" (campo) e "Atividade do Mês" (comercial contínuo, por mês de referência) — e, mais recentemente, um **canal de captação público sem sessão** via Form Builder (D-062, D-063): formulários configuráveis pelo marketing, cada um com seu próprio QR Code/link, que convergem para o mesmo Lead.

**Três perfis de acesso:**

| Perfil | O que faz |
|--------|-----------|
| `marketing` | Cria eventos, gerencia estoque de materiais, mantém as ofertas prontas por serviço, cria formulários de captação (Form Builder), acompanha KPIs, exporta leads (por evento e por mês), distribui leads sem vendedor, gerencia equipe |
| `comercial` | Mesmo nível do marketing em eventos, ofertas e relatórios de leads; **sem** acesso a estoque, equipe ou Monitor (D-059) |
| `vendedor` | Registra leads em campo ou no dia a dia mensal, acompanha ranking, gerencia os próprios leads, envia ofertas prontas por WhatsApp; leads vindos de QR Code/Formulário aparecem só depois de distribuídos pelo marketing/comercial |

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

**Fluxo paralelo — captação pública sem sessão (D-062):** a página `/f/:slug` (`src/public/FormularioPublico.jsx`) não passa por `AppProvider`/`useApp()`. Em modo Supabase ela chama a Edge Function pública `submeter-formulario` diretamente via `fetch()`; em modo local/preview, `src/lib/localPublicSubmit.js` grava direto no `localStorage` (nunca é o caminho de produção). Em ambos os casos o lead cai na mesma tabela `leads`, só que sem `vendedor_id` — fica visível na fila "Leads sem vendedor" do marketing/comercial até ser distribuído manualmente.

**Decisões arquiteturais chave:**

- **Updates otimistas** (D-006): a UI muda na hora; o banco sincroniza em segundo plano. Falhas são indicadas pelo `SyncBadge`.
- **Retry com backoff exponencial** (D-007): 800ms inicial, 3 tentativas — essencial para conexões instáveis em eventos.
- **Fila offline** (D-003): leads capturados sem internet são enfileirados em `localStorage` e sincronizados ao reconectar.
- **RLS como segunda linha de defesa** (D-004): as permissões são validadas no banco, não apenas no frontend. A `anon key` sozinha não acessa nada após a migração de auth.
- **Sanitização obrigatória** (D-005): todo input passa por `sanitizeText()` antes de qualquer escrita.
- **Factory pattern na API** (D-024): todo CRUD passa por `src/api/`, nunca acessa `dataService` diretamente.

---

## Estrutura de Módulos

```
src/
├── main.jsx                    # Ponto de entrada (~35 linhas) — ErrorBoundary + createRoot; desvio mínimo pra /f/:slug ANTES do AppProvider (D-062)
├── index.css                   # Estilos globais (tema dark/light via CSS variables)
│
├── apps/
│   ├── Root.jsx                # Detecta modo (Supabase/local) e dark mode
│   ├── MarketingApp.jsx        # Shell do marketing: 3 tabs diretas + "Mais" agrupado por categoria (D-065)
│   ├── ComercialApp.jsx        # Shell do comercial: Início/Eventos/Ofertas/Relatórios, sem estoque/equipe/monitor (D-059)
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
│   ├── leads/         # LeadsTab (filtros, gráfico, export CSV, fila "Leads sem vendedor"), MesDetail (detalhe do mês por dia, D-060, D-066)
│   ├── checkin/       # CheckinTab (busca de lead por CPF)
│   ├── team/          # EquipeTab (modo local) / EquipeAuthTab (modo Supabase + RBAC) — marketing only
│   ├── monitoring/    # MonitoringTab — diagnóstico ao vivo de sincronização e atividade, marketing only (D-044+)
│   └── formularios/   # FormBuilderTab — Form Builder: catálogo fixo de campos + campos personalizados, gera QR Code/link por formulário, marketing only (D-062, D-063, D-065)
│
├── public/
│   └── FormularioPublico.jsx   # Página pública dinâmica (`/f/:slug`), sem sessão, sem AppContext (D-062)
│
├── components/
│   ├── ui.jsx          # Icon, StatusBadge, TipoBadge, Kpi, ChartView
│   ├── SyncBadge.jsx   # Indicador visual de sincronização
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
│   └── campoPersonalizadoApi.js   # createCampoPersonalizadoApi — CRUD de campos personalizados reutilizáveis (D-063)
│
├── hooks/
│   ├── useApp.js        # Único ponto de consumo do AppContext
│   ├── usePersisted.js  # Sincronização de estado com localStorage/sessionStorage
│   └── useRanking.js    # Polling de ranking com debounce e cleanup automático
│
├── utils/
│   ├── format.js    # fmtDate, fmtDateLong, initials, label maps, mesesDoAno/mesReferenciaLabel (D-058)
│   ├── masks.js     # maskCpf, maskTel, validarCpf, validarTelefone
│   ├── csv.js       # exportLeadsCSV (por evento e por mês)
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
    └── localPublicSubmit.js # Fallback local (sem Supabase) pra página pública do Form Builder — dev/teste only (D-062)
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

---

## Banco de Dados e Integrações

### Tabelas principais

| Tabela | Descrição |
|--------|-----------|
| `eventos` | Eventos (datas, local, tipo, status, materiais JSONB) |
| `leads` | Leads capturados por vendedor, vinculados a **evento OU mês de referência** — mutuamente exclusivos (D-058); atributos de proveniência `origem`/`qr_code_id`/`qr_code_label`/`formulario_id`/`campos_extras`/`origem_ip` (D-061–D-063, D-067); soft delete via `deletado` |
| `materiais` | Estoque de materiais promocionais |
| `perfis` | Perfis de usuários Auth (papel: `marketing` / `comercial` / `vendedor` — D-059) |
| `ofertas` | Oferta ativa por serviço (imagem + copy), `servico` como chave primária — máx. 5 linhas (D-057) |
| `oferta_envios` | Indicador de clique em "Enviar oferta" por lead/serviço — não é confirmação de entrega (D-057) |
| `formularios` | Formulários do Form Builder — campos do catálogo fixo + campos personalizados vinculados, `slug` único (D-062) |
| `campos_personalizados` | Catálogo de campos de texto livre reutilizáveis entre formulários (D-063) |

### Enums de domínio

- **status evento:** `planejado` · `ativo` · `encerrado`
- **tipo evento:** `sinalizacao` · `presenca_comercial` · `ativacao_especial`
- **temperatura lead:** `frio` · `morno` · `quente` · `convertido`
- **serviços:** `internet_residencial` · `internet_empresarial` · `rjnet_movel` · `streamings` · `outro`
- **papel perfil:** `marketing` · `comercial` · `vendedor` (D-059)
- **origem do lead:** `evento` · `mes` · `qrcode` · `formulario` (D-061)

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
2. Executar as demais migrações **na ordem definida em `doc/architecture/SUPABASE.md`** (o projeto já acumula mais de uma dezena — `migracao-auth.sql`, `migracao-ofertas.sql`, `migracao-leads-mensais.sql`, etc.; a ordem importa porque algumas dependem de colunas criadas por outras)
3. Criar primeiro usuário marketing:
   ```sql
   UPDATE perfis SET papel = 'marketing', ativo = true WHERE email = 'seu@email.com';
   ```

### Scripts disponíveis

```bash
npm run dev           # Dev server (localhost:3000)
npm run build         # Build de produção → dist/
npm run preview       # Preview do build

npm test              # E2E Playwright completo
npm run test:unit     # Testes unitários (Node.js)
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
| `doc/performance/TECHNICAL_BACKLOG.md` | Backlog técnico de performance priorizado |
| `doc/ui/UI_VERSIONS.md` | Catálogo de versões de UI/UX — V3 é a versão atual |
| `CLAUDE.md` | Instruções para sessões de IA (stack, scripts, variáveis, banco) |
