# PERFORMANCE_AUDIT.md
# Auditoria Técnica de Performance

> Gerado em: 2026-06-17 (auditoria estática — sem execução de testes)  
> Baseado em: análise do código-fonte, SYSTEM_MAP.md, DECISIONS.md  
> Atualizar após cada execução de testes com evidências reais.

---

## Metodologia

Esta auditoria foi conduzida por análise estática do código-fonte, mapeamento de fluxos de dados e comparação com padrões conhecidos de performance em aplicações React + Supabase. Os problemas identificados são priorizados por impacto potencial e severidade.

---

## PA-001 — `fetchAll()` sem paginação

**Gravidade:** ALTA  
**Impacto:** Alto — afeta todos os usuários marketing a cada evento realtime  
**Prioridade:** 1

**Causa provável:**  
`fetchAll()` em `src/lib/dataService.js:208-213` executa 4 queries sem cláusula `LIMIT`:
```javascript
supabase.from('leads').select('*').eq('deletado', false).order('criado_em')
```
Com centenas ou milhares de leads acumulados em eventos passados, esta query retorna todos os registros não deletados de todos os eventos. O resultado é carregado inteiramente em memória no cliente.

**Evidência:**  
`src/lib/dataService.js:213` — sem `.limit()` ou paginação.  
A tabela `leads` não tem particionamento por evento; todos os leads históricos são retornados.

**Correção sugerida:**  
1. Filtrar leads apenas do evento ativo (ou dos eventos dos últimos N dias) no `fetchAll`
2. Adicionar `.limit(500)` como salvaguarda temporária
3. Implementar paginação cursor-based para o histórico de leads
4. Considerar view materializada no Supabase para o dashboard de marketing

**Estimativa de impacto da correção:**  
Redução de 80–95% no tamanho da resposta em produção com histórico de dados.

---

## PA-002 — `subscribeChanges()` dispara `fetchAll()` completo a cada mutação

**Gravidade:** ALTA  
**Impacto:** Alto — cada lead inserido por qualquer vendedor causa re-carga completa no marketing  
**Prioridade:** 2

**Causa provável:**  
`src/lib/dataService.js:477-492` — o canal realtime escuta `event: '*', schema: 'public'` (qualquer tabela, qualquer operação). O callback executa `onChange` que dispara `fetchAll()` completo após debounce de 400ms.

Com 20 vendedores inserindo leads simultaneamente, o debounce de 400ms coalesce os eventos, mas sequências de bursts podem ainda gerar múltiplos `fetchAll()` consecutivos.

**Evidência:**  
```javascript
.on('postgres_changes', { event: '*', schema: 'public' }, () => {
  clearTimeout(timer);
  timer = setTimeout(onChange, 400); // dispara fetchAll completo
})
```

**Correção sugerida:**  
1. Filtrar o canal por tabela específica e evento específico (`INSERT` em `leads` apenas)
2. Em vez de refetch completo, aplicar o delta recebido via realtime payload (`new: {...}`)
3. Separar o canal de marketing (todas as tabelas) do canal de vendedor (apenas leads do evento)

**Estimativa de impacto da correção:**  
Eliminação de até 80% das requisições de `fetchAll` em eventos de alta frequência de inserção.

---

## PA-003 — Polling de ranking sem backoff adaptativo

**Gravidade:** MÉDIA  
**Impacto:** Médio — 20 vendedores × 1 RPC/min = 20 RPCs/min ao banco  
**Prioridade:** 3

**Causa provável:**  
`src/hooks/useRanking.js` executa `rankingEvento()` a cada 60s via `setInterval` (constante). O cache de 30s mitiga parcialmente, mas a janela entre TTL expirado e próxima atualização garante pelo menos 1 RPC real por minuto por vendedor.

A função RPC `ranking_evento` executa uma agregação (`GROUP BY`, `COUNT`, `ORDER BY`) sobre a tabela `leads` sem particionamento por evento — pode ser custosa com histórico grande.

