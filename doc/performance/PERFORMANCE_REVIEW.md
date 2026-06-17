# PERFORMANCE_REVIEW.md
# Revisão dos Achados de Auditoria

> Gerado em: 2026-06-17  
> Método: análise estática + inspeção do código-fonte real (schema.sql, migracao-auth.sql, protecao-dados.sql, dataService.js, AppProvider.jsx, useRanking.js, csv.js, constants.js)  
> Status: **Fase de validação — sem execução de testes**

---

## Sumário de Revisão

| ID | Título | Status | Confiança | Ação |
|----|--------|--------|----------|------|
| PA-001 | `fetchAll()` sem paginação | ✅ Confirmado | Alta | Quick Win parcial |
| PA-002 | Realtime dispara `fetchAll` completo | ✅ Confirmado | Alta | Backlog técnico |
| PA-003 | Polling de ranking sem backoff | ⚠️ Parcialmente confirmado | Média | Melhoria futura |
| PA-004 | React Context re-render global | ✅ Confirmado | Alta | Backlog técnico |
| PA-005 | `exportLeadsCSV` bloqueante | ⚠️ Parcialmente confirmado | Média | Baixa prioridade |
| PA-006 | PBKDF2 com 100k iterações | 🔵 Baixa prioridade | Alta | Monitorar |
| PA-007 | Sem índice em `leads.evento_id` | ❌ Falso positivo parcial | Alta | Ver detalhe |
| PA-008 | Sem timeout em `fetchAll` | ✅ Confirmado | Alta | Quick Win |
| **PA-NEW-001** | `ranking_evento` conta leads deletados | 🔴 Novo achado crítico | Alta | Quick Win urgente |

---

## PA-001 — `fetchAll()` sem paginação

### Evidências

**Confirmado no código-fonte** (`src/lib/dataService.js:213`):
```javascript
supabase.from('leads').select('*').eq('deletado', false).order('criado_em')
```
Sem `.limit()`. Retorna **todos** os leads não deletados de **todos** os eventos históricos.

Contexto adicional descoberto na revisão:
- `AppProvider.jsx:44` — `subscribeChanges(carregar)` — o callback é a função `carregar()` completa
- `carregar()` chama `fetchAll()` integralmente a cada evento realtime
- A query `leads` não filtra por `evento_id`, então todo o histórico acumulado é retornado

### Impacto

Com N eventos acumulados e X leads por evento:
- 10 eventos × 80 leads = 800 registros por `fetchAll` → transferência ~80KB
- 50 eventos × 80 leads = 4.000 registros → ~400KB por carga (afeta todos os usuários marketing a cada ~400ms de atividade realtime)
- Volume cresce indefinidamente com o tempo

O campo `materiais JSONB` nos eventos também retorna dados volumosos de todos os eventos históricos.

### Confiança da análise

**Alta** — confirmado diretamente no código, sem ambiguidade.

### Recomendação

Implementar como Quick Win parcial: adicionar `.limit(1000)` na query de leads como salvaguarda imediata. Solução completa (filtro por evento ativo + paginação) requer análise de impacto na feature de histórico de leads no tab Leads do marketing — entra no backlog técnico.

---

## PA-002 — `subscribeChanges()` dispara `fetchAll()` completo a cada mutação

### Evidências

**Confirmado em dois arquivos**:

`src/lib/dataService.js:477-491`:
```javascript
.on('postgres_changes', { event: '*', schema: 'public' }, () => {
  clearTimeout(timer);
  timer = setTimeout(onChange, 400); // onChange = carregar()
})
```

`src/context/AppProvider.jsx:44`:
```javascript
const unsubRealtime = subscribeChanges(carregar);
```

O callback `carregar()` executa `fetchAll()` completo (4 queries paralelas). O debounce de 400ms coalece mutações próximas, mas não resolve bursts separados por > 400ms.

Adicionalmente: o canal escuta `event: '*'` e `schema: 'public'` — qualquer mutação em qualquer tabela (incluindo `perfis`, `materiais`, `eventos`, `leads`) aciona o refetch completo.

### Impacto

Em um evento com 20 vendedores inserindo 1 lead/5s:
- Sem debounce: 240 `fetchAll()` por hora no marketing
- Com debounce 400ms: se leads chegam em bursts de 2s, ainda pode gerar ~120 `fetchAll()` por hora
- Cada `fetchAll()` executa 4 queries REST em paralelo = 480 requisições/hora ao banco só do canal realtime

### Confiança da análise

**Alta** — fluxo confirmado de ponta a ponta no código.

### Recomendação

Solução requer refatoração do `subscribeChanges()` para aplicar delta em vez de refetch — mudança estrutural, não é Quick Win. Entra no backlog como item de alta prioridade. Mitigação intermediária: aumentar o debounce de 400ms para 2000ms (constante `REALTIME_DEBOUNCE_MS` em `constants.js`) — trade-off: atraso maior na atualização do dashboard.

---

## PA-003 — Polling de ranking sem backoff adaptativo

