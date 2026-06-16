# ARCHITECTURE_FIX_PLAN.md

> **Escopo:** Correções arquiteturais pós-auditoria da refatoração progressiva (18 etapas concluídas).
> **Data:** 2026-06-16
> **Baseline:** `SYSTEM_MAP.md` + `DECISIONS.md` (D-001 a D-029)

---

## 1. Visão Geral do Estado Atual

A refatoração de 18 etapas decompôs com sucesso o monólito original (`src/main.jsx`, ~2.354 linhas) em módulos coesos por domínio. O padrão factory function (`src/api/`), a camada única de dados (`src/lib/dataService.js`), o contexto centralizado (`src/context/AppProvider.jsx`) e a separação entre shells de aplicação (`src/apps/`) estão operacionais e corretos em ~90% do sistema.

**Desvios remanescentes identificados na auditoria:**

| # | Desvio | Severidade | Decisão violada |
|---|--------|-----------|-----------------|
| P-1 | `LeadEditInline` não sanitiza inputs no fluxo de edição | **Alta** | D-005 |
| P-2 | `EquipeAuthTab` importa `auth` diretamente de `dataService` | **Alta** | D-024, SYSTEM_MAP §7 e §9 |
| P-3 | `obterRanking` com lógica de negócio dentro do `AppProvider` | **Média** | D-024 |
| P-4 | `VendedorApp` gera o ID do lead antes de chamar `addLead` | **Média** | D-024 |
| P-5 | `genId` é utilitário puro definido no `AppProvider` | **Baixa** | D-010 (utilitários em `src/utils/`) |
| P-6 | `SYSTEM_MAP.md` afirma que `src/lib/mode.js` não existe | **Baixa** | D-025 (documento de arquitetura viva) |

---

## 2. Problemas Arquiteturais Identificados

---

### Problema 1 — Ausência de sanitização no fluxo de edição de lead

**Descrição:**
O formulário de edição inline de lead (`LeadEditInline` em `src/apps/VendedorApp.jsx`) coleta campos de texto do usuário e os passa diretamente para `updateLead` sem chamada a `sanitizeText()`. O fluxo de _criação_ do mesmo componente sanitiza corretamente; o fluxo de _edição_ não.

**Causa raiz:**
`LeadEditInline` chama `onSave(e)` com o estado bruto do formulário. `salvarEdicao` (no escopo de `VendedorApp`) repassa os dados imediatamente para `updateLead` do contexto. A sanitização que existe no `submit` da criação não foi replicada no handler de edição.

**Impacto no sistema:**
Qualquer tag HTML ou payload injetado via edição de lead é persistido sem sanitização em `db.saveLead` → Supabase. Viola D-005 e cria vetor de XSS armazenado que o auto-escape do JSX não elimina em todos os contextos de uso dos dados (exportação CSV, notificações futuras, consumo via API).

**Caminho real do dado:**
```
LeadEditInline.onSave(dados_brutos)
  → VendedorApp.salvarEdicao(id, dados_brutos)
    → updateLead(id, dados_brutos)          ← sem sanitizeText()
      → leadApi.updateLead → db.saveLead    ← dado bruto gravado no Supabase
```

**Módulos afetados:**
- `src/apps/VendedorApp.jsx` (função `salvarEdicao`)

---

### Problema 2 — `EquipeAuthTab` acessa `dataService` diretamente

**Descrição:**
`src/features/team/EquipeAuthTab.jsx` importa `auth` de `../../lib/dataService` e chama `auth.criarUsuario`, `auth.atualizarPerfil` e `auth.excluirUsuario` diretamente no corpo do componente, sem intermediação de nenhuma factory de API ou exposição via `AppContext`.

**Causa raiz:**
As operações de gestão de usuários em modo Supabase (criar, editar papel, ativar/desativar, excluir) não foram contempladas pela Etapa 17 (D-024 — API factories). `createVendedorApi` cobre apenas o modo local (`db.saveVendedor`). Não existe fábrica equivalente para operações de `auth`.

**Impacto no sistema:**
- `EquipeAuthTab` é o único componente de feature que controla seu próprio estado de loading/erro sem passar pelo `syncStatus` do contexto.
- Lógica de negócio inline: geração de email por slug (`toSlug`), validação de senha, tratamento de `alert()` em caso de erro.
- Qualquer mudança na interface de `auth` em `dataService` impacta diretamente o componente de UI.
- Viola explicitamente SYSTEM_MAP §7: *"Nenhum componente acessa o banco diretamente"* e §9: *"API factory pattern é obrigatório"*.