**Evidência:**  
`src/hooks/useRanking.js` — `setInterval` com intervalo fixo de 60s.  
`src/lib/dataService.js:246-265` — `rankingEvento()` com cache TTL 30s.

**Correção sugerida:**  
1. Considerar realtime subscription para ranking em vez de polling (Supabase pode notificar quando a contagem de leads muda)
2. Aumentar o intervalo de polling para 120s durante inatividade (sem novo lead nos últimos 60s)
3. Garantir índice em `leads(evento_id, deletado, vendedor_id)` no banco

**Estimativa de impacto da correção:**  
Redução de 50% nas RPCs de ranking com polling adaptativo.

---

## PA-004 — React Context re-render global sem seletores

**Gravidade:** MÉDIA  
**Impacto:** Médio — qualquer mutação no `AppContext` re-renderiza todos os componentes consumidores  
**Prioridade:** 4

**Causa provável:**  
`src/context/AppProvider.jsx` expõe todo o estado no mesmo contexto via `useMemo`. Qualquer mudança em qualquer parte do estado (ex: novo lead adicionado) dispara re-render de todos os componentes que chamam `useApp()`.

Em `VendedorApp.jsx` (que renderiza a lista de leads, a barra de meta e o ranking), um novo lead causa pelo menos 3 re-renders distintos.

**Evidência:**  
`src/hooks/useApp.js` — retorna o contexto inteiro, sem seleção de slice.  
`src/context/AppProvider.jsx` — `useMemo` com todas as dependências em um objeto único.

**Correção sugerida:**  
1. Dividir o contexto em sub-contextos por domínio (`EventosContext`, `LeadsContext`, etc.)
2. Ou usar `useMemo` nos componentes consumidores para memorizar valores derivados
3. Para o `VendedorApp`, memoizar a lista de leads do evento ativo separadamente

**Estimativa de impacto da correção:**  
Redução de 40–60% em re-renders desnecessários durante captura intensiva de leads.

---

## PA-005 — `exportLeadsCSV()` bloqueante na main thread

**Gravidade:** MÉDIA  
**Impacto:** Médio — trava a UI durante geração de CSV com muitos leads  
**Prioridade:** 5

**Causa provável:**  
`src/utils/csv.js` — `exportLeadsCSV()` itera sobre todos os leads filtrados, constrói a string CSV concatenando linhas e cria um `Blob` — tudo na thread principal do React, de forma síncrona.

Com 1000+ leads, a concatenação de string e criação de Blob pode bloquear a UI por 100–500ms.

**Evidência:**  
`src/utils/csv.js` — loop síncrono de construção de CSV sem chunking ou streaming.

**Correção sugerida:**  
1. Mover a geração de CSV para um Web Worker (não bloqueia a UI)
2. Ou usar `ReadableStream` para streaming progressivo
3. Como mínimo, adicionar uma flag de loading durante a exportação para indicar ao usuário que o processo está em andamento

**Estimativa de impacto da correção:**  
Eliminação de janking/freeze perceptível para exportações > 500 leads.

---

## PA-006 — PBKDF2 com 100.000 iterações no dispositivo do vendedor

**Gravidade:** BAIXA  
**Impacto:** Baixo — afeta apenas a primeira operação com a fila offline após login  
**Prioridade:** 6

**Causa provável:**  
`src/lib/crypto.js` — derivação de chave AES-GCM via PBKDF2-SHA256 com 100.000 iterações. Operação projetada para ser custosa por design (segurança), mas pode causar janking perceptível em dispositivos Android de entrada (< 2GB RAM, CPU lenta).

A chave é cacheada em memória após a primeira derivação (Map), então o custo é pago apenas uma vez por sessão.

**Evidência:**  
`src/lib/crypto.js` — 100.000 iterações PBKDF2 (`D-034` documenta a decisão).  
A chave é cacheada: custo pago apenas 1x por sessão de login.

**Correção sugerida:**  
1. A operação é assíncrona (`async/await`) e não bloqueia a UI — risco real é baixo
2. Monitorar se usuários relatam lentidão no primeiro acesso à fila offline
3. Se necessário, reduzir para 50.000 iterações (ainda seguro para o modelo de ameaça documentado em D-034)

