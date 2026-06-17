# RJNet Gestão de Eventos

Sistema de gerenciamento de eventos de campo da RJNet. Permite que o time de marketing crie e gerencie eventos, estoque e equipe, enquanto vendedores em campo capturam leads e acompanham desempenho em tempo real — tudo em um único SPA React com suporte offline e sincronização automática via Supabase.

---

## Visão Geral

O sistema resolve um problema operacional concreto: eventos de campo da RJNet envolvem equipes de vendedores capturando leads em locais com conexão instável, e um time de marketing que precisa acompanhar resultados e controlar materiais em tempo real.

**Dois perfis de acesso:**

| Perfil | O que faz |
|--------|-----------|
| `marketing` | Cria eventos, gerencia estoque de materiais, acompanha KPIs, exporta leads, gerencia equipe |
| `vendedor` | Registra leads em campo, acompanha ranking, gerencia os próprios leads |

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
    ↓  subscription realtime (debounce 400ms)
AppProvider re-sincroniza estado
```

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
├── main.jsx                    # Ponto de entrada (~35 linhas) — só ErrorBoundary + createRoot
├── index.css                   # Estilos globais (tema dark/light via CSS variables)
│
├── apps/
│   ├── Root.jsx                # Detecta modo (Supabase/local) e dark mode
│   ├── MarketingApp.jsx        # Shell do marketing: 5 tabs + navegação
│   └── VendedorApp.jsx         # Shell do vendedor: 4 tabs + LeadEditInline
│
├── auth/
│   ├── RootAuth.jsx / RootLegacy.jsx   # Roteadores de auth por modo
│   ├── LoginAuth.jsx / Login.jsx       # Formulários de login
│   ├── NovaSenha.jsx                   # Redefinição de senha por link
│   └── index.js
│
├── features/
│   ├── events/        # Dashboard (KPIs + gráfico), EventosTab (lista), EventDetail (detalhe)
│   ├── inventory/     # EstoqueTab (gestão de materiais por nível)
│   ├── leads/         # LeadsTab (filtros, gráfico, export CSV)
│   ├── checkin/       # CheckinTab (busca de lead por CPF)
│   └── team/          # EquipeTab (modo local) / EquipeAuthTab (modo Supabase + RBAC)
│
├── components/
│   ├── ui.jsx          # Icon, StatusBadge, TipoBadge, Kpi, ChartView
│   ├── SyncBadge.jsx   # Indicador visual de sincronização
│   └── modals/         # EventModal, MaterialModal
│
├── context/
│   ├── AppContext.js   # createContext(null)
│   ├── AppProvider.jsx # Provider: estado + efeitos + factories de API
│   └── index.js
│
├── api/
│   ├── eventoApi.js    # createEventoApi — add, update, remove, patch
│   ├── leadApi.js      # createLeadApi — add, update, remove
│   ├── materialApi.js  # createMaterialApi — add, update, addEvento, removeEvento, toggleRetornado
│   └── vendedorApi.js  # createVendedorApi — add, update, toggle
│
├── hooks/
│   ├── useApp.js        # Único ponto de consumo do AppContext
│   ├── usePersisted.js  # Sincronização de estado com localStorage/sessionStorage
│   └── useRanking.js    # Polling de ranking com debounce e cleanup automático
│
├── utils/
│   ├── format.js    # fmtDate, fmtDateLong, initials, label maps de domínio
│   ├── masks.js     # maskCpf, maskTel, validarCpf, validarTelefone
│   ├── csv.js       # exportLeadsCSV
│   └── mockData.js  # MOCK_* para modo local
│
└── lib/
    ├── supabase.js      # Cliente Supabase + supabaseEnabled (feature flag)
    ├── mode.js          # isSupabaseMode(), getMode(), MODE — fonte única de verdade do modo
    ├── dataService.js   # Queries, auth, realtime, retry, fila offline, camelCase↔snake_case
    ├── security.js      # sanitizeText() — sanitização de inputs
    ├── cache.js         # Cache em memória com TTL (30s para rankings)
    └── constants.js     # Constantes globais: STATUS_EVENTO, NIVEL_ESTOQUE, META_*, limites
```