**Módulos afetados:**
- `src/features/team/EquipeAuthTab.jsx`
- `src/lib/dataService.js` (acoplado diretamente a um componente de feature)

---

### Problema 3 — Lógica de negócio de ranking dentro do `AppProvider`

**Descrição:**
A função `obterRanking` (linhas 66–78 do `AppProvider.jsx`) agrega leads por `vendedorNome` para calcular o ranking em modo local. Essa agregação é lógica de domínio de leads, não responsabilidade de orquestração de estado.

**Causa raiz:**
`obterRanking` precisava de acesso ao array `leads` em closure e foi escrita diretamente no `AppProvider` em vez de ser delegada para um módulo de API. Não há factory de API que receba `leads` e compute agregações.

**Impacto no sistema:**
- O `AppProvider` acumula responsabilidade dupla: orquestração de estado/efeitos + lógica de negócio de domínio.
- Torna-se mais difícil testar `obterRanking` isoladamente.
- Cria precedente para que outras agregações sejam adicionadas diretamente no Provider.

**Módulos afetados:**
- `src/context/AppProvider.jsx`
- `src/api/leadApi.js` (ausência de função de agregação)

---

### Problema 4 — `VendedorApp` gera ID de lead antes da factory

**Descrição:**
Em `VendedorApp.jsx` (função `submit`, linha 165), o componente gera um ID de lead (`const novoId = "l" + Date.now() + ...`) e o passa para `addLead`. A factory `createLeadApi` também tenta gerar um ID via `genId('l')`, mas como o spread `{ id: genId('l'), ...l }` é sobrescrito por `l.id`, o ID do componente vence silenciosamente.

**Causa raiz:**
A necessidade de exibir um toast com undo após a criação exige conhecer o ID antes de chamar `addLead` (para poder chamar `removeLead(toast.id)` em `handleUndo`). O componente resolveu isso gerando o ID localmente em vez de receber o ID de volta da factory.

**Impacto no sistema:**
- A geração de ID é responsabilidade da camada de API (D-024), mas o componente de UI a exerce silenciosamente.
- A factory `createLeadApi` executa `genId` desnecessariamente a cada criação, gerando um ID descartado.
- Cria divergência entre o contrato documentado (factory gera ID) e o comportamento real (componente gera ID).

**Módulos afetados:**
- `src/apps/VendedorApp.jsx` (função `submit`)
- `src/api/leadApi.js` (função `addLead`)

---

### Problema 5 — `genId` é utilitário puro definido no `AppProvider`

**Descrição:**
A função `genId(prefix)` (linha 64 do `AppProvider.jsx`) gera IDs temporários para o modo local. É uma função pura sem dependência de estado ou efeito, usada por todas as factories de API via injeção de parâmetro.

**Causa raiz:**
Foi definida no `AppProvider` durante a Etapa 16/17 para estar disponível antes das factories, e injetada via parâmetro em cada `create*Api({ ..., genId })`. Não foi movida para `src/utils/` porque o risco parecia baixo.

**Impacto no sistema:**
- Viola D-010: utilitários puros pertencem a `src/utils/`.
- Qualquer módulo que precisar de `genId` no futuro importará de `AppProvider` (se tentar importar diretamente) ou via injeção, criando dependência indireta do Provider.
- Impacto baixo enquanto o uso for apenas via injeção, mas o precedente é errado.

**Módulos afetados:**
- `src/context/AppProvider.jsx` (definição)
- `src/api/*.js` (uso via parâmetro injetado)

---

### Problema 6 — `SYSTEM_MAP.md` desatualizado: afirma que `mode.js` não existe

**Descrição:**
A Seção 2 do `SYSTEM_MAP.md` contém o bloco:

> **`src/lib/mode.js` não existe.** A detecção de modo é feita por `supabaseEnabled` exportado de `src/lib/supabase.js`.

Na realidade, `src/lib/mode.js` existe desde a conclusão da Etapa 18, exporta `isSupabaseMode()` e `getMode()`, e é importado por `AppProvider`, `dataService`, `Root`, `MarketingApp` e `SyncBadge`.