**Estimativa de impacto da correção:**  
Sem urgência — apenas se houver relatos de usuário.

---

## PA-007 — Sem índice explícito em `leads.evento_id`

**Gravidade:** MÉDIA  
**Impacto:** Médio — queries de ranking e filtros por evento ficam lentas com histórico grande  
**Prioridade:** 3

**Causa provável:**  
`supabase/schema.sql` — verificar se existe índice em `leads(evento_id)`. Sem índice, queries como `SELECT * FROM leads WHERE evento_id = $1` fazem full table scan.

A função RPC `ranking_evento` que faz GROUP BY em leads por evento_id pode ser significativamente mais lenta sem índice adequado.

**Evidência:**  
`supabase/schema.sql` — revisar presença de `CREATE INDEX` em `leads(evento_id)`.  
`dataService.js:213` — `select('*').eq('deletado', false)` e `rankingEvento`.

**Correção sugerida:**  
```sql
CREATE INDEX IF NOT EXISTS idx_leads_evento_id ON leads(evento_id);
CREATE INDEX IF NOT EXISTS idx_leads_deletado ON leads(deletado) WHERE deletado = false;
CREATE INDEX IF NOT EXISTS idx_leads_evento_vendedor ON leads(evento_id, vendedor_id);
```

**Estimativa de impacto da correção:**  
Redução de 10x–100x na latência de queries de ranking com > 1000 leads.

---

## PA-008 — Sem timeout explícito em `fetchAll()` / `withRetry()`

**Gravidade:** BAIXA  
**Impacto:** Baixo — operação pode ficar pendente indefinidamente em conexão instável  
**Prioridade:** 7

**Causa provável:**  
`withRetry()` usa backoff exponencial (800ms, 1600ms, 3200ms) mas não impõe timeout total. Uma conexão que nunca responde (timeout TCP silencioso) pode deixar o `fetchAll()` pendente por múltiplos minutos.

O `AbortController` passado como `signal` para `fetchAll()` resolve parcialmente (cancela no unmount do componente), mas não há timeout automático.

**Evidência:**  
`src/lib/dataService.js:102-115` — `withRetry()` sem timeout total.  
`src/lib/dataService.js:204-242` — `fetchAll()` recebe `signal` mas não tem `AbortSignal.timeout()`.

**Correção sugerida:**  
```javascript
// Adicionar timeout de 10s ao fetchAll
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10_000);
const result = await fetchAll(controller.signal);
clearTimeout(timeoutId);
```

**Estimativa de impacto da correção:**  
Prevenção de estados de loading infinito em conexões instáveis.

---

## Sumário de Priorização

| ID | Título | Gravidade | Prioridade | Impacto em Carga |
|----|--------|-----------|-----------|-----------------|
| PA-001 | fetchAll sem paginação | ALTA | 1 | Crítico em Cenário C/D |
| PA-002 | Realtime dispara fetchAll completo | ALTA | 2 | Crítico em Cenário B/C |
| PA-003 | Polling de ranking sem backoff | MÉDIA | 3 | Relevante em Cenário C |
| PA-007 | Sem índice em leads.evento_id | MÉDIA | 3 | Relevante em Cenário C/D |
| PA-004 | Context re-render global | MÉDIA | 4 | Visível em Cenário C |
| PA-005 | exportLeadsCSV bloqueante | MÉDIA | 5 | Pontual |
| PA-006 | PBKDF2 no dispositivo | BAIXA | 6 | Mínimo |
| PA-008 | Sem timeout em fetchAll | BAIXA | 7 | Marginal |

---

## Nota sobre Gargalos Confirmados vs. Previstos

Os problemas acima foram identificados por **análise estática do código**. As evidências de impacto real (latência, CPU, throughput) serão disponíveis apenas após a execução dos cenários de teste. Atualizar este documento com evidências reais após cada execução, registrando:

- Latência observada por operação (P95, P99)
- VU count em que cada gargalo se manifestou
- Impacto medido vs. estimado