### Evidências

**Parcialmente confirmado** com detalhes adicionais:

`src/lib/constants.js:21-22`:
```javascript
export const RANKING_DEBOUNCE_MS = 3000;
export const RANKING_POLL_MS = 60_000;
```

`src/hooks/useRanking.js`:
- Há **dois mecanismos de atualização** além do polling fixo:
  1. Atualização imediata ao mudar `eventoId` (useEffect linha 20-22)
  2. Debounce de 3000ms quando `leadsCount` muda (useEffect linha 24-31)
  3. Polling fixo de 60s (useEffect linha 33-36)

O debounce de 3s ao adicionar lead é um mecanismo reativo que reduz a dependência do polling. Na prática, quando o vendedor está ativo capturando leads, o ranking é atualizado pelo debounce (cada lead novo → atualização após 3s), não pelo polling de 60s.

O polling de 60s serve principalmente quando o vendedor está **inativo** (esperando resultado dos colegas).

O cache de 30s em `rankingEvento()` garante que no máximo 2 RPCs reais por minuto ocorrem por VU mesmo sem cache hit (1 pelo polling, 1 pelo debounce).

### Impacto

Revisão reduz a gravidade: com 20 vendedores, o polling gera no máximo 20 RPCs/min, mas o cache de 30s reduz isso para ~0-5 RPCs/min em prática (a maioria serão cache hits se vendedores fizerem leads em intervalos < 30s).

**Risco real identificado (novo):** A função `ranking_evento` não filtra `deletado = false` — ver PA-NEW-001.

### Confiança da análise

**Média** — o mecanismo de debounce reduz o impacto real, mas o comportamento em carga não foi medido.

### Recomendação

Baixa prioridade para alteração do polling. Priorizar o fix do `ranking_evento` (PA-NEW-001) que é um bug de integridade com impacto na função RPC.

---

## PA-004 — React Context re-render global sem seletores

### Evidências

**Confirmado** (`src/context/AppProvider.jsx:80-103`):
```javascript
const value = useMemo(() => ({
  materiais, eventos, leads, vendedores,
  isLoading, syncStatus,
  // ... todas as funções
}), [materiais, eventos, leads, vendedores, isLoading, syncStatus]);
```

Um único contexto com 6 arrays/estados. Qualquer mudança em qualquer um dos 6 — mesmo que um lead de outro evento seja adicionado — re-renderiza **todos** os componentes que chamam `useApp()`.

No `VendedorApp.jsx`, `useApp()` é chamado no componente raiz, passando estado para sub-componentes via props — o padrão correto. Mas `getLeadsEvento()` e `getEventosAtivos()` são funções criadas dentro do `useMemo` que executam filtros a cada re-render.

### Impacto

Em captura intensiva (20 leads/min por vendedor):
- Cada lead novo → setState em `leads` → todos os consumidores de `useApp()` re-renderizam
- `getMateriaisDisponiveis()` (linha 92-100 do AppProvider) executa um flatMap encadeado sobre todos os eventos + materiais a cada re-render — potencialmente custoso com muitos eventos

### Confiança da análise

**Alta** — padrão confirmado no código. Impacto perceptível depende do número de componentes consumidores e da frequência de mutações.

### Recomendação

Não é um Quick Win — requer subdivisão do contexto ou uso de seletores memoizados por consumidor. Entra no backlog como melhoria de médio prazo.

---

## PA-005 — `exportLeadsCSV()` bloqueante na main thread

### Evidências

**Parcialmente confirmado** com severidade reduzida (`src/utils/csv.js`):
```javascript
const linhas = dados.map((l) => [...]);
const csv = [cabecalho, ...linhas].map((r) => ...).join("\n");
const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
```

A operação é síncrona. No entanto:
- `dados.map()` é O(n) com constante baixa (operações simples de mapeamento)
- Para 1000 leads × 11 campos, a iteração é < 5ms em qualquer dispositivo moderno
- O bloqueio real seria perceptível apenas com > 5.000–10.000 leads em dispositivos lentos

Contexto adicional: a exportação é uma **ação manual** do usuário (click em botão), não uma operação recorrente ou gatilhada por outros eventos.

### Impacto

Impacto real menor que o estimado na auditoria. O freeze perceptível só ocorreria em volumes de leads muito além do previsto para eventos típicos (< 2.000 leads/evento).

### Confiança da análise

**Média** — confirmado que é síncrono, mas impacto real depende do volume que o sistema atingirá em produção.

### Recomendação

Baixa prioridade. Adicionar indicador de `loading` durante exportação é um Quick Win de UX simples, mas o bloqueio de thread não é urgente.

---

## PA-006 — PBKDF2 com 100.000 iterações no dispositivo do vendedor

### Evidências

**Confirmado, mas severidade muito baixa** (`src/lib/crypto.js`):
- Operação é `async` — não bloqueia a UI (usa `crypto.subtle.deriveBits`)
- Chave é cacheada em memória após primeira derivação (Map keyed por userId)
- Executada apenas 1x por sessão de login
- Documentada e justificada em D-034