**Causa raiz:**
O `SYSTEM_MAP.md` foi atualizado em D-025 (16/06/2026) mas a nota incorreta sobre `mode.js` não foi removida após a conclusão da Etapa 18.

**Impacto no sistema:**
- `SYSTEM_MAP.md` é a fonte de verdade arquitetural carregada automaticamente via `@import` em toda sessão Claude.
- Uma sessão nova lendo o mapa vai acreditar que não existe abstração de modo e tentará usar `supabaseEnabled` diretamente em vez de `isSupabaseMode()`, violando a indireção que `mode.js` foi criado para fornecer.
- Compromete a confiabilidade do documento D-025 como "arquitetura viva".

**Módulos afetados:**
- `docs/SYSTEM_MAP.md`

---

## 3. Plano de Correção

---

### Correção 1 — Sanitizar inputs no fluxo de edição de lead

**O que será alterado:**
Adicionar chamadas a `sanitizeText()` na função `salvarEdicao` de `VendedorApp.jsx`, espelhando o padrão do `submit` (criação).

**Onde será alterado:**
- `src/apps/VendedorApp.jsx` — função `salvarEdicao` (única mudança necessária)

**Implementação:**
```js
// ANTES
const salvarEdicao = (id, dados) => {
  updateLead(id, dados);
  setEditandoId(null);
};

// DEPOIS
const salvarEdicao = (id, dados) => {
  updateLead(id, {
    ...dados,
    nome:       sanitizeText(dados.nome, 120),
    cpf:        sanitizeText(dados.cpf || "", 14),
    endereco:   sanitizeText(dados.endereco || "", 200),
    observacao: sanitizeText(dados.observacao || "", 500),
  });
  setEditandoId(null);
};
```

`sanitizeText` já está importada em `VendedorApp.jsx` (linha 8). Nenhuma importação adicional necessária.

**Responsabilidade antes vs depois:**

| | Antes | Depois |
|---|---|---|
| Sanitização na criação | VendedorApp.submit ✓ | VendedorApp.submit ✓ |
| Sanitização na edição | Ausente ✗ | VendedorApp.salvarEdicao ✓ |

**Dependências impactadas:** Nenhuma — mudança local sem impacto em outros módulos.

---

### Correção 2 — Extrair operações de auth de equipe para API factory

**O que será alterado:**
Criar `src/api/equipeApi.js` com factory `createEquipeApi` cobrindo as operações de gestão de usuários em modo Supabase. Expor as funções via `AppContext`. Refatorar `EquipeAuthTab` para usar `useApp()` em vez de importar `auth` diretamente.

**Onde será alterado:**
- `src/api/equipeApi.js` (novo arquivo)
- `src/context/AppProvider.jsx` (instanciar factory + expor via `value`)
- `src/features/team/EquipeAuthTab.jsx` (remover import de `dataService`; usar `useApp()`)

**Nova estrutura após mudança:**
```
src/api/equipeApi.js   ← nova factory
  createEquipeApi({ recarregar })
    criarUsuario(dados)        → auth.criarUsuario + recarregar()
    atualizarPerfil(id, patch) → auth.atualizarPerfil + recarregar()
    excluirUsuario(id)         → auth.excluirUsuario + recarregar()
```

`createEquipeApi` recebe `recarregar` como parâmetro (já exposto pelo Provider via `carregar`). Internamente importa `auth` de `dataService` — o mesmo padrão das factories existentes que importam `db`.

**Responsabilidade antes vs depois:**

| | Antes | Depois |
|---|---|---|
| Quem chama `auth.*` | `EquipeAuthTab` (UI) | `equipeApi` (factory de API) |
| Quem gerencia loading | `EquipeAuthTab` (estado local) | `EquipeAuthTab` (estado local — mínimo aceitável para fluxos assíncronos de form) |
| Import de `dataService` em feature | Presente ✗ | Removido ✓ |
| Lógica `toSlug` | `EquipeAuthTab` | Move para `equipeApi` ou `utils/format.js` |