---

## Regras Importantes do Sistema

Estas regras **não devem ser alteradas sem registrar uma decisão** em `doc/architecture/DECISIONS.md`:

| Regra | Por quê |
|-------|---------|
| Todo CRUD passa por `src/api/`, nunca direto ao `dataService` | Isola domínios, facilita teste e rastreamento |
| `useApp()` é o único ponto de consumo do `AppContext` | Evita acoplamento direto ao contexto em componentes |
| `supabaseEnabled` de `src/lib/supabase.js` + `src/lib/mode.js` é a única fonte de verdade do modo | Centraliza a lógica de detecção; nenhum arquivo acessa `VITE_SUPABASE_URL` diretamente |
| `sanitizeText()` em todos os inputs antes de gravar | Previne XSS armazenado |
| Updates otimistas: UI primeiro, banco depois | Latência percebida aceitável em campo com 3G/4G |
| `servicoInteresse` é sempre `string[]` no frontend | `leadFromDb` normaliza strings legadas; `leadToDb` serializa como JSON string na coluna TEXT existente |
| `META_BRONZE=20`, `META_PRATA=40`, `META_OURO=60` em `constants.js` | `META_DIARIA` é alias de `META_OURO` para backward-compat |
| Sem lógica de negócio em componentes UI | Componentes chamam operações via `useApp()`, sem acesso ao banco |

---

## Banco de Dados e Integrações

### Tabelas principais

| Tabela | Descrição |
|--------|-----------|
| `eventos` | Eventos (datas, local, tipo, status, materiais JSONB) |
| `leads` | Leads capturados por evento e vendedor (com soft delete via `deletado`) |
| `materiais` | Estoque de materiais promocionais |
| `perfis` | Perfis de usuários Auth (papel: `marketing` / `vendedor`) |

### Enums de domínio

- **status evento:** `planejado` · `ativo` · `encerrado`
- **tipo evento:** `sinalizacao` · `presenca_comercial` · `ativacao_especial`
- **temperatura lead:** `frio` · `morno` · `quente` · `convertido`
- **serviços:** `internet_residencial` · `internet_empresarial` · `rjnet_movel` · `streamings` · `outro`

### RLS (Row Level Security)

- `marketing`: acesso total a todas as tabelas
- `vendedor`: leitura de todos os leads; escrita/edição apenas nos próprios leads (`vendedor_id = auth.uid()`)

A `anon key` sozinha não acessa nada após a migração de auth — todas as policies exigem usuário autenticado e ativo.

### Realtime e performance

- Subscriptions Supabase com debounce de 400ms (evita re-renders em cascata)
- Cache em memória com TTL de 30s para rankings (`src/lib/cache.js`)
- `withRetry()`: backoff exponencial 800ms × 3 tentativas
- Fila offline: leads capturados sem conexão são enfileirados em `localStorage` e sincronizados via `flushPendingQueue()` ao reconectar

### Erros de sync

Erros são despachados via `window.dispatchEvent(new CustomEvent('rjnet:sync-error'))` e capturados pelo `SyncBadge` exibido no header de ambos os apps.

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
2. Executar `supabase/migracao-auth.sql` (RLS + Auth)
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

| Versão | Data | Mudança principal |
|--------|------|-------------------|
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

Detalhes completos em `doc/architecture/REFATORAÇÃO.md`.

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
| `doc/architecture/SUPABASE.md` | Configuração detalhada do Supabase (schema, RLS, usuários de teste) |
| `doc/CHANGELOG.md` | Histórico completo de mudanças por versão |
| `CLAUDE.md` | Instruções para sessões de IA (stack, scripts, variáveis, banco) |