### Confiança da análise

**Alta** — baixa prioridade confirmada.

### Recomendação

Sem ação necessária. Monitorar apenas se houver relatos de usuários com dispositivos muito antigos (Android < 6 ou similar).

---

## PA-007 — Sem índice em `leads.evento_id`

### Evidências

**FALSO POSITIVO PARCIAL** — índice já existe:

`supabase/schema.sql:52-53`:
```sql
create index if not exists idx_leads_evento on public.leads (evento_id);
create index if not exists idx_leads_criado_em on public.leads (criado_em);
```

`supabase/migracao-auth.sql:72`:
```sql
create index if not exists idx_leads_vendedor on public.leads (vendedor_id);
```

`supabase/protecao-dados.sql:17`:
```sql
create index if not exists idx_leads_deletado on public.leads (deletado);
```

**Total de índices existentes em `leads`:** 4 índices simples.

**Lacuna real identificada:** não existe índice **composto** em `(evento_id, deletado)` para otimizar a query mais comum:
```sql
-- fetchAll:
SELECT * FROM leads WHERE deletado = false ORDER BY criado_em
-- ranking_evento:
SELECT vendedor_nome, COUNT(*) FROM leads WHERE evento_id = $1 GROUP BY vendedor_nome
```

O índice em `deletado` sozinho não será utilizado pelo planner PostgreSQL quando `deletado=false` é a condição mais seletiva (mas que retorna ~99% das linhas). Um índice parcial ou composto seria mais eficiente.

### Confiança da análise

**Alta** — os índices simples existem; a lacuna de índice composto é nova descoberta.

### Recomendação

Quick Win: criar índice composto `(evento_id, deletado)` e partial index `WHERE deletado = false`. Ambos são additive, não requerem recriação dos índices existentes.

---

## PA-008 — Sem timeout explícito em `fetchAll()` / `withRetry()`

### Evidências

**Confirmado** (`src/lib/dataService.js:102-115`):
```javascript
async function withRetry(fn, { maxAttempts = 3, baseDelayMs = 800 } = {}) {
  // ...sem timeout total
}
```

`src/context/AppProvider.jsx:22-38`:
```javascript
const controller = new AbortController();
abortRef.current = controller;
// ...
const dados = await fetchAll(controller.signal);
```

O `AbortController` é criado localmente e usado, mas não tem timeout automático — só é abortado em unmount ou quando uma nova chamada a `carregar()` ocorre (linha 24: `abortRef.current?.abort()`).

**Comportamento em conexão instável:**
- `withRetry` tenta até 3x com 800ms, 1600ms, 3200ms de delay
- Tempo máximo de espera: ~5.600ms de delay + 3x o timeout TCP do sistema (pode chegar a minutos em conexão instável)
- `fetchAll` pode ficar em estado `isLoading=true` por período longo

### Confiança da análise

**Alta** — confirmado no código.

### Recomendação

Quick Win: usar `AbortSignal.timeout()` no `carregar()` do `AppProvider`. Disponível em todos os browsers modernos (Chrome 103+, Firefox 100+, Safari 15.4+). Compatível com o `abortRef` existente via `AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])`.

---

## PA-NEW-001 — `ranking_evento` RPC conta leads com `deletado = true`

### Evidências

**Novo achado identificado durante revisão** (`supabase/migracao-auth.sql:157-168`):
```sql
create or replace function public.ranking_evento(eid text)
returns table (vendedor_nome text, total bigint)
language sql stable
security definer set search_path = public
as $$
  select l.vendedor_nome, count(*)::bigint as total
  from public.leads l
  where l.evento_id = eid
    and public.papel_atual() is not null
  group by l.vendedor_nome
  order by total desc
$$;
```

**Problema:** a função é `SECURITY DEFINER` — executa com privilégios do owner da função, **bypassando o RLS**. As políticas RLS da tabela `leads` (que filtram `deletado = false`) **não se aplicam** dentro desta função.

A cláusula `WHERE` da função não inclui `AND l.deletado = false`.

**Consequência:** leads excluídos por vendedores (soft delete via `db.removeLead()`) ainda são contados no ranking. Um vendedor que exclui um lead errado e recadastra corretamente terá 2 leads contados no placar em vez de 1.

### Impacto

- **Integridade de dados:** placar mostra resultados inflados para vendedores que excluíram e recadastraram leads
- **Performance:** a função scana leads deletados desnecessariamente (impacto menor, mas cumulativo com histórico)
- **Confiança do usuário:** vendedores percebem divergência entre "Meus Leads" (sem deletados) e o placar (com deletados)

### Confiança da análise

**Alta** — comportamento confirmado pelo código da função SQL e pela política de soft delete.

### Recomendação

**Quick Win urgente:** adicionar `AND l.deletado = false` à função `ranking_evento`. Mudança de 1 linha em SQL, sem impacto em contratos de API ou lógica do frontend. Criar migration `supabase/fix-ranking-deletado.sql`.