**Conteúdo de `equipeApi.js`:**
```js
import { auth } from '../lib/dataService';
import { sanitizeText } from '../lib/security';

export function createEquipeApi({ recarregar }) {
  const toSlug = (nome) =>
    nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, ".").replace(/[^a-z0-9.]/g, "");

  return {
    criarUsuario: async ({ nome, email, senha, papel }) => {
      const nomeSanitizado = sanitizeText(nome, 80);
      const emailFinal = email.trim() || `${toSlug(nomeSanitizado)}@vendedor.rjnet.com.br`;
      await auth.criarUsuario({ nome: nomeSanitizado, email: emailFinal, senha, papel });
      await recarregar();
    },
    atualizarPerfil: async (userId, patch) => {
      const campos = {
        ...patch,
        ...(patch.nome !== undefined ? { nome: sanitizeText(patch.nome, 80) } : {}),
      };
      await auth.atualizarPerfil(userId, campos);
      await recarregar();
    },
    excluirUsuario: async (userId) => {
      await auth.excluirUsuario(userId);
      await recarregar();
    },
  };
}
```

**Exposição no AppProvider:**
```js
import { createEquipeApi } from '../api/equipeApi';
// ...
const { criarUsuario, atualizarPerfil, excluirUsuario } =
  createEquipeApi({ recarregar: carregar });

const value = useMemo(() => ({
  // ... existente ...
  criarUsuario, atualizarPerfil, excluirUsuario,
}), [...deps]);
```

**Refatoração de `EquipeAuthTab`:**
```js
// ANTES
import { auth } from '../../lib/dataService';
// ...
await auth.criarUsuario(...); await recarregar();

// DEPOIS
const { criarUsuario, atualizarPerfil, excluirUsuario } = useApp();
// ...
await criarUsuario({ nome, email, senha, papel });
```

**Dependências impactadas:**
- `AppProvider.jsx` (adiciona import e instância de `createEquipeApi`)
- `EquipeAuthTab.jsx` (remove import de `dataService`; usa `useApp()`)

---

### Correção 3 — Mover `obterRanking` para `leadApi`

**O que será alterado:**
Extrair `obterRanking` do `AppProvider` para `createLeadApi`, que já recebe `leads` como parâmetro.

**Onde será alterado:**
- `src/api/leadApi.js` (adicionar `obterRanking`)
- `src/context/AppProvider.jsx` (remover definição; desestruturar de `createLeadApi`)

**Nova estrutura:**
```js
// src/api/leadApi.js
import { db, invalidarRanking, rankingEvento } from '../lib/dataService';
import { isSupabaseMode } from '../lib/mode';

export function createLeadApi({ leads, setLeads, genId }) {
  return {
    addLead: ...,
    updateLead: ...,
    removeLead: ...,
    obterRanking: async (eventoId) => {
      if (isSupabaseMode()) {
        const r = await rankingEvento(eventoId);
        if (r) return r;
      }
      const mapa = {};
      leads.filter((l) => l.eventoId === eventoId)
           .forEach((l) => { mapa[l.vendedorNome] = (mapa[l.vendedorNome] || 0) + 1; });
      return Object.entries(mapa)
        .map(([nome, total]) => ({ nome, total }))
        .sort((a, b) => b.total - a.total);
    },
  };
}
```

**Responsabilidade antes vs depois:**

| | Antes | Depois |
|---|---|---|
| Quem computa ranking | `AppProvider` | `createLeadApi` (domínio correto) |
| Imports de `rankingEvento` | `AppProvider` | `leadApi` |
| Imports de `isSupabaseMode` | `AppProvider` (para ranking) | `leadApi` |

**AppProvider após mudança:**
```js
const { addLead, updateLead, removeLead, obterRanking } =
  createLeadApi({ leads, setLeads, genId });
// ...
const value = useMemo(() => ({ ..., obterRanking }), [...]);
```

**Dependências impactadas:**
- `src/api/leadApi.js` (adiciona `rankingEvento`, `isSupabaseMode`)
- `src/context/AppProvider.jsx` (remove `obterRanking`, `rankingEvento`, reduz imports)

---

### Correção 4 — Formalizar geração de ID pelo retorno da factory

**O que será alterado:**
`createLeadApi.addLead` deve retornar o objeto criado (com o ID gerado). `VendedorApp.submit` usa o ID retornado em vez de pré-gerar o seu próprio.

**Onde será alterado:**
- `src/api/leadApi.js` — `addLead` retorna o objeto criado
- `src/context/AppProvider.jsx` — expor o retorno de `addLead` via contexto (ou manter sem mudança se `addLead` retornar diretamente)
- `src/apps/VendedorApp.jsx` — `submit` usa o ID retornado por `addLead`

**Nova estrutura de `addLead`:**
```js
addLead: (l) => {
  const novo = { id: genId('l'), criadoEm: new Date().toISOString(), ...l };
  setLeads((p) => [...p, novo]);
  db.saveLead(novo);
  if (novo.eventoId) invalidarRanking(novo.eventoId);
  return novo; // ← retorna o objeto com o ID canônico
},
```

**`VendedorApp.submit` após mudança:**
```js
// ANTES
const novoId = "l" + Date.now() + Math.random().toString(36).slice(2, 7);
addLead({ id: novoId, ...f, nome, ... });
showToast(novoId, nome);

// DEPOIS
const novo = addLead({ ...f, nome, ... }); // sem id pré-gerado
showToast(novo.id, nome);
```

**Responsabilidade antes vs depois:**

| | Antes | Depois |
|---|---|---|
| Quem gera ID do lead | `VendedorApp` (override silencioso) | `createLeadApi` (correto) |
| Execução de `genId` | Duas vezes (componente + factory) | Uma vez (factory) |

**Dependências impactadas:**
- `src/apps/VendedorApp.jsx` (remove pré-geração de ID; usa retorno de `addLead`)
- `src/api/leadApi.js` (adiciona `return novo`)

---

### Correção 5 — Mover `genId` para `src/utils/`

**O que será alterado:**
Extrair `genId` do `AppProvider` para `src/utils/ids.js` (novo arquivo). Importar diretamente nas factories de API.

**Onde será alterado:**
- `src/utils/ids.js` (novo arquivo)
- `src/api/eventoApi.js`, `leadApi.js`, `materialApi.js`, `vendedorApi.js` (importar de `utils/ids`)
- `src/context/AppProvider.jsx` (remover definição e passagem de `genId` como parâmetro)

**Conteúdo de `src/utils/ids.js`:**
```js
export const genId = (prefix) =>
  prefix + Date.now() + Math.random().toString(36).slice(2, 7);
```

**Impacto nas factories — antes vs depois:**
```js
// ANTES (leadApi.js)
export function createLeadApi({ leads, setLeads, genId }) {

// DEPOIS (leadApi.js)
import { genId } from '../utils/ids';
export function createLeadApi({ leads, setLeads }) {
```

**AppProvider após mudança:**
```js
// Antes
const genId = (prefix) => prefix + Date.now() + Math.random().toString(36).slice(2, 7);
const { ... } = createLeadApi({ leads, setLeads, genId });

// Depois
const { ... } = createLeadApi({ leads, setLeads }); // genId não injetado
```

**Dependências impactadas:**
- Todos os `src/api/*.js` (troca injeção de parâmetro por import direto)
- `src/context/AppProvider.jsx` (remove definição de `genId` e a passagem como parâmetro)

---

### Correção 6 — Atualizar `SYSTEM_MAP.md` para refletir `mode.js`

**O que será alterado:**
Substituir o bloco incorreto na Seção 2 do `SYSTEM_MAP.md` pela descrição real do módulo `src/lib/mode.js`.

**Onde será alterado:**
- `docs/SYSTEM_MAP.md` — Seção 2 (Detecção de Modo)

**Bloco atual (incorreto):**
```
> **`src/lib/mode.js` não existe.** A detecção de modo é feita por `supabaseEnabled`
> exportado de `src/lib/supabase.js`.
```

**Bloco correto:**
```
`src/lib/mode.js` exporta `isSupabaseMode()` e `getMode()` como abstração sobre
`supabaseEnabled` de `supabase.js`. Todos os módulos que precisam detectar o
modo ativo devem importar `isSupabaseMode` de `./mode`, nunca `supabaseEnabled`
diretamente de `./supabase`.
```

**Dependências impactadas:** Nenhuma no código. Impacto exclusivamente na qualidade do onboarding de novas sessões.

---

## 4. Impacto Arquitetural das Mudanças

### O que melhora estruturalmente

- **Camada de UI completamente desacoplada de `dataService`**: após C-2, nenhum componente de feature (`src/features/`) ou app (`src/apps/`) importa diretamente de `src/lib/`. O único caminho de comunicação com a camada de dados passa por `useApp()` → `AppContext` → factories.
- **Padrão D-005 sem exceções**: sanitização passa a estar presente em todos os caminhos de escrita (criação e edição de leads), eliminando a assimetria.
- **`AppProvider` como orquestrador puro**: após C-3, o Provider não contém mais lógica de domínio — apenas inicializa estado, dispara efeitos de infraestrutura e instancia factories.
- **Responsabilidade de ID consolidada na camada de API**: após C-4, o componente de UI não conhece o formato ou geração de IDs. A factory é a única fonte de IDs.
- **`genId` testável e reutilizável**: como função exportada de `src/utils/ids.js`, pode ser importada diretamente em qualquer módulo futuro sem depender de injeção via `AppProvider`.

### O que deixa de ser possível (positivamente)

- Um componente de feature não consegue mais contornar o contexto e chamar `auth.*` diretamente — o caminho passa obrigatoriamente por `useApp()`.
- Um componente não consegue mais controlar a geração de IDs de entidades — a factory é a única responsável.
- Lógica de agregação de leads não pode mais ser adicionada ao `AppProvider` sem que fique evidentemente fora do lugar.

### O que fica mais isolado ou desacoplado

- `EquipeAuthTab` passa de ~165 linhas com acoplamento profundo a `dataService` para um componente de UI que apenas despacha intenções via contexto.
- `createLeadApi` passa a ser o módulo centralizador de todo o domínio de leads: CRUD + aggregação de ranking.
- `dataService.auth` fica acessível apenas para `src/api/equipeApi.js` e `src/auth/*.jsx` — os dois contextos legítimos.

---

## 5. Nova Arquitetura Resultante (pós-correção)

### Fluxo de leads (criação)

```
VendedorApp.submit()
  → sanitizeText() nos campos de texto
  → addLead(dados_limpos)          ← via useApp()
    → createLeadApi.addLead()      ← gera ID, persiste estado, chama db, invalida cache
      → db.saveLead()              ← dataService → Supabase
  → showToast(novo.id, nome)       ← usa ID retornado pela factory
```

### Fluxo de leads (edição)

```
LeadEditInline.onSave(dados_brutos)
  → VendedorApp.salvarEdicao()
    → sanitizeText() nos campos de texto  ← corrigido (C-1)
    → updateLead(id, dados_limpos)        ← via useApp()
      → createLeadApi.updateLead()        ← persiste estado, chama db, invalida cache
        → db.saveLead()                   ← dataService → Supabase
```

### Fluxo de equipe (modo Supabase)

```
EquipeAuthTab.submit()
  → criarUsuario({ nome, email, senha, papel })   ← via useApp()
    → createEquipeApi.criarUsuario()               ← sanitiza, gera email, chama auth
      → auth.criarUsuario()                        ← dataService → Edge Function → Supabase
      → recarregar()                               ← sincroniza estado
```

### Fluxo de ranking

```
useRanking(eventoId, leadsCount)
  → obterRanking(eventoId)          ← via useApp()
    → createLeadApi.obterRanking()  ← modo Supabase: rankingEvento(); modo local: agrega leads[]
      → cache TTL 30s               ← dataService
```

### Comunicação entre camadas (após todas as correções)

```
┌─────────────────────────────────────────────┐
│  src/apps/ + src/features/  (UI)            │
│  useApp() como único ponto de entrada       │
└──────────────────┬──────────────────────────┘
                   │ useApp() → AppContext
┌──────────────────▼──────────────────────────┐
│  src/context/AppProvider  (orquestração)    │
│  + src/api/*.js           (domínio)         │
└──────────────────┬──────────────────────────┘
                   │ db.* / auth.* / fetchAll()
┌──────────────────▼──────────────────────────┐
│  src/lib/dataService.js   (dados)           │
│  src/lib/mode.js          (detecção modo)   │
│  src/lib/cache.js         (cache)           │
└──────────────────┬──────────────────────────┘
                   │
          Supabase / localStorage
```

### Anti-patterns eliminados

| Anti-pattern | Presente antes | Presente depois |
|---|---|---|
| Componente de feature importa `dataService` | `EquipeAuthTab` | Nenhum |
| Input de edição sem sanitização | `LeadEditInline` | Nenhum |
| Lógica de negócio no Provider | `obterRanking` | Nenhum |
| Componente controla geração de ID | `VendedorApp.submit` | Nenhum |
| Utilitário puro em Provider | `genId` | Nenhum |
| Documento de arquitetura com info incorreta | `SYSTEM_MAP.md` | Nenhum |

---

## 6. Ordem de Execução Recomendada

As correções são ordenadas por: (1) risco de segurança, (2) violação de contrato arquitetural, (3) complexidade de execução.

---

### Etapa 1 — C-1: Sanitizar edição de lead ⚡

**Por que primeiro:** É a única correção com risco de segurança concreto (D-005, XSS armazenado). Uma linha de mudança. Zero risco de regressão.

**Arquivo:** `src/apps/VendedorApp.jsx` — função `salvarEdicao`

**Esforço:** < 10 min

---

### Etapa 2 — C-6: Corrigir `SYSTEM_MAP.md` ⚡

**Por que segundo:** Qualquer sessão nova lendo o mapa antes das correções vai tomar decisões erradas sobre `mode.js`. Corrigir antes de qualquer outra mudança estrutural garante que o documento reflita o estado real durante as etapas seguintes.

**Arquivo:** `docs/SYSTEM_MAP.md` — Seção 2

**Esforço:** < 5 min

---

### Etapa 3 — C-5: Extrair `genId` para `src/utils/ids.js`

**Por que terceiro:** C-5 é pré-requisito para C-3 e C-4 ficarem limpos, pois as factories deixam de receber `genId` como parâmetro. Deve ser feito antes das outras mudanças em API factories para não misturar dois tipos de mudança no mesmo arquivo.

**Arquivos:** `src/utils/ids.js` (novo), `src/api/*.js` (4 arquivos), `src/context/AppProvider.jsx`

**Esforço:** 30–45 min

---

### Etapa 4 — C-3: Mover `obterRanking` para `leadApi`

**Por que quarto:** Depende de C-5 (factories já não recebem `genId`). Mudança contida a dois arquivos. Melhora a coesão do `AppProvider` imediatamente.

**Arquivos:** `src/api/leadApi.js`, `src/context/AppProvider.jsx`

**Esforço:** 30 min

---

### Etapa 5 — C-4: Formalizar retorno de `addLead`

**Por que quinto:** Depende de C-3 (leadApi já foi mexida). Mudança em dois arquivos. Resolve a inconsistência de geração de ID sem alterar comportamento visível.

**Arquivos:** `src/api/leadApi.js`, `src/apps/VendedorApp.jsx`

**Esforço:** 20 min

---

### Etapa 6 — C-2: Criar `equipeApi` e refatorar `EquipeAuthTab`

**Por que último:** É a correção de maior escopo. Cria novo arquivo, altera o Provider e refatora o componente mais complexo. Executar por último garante que o padrão de factories (C-3, C-4, C-5 já concluídos) está estabilizado antes de aplicá-lo ao novo domínio.

**Arquivos:** `src/api/equipeApi.js` (novo), `src/context/AppProvider.jsx`, `src/features/team/EquipeAuthTab.jsx`

**Esforço:** 60–90 min

---

### Resumo sequencial

| # | Correção | Risco | Arquivos | Esforço estimado |
|---|----------|-------|----------|-----------------|
| 1 | C-1 Sanitizar edição de lead | Segurança | 1 | < 10 min |
| 2 | C-6 Corrigir SYSTEM_MAP.md | Documentação | 1 | < 5 min |
| 3 | C-5 Extrair `genId` para `utils/` | Refatoração | 6 | 30–45 min |
| 4 | C-3 Mover `obterRanking` para `leadApi` | Refatoração | 2 | 30 min |
| 5 | C-4 Retorno canônico de `addLead` | Refatoração | 2 | 20 min |
| 6 | C-2 Criar `equipeApi` + refatorar `EquipeAuthTab` | Arquitetural | 3 | 60–90 min |

**Total estimado:** ~3h de execução, divisível em 2 sessões (Etapas 1–2 na primeira; 3–6 na segunda).

---

> **Nota de rastreabilidade:** Cada correção deve gerar uma entrada em `docs/DECISIONS.md` (D-030+) e uma atualização em `docs/CHANGELOG.md`. Após C-2, `docs/SYSTEM_MAP.md` deve ser revisado integralmente para verificar outros pontos desatualizados antes de iniciar as etapas seguintes.
