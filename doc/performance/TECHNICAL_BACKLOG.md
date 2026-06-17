# TECHNICAL_BACKLOG.md
# Backlog Técnico de Performance

> Gerado em: 2026-06-17  
> Baseado em: PERFORMANCE_REVIEW.md, QUICK_WINS.md, análise arquitetural  
> Atualizar após cada sprint de melhorias ou sessão de testes.

---

## Legenda

- **Impacto:** alto / médio / baixo (efeito em performance e usuário)
- **Complexidade:** alta / média / baixa (esforço de implementação)
- **Dependência:** bloqueadores que precisam ser resolvidos primeiro

---

## 🔴 CRÍTICO

### TB-001 — Fix `ranking_evento`: filtrar leads deletados *(QW-001)*

**Descrição:** A função RPC `ranking_evento` executa com SECURITY DEFINER e não aplica o filtro `deletado = false`. Leads excluídos via soft delete são contados no placar, gerando resultados incorretos.

**Impacto:** Bug de integridade — dados incorretos exibidos para vendedores e marketing  
**Complexidade:** Baixa — 1 linha SQL na função  
**Dependências:** Nenhuma  
**Status:** ✅ **Aplicado em produção** em 2026-06-17 — `supabase/fix-ranking-deletado.sql` executada no Supabase Dashboard (Primary Database)

---

## 🟠 ALTO

### TB-002 — Índices compostos em `leads` *(QW-002)*

**Descrição:** Criar índices compostos `(evento_id, deletado)`, partial index `WHERE deletado = false`, e índice de cobertura para `ranking_evento`. Índices simples existem mas não otimizam as queries combinadas mais frequentes.

**Impacto:** Redução de 10x–100x na latência de ranking e fetchAll com > 1.000 leads  
**Complexidade:** Baixa — SQL puro, aditivo  
**Dependências:** TB-001 (pode ser aplicado independentemente)  
**Status:** ✅ **Aplicado em produção** em 2026-06-17 — `supabase/perf-indices-compostos.sql` executada no Supabase Dashboard (11 índices confirmados na tabela `leads`)

---

### TB-003 — Timeout de 15s em `fetchAll` *(QW-003)*

**Descrição:** `carregar()` no `AppProvider` não tem timeout total. Em conexão instável, pode ficar em `isLoading=true` por vários minutos. Implementado via `AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])`.

**Impacto:** Elimina loading infinito — UX crítico para vendedores em campo com conexão instável  
**Complexidade:** Baixa — 2 linhas  
**Dependências:** Nenhuma  
**Status:** ✅ **Implementado** em `src/context/AppProvider.jsx`

---

### TB-004 — Carregamento de leads on-demand por evento *(D-039)*

**Descrição:** `fetchAll` busca TODOS os leads não-deletados de TODOS os eventos históricos sem `LIMIT`. Com crescimento do banco, o payload cresce indefinidamente.

**Impacto:** Alto — cada `fetchAll` (disparado por realtime) transfere dados crescentes  
**Complexidade:** Média  
**Dependências:** Nenhuma  
**Status:** ✅ **Implementado** em 2026-06-17 — leads removidos do `fetchAll`; carregados on-demand via `fetchLeadsEvento` (vendedor/EventDetail) e `fetchLeadsEventos` (export consolidado marketing). `LeadsTab` redesenhada como central de exportação com checkboxes e dois botões de export. Fix secundário: `subscribeChanges` passa a usar `REALTIME_DEBOUNCE_MS` da constante (estava hardcoded em 400ms).

---

### TB-005 — `subscribeChanges()` aplicar delta em vez de refetch completo

**Descrição:** O canal realtime Supabase recebe o payload da linha alterada (`new: {...}`) mas a implementação atual descarta o payload e faz `fetchAll()` completo. Aplicar o delta diretamente no estado React eliminaria a maioria dos `fetchAll`.

**Impacto:** Alto — reduz 80% das requisições de `fetchAll` durante eventos ativos  
**Complexidade:** Alta — requer refatoração do `subscribeChanges()` e do `carregar()` para merge de deltas, com tratamento de conflitos  
**Dependências:** TB-004 (paginação primeiro; depois o delta faz mais sentido)  
**Recomendação:** Sprint dedicada após TB-004

---

## 🟡 MÉDIO

### TB-006 — Pruning de colunas no `fetchAll` *(QW-004)*

**Descrição:** Substituir `select('*')` por seleção explícita de colunas em todas as queries do `fetchAll`. Reduz payload transferido e memória no cliente.

**Impacto:** Médio — 10–30% de redução no payload por `fetchAll`  
**Complexidade:** Baixa — 4 linhas no `dataService.js`  
**Dependências:** Nenhuma  
**Status:** ✅ **Implementado** em `src/lib/dataService.js`

---

### TB-007 — Debounce realtime de 400ms → 1500ms *(QW-005)*

**Descrição:** Aumentar `REALTIME_DEBOUNCE_MS` de 400ms para 1500ms para reduzir fetchAll consecutivos em bursts de inserção.

**Impacto:** Médio — reduz 30–60% dos `fetchAll` em eventos intensos  
**Complexidade:** Mínima — 1 constante  
**Trade-off:** Dashboard do marketing atualiza com até 1.5s de atraso (era 400ms)  
**Status:** ✅ **Implementado** em `src/lib/constants.js`

---

### TB-008 — React Context: sub-contextos por domínio

**Descrição:** `AppProvider` expõe um único contexto com 6 arrays de estado. Qualquer mutação re-renderiza todos os consumidores. Subdividir em `EventosContext`, `LeadsContext`, `MateriaisContext` isolaria os re-renders.

**Impacto:** Médio — reduz 40–60% de re-renders desnecessários em captura intensiva  
**Complexidade:** Alta — refatoração estrutural; todos os componentes que chamam `useApp()` precisam ser atualizados  
**Dependências:** Nenhuma (mas alto risco de regressão)  
**Recomendação:** Adiar até que os testes confirmem que o re-render é de fato um gargalo perceptível. Priorizar TB-004 e TB-005 antes.

---

### TB-009 — `getMateriaisDisponiveis()` memoizado

**Descrição:** `getMateriaisDisponiveis()` em `AppProvider:92-100` executa um `flatMap` encadeado sobre todos os eventos e materiais a cada re-render. Com 50+ eventos e 10+ materiais, a função é O(eventos × materiais).

**Impacto:** Médio — chamada frequente em contexts de alto volume  
**Complexidade:** Baixa — adicionar `useMemo` em volta do cálculo com `[materiais, eventos]` como deps  
**Dependências:** Nenhuma  
**Recomendação:** Quick win após os testes confirmarem o gargalo

---

### TB-010 — Indicador de loading na exportação CSV *(QW-006)*

**Descrição:** `exportLeadsCSV()` é síncrona e sem feedback visual. Usuário pode clicar múltiplas vezes gerando múltiplos downloads.

**Impacto:** Baixo-médio — UX (prevenção de double-click) + clareza do estado  
**Complexidade:** Baixa — adicionar `useState(false)` em `LeadsTab`  
**Dependências:** Nenhuma

---

## 🟢 BAIXO

### TB-011 — Polling de ranking com backoff adaptativo

**Descrição:** Aumentar intervalo de polling de 60s para 120s quando não há atividade (sem novo lead nos últimos 2 minutos). Reduz RPCs em eventos de baixa intensidade.

**Impacto:** Baixo — cache de 30s já mitiga o impacto  
**Complexidade:** Baixa — adicionar contador de inatividade no `useRanking`  
**Dependências:** Nenhuma

---

### TB-012 — Separar canal realtime por entidade

**Descrição:** O canal `rjnet-sync` escuta todas as tabelas (`event: '*', schema: 'public'`). Mudança em `materiais` ou `perfis` dispara o mesmo `fetchAll` que uma mudança em `leads`. Separar em canais por tabela e reagir diferentemente.

**Impacto:** Baixo-médio — evita re-fetch de todas as tabelas quando apenas uma muda  
**Complexidade:** Média — requer refatoração do `subscribeChanges()` e do `carregar()` para recarregar apenas o domínio afetado  
**Dependências:** TB-005 (evolução natural)

---

## Ordem de Execução Recomendada

```
Fase 1 — Imediata (sem testes, zero risco):
  TB-001  fix ranking_evento ✅ aplicado em produção (2026-06-17)
  TB-002  índices compostos ✅ aplicado em produção (2026-06-17)
  TB-003  timeout fetchAll ✅ implementado
  TB-006  pruning colunas ✅ implementado
  TB-007  debounce 1500ms ✅ implementado

Fase 2 — Após Cenário A (validar hipóteses):
  TB-004  paginação/filtro temporal de leads
  TB-009  memoizar getMateriaisDisponiveis

Fase 3 — Após Cenário B/C (com métricas reais):
  TB-005  delta em vez de refetch
  TB-008  sub-contextos React
  TB-010  loading CSV

Fase 4 — Otimizações finas:
  TB-011  backoff adaptativo no ranking
  TB-012  canais realtime por entidade
```

---

## Métricas de Sucesso

| Métrica | Baseline (estimado) | Meta após Fase 2 |
|---------|--------------------|--------------------|
| `fetchAll` avg | ~300-800ms | < 300ms |
| `saveLead` avg | < 400ms | < 300ms |
| `rankingEvento` avg | < 500ms | < 200ms |
| Payload por `fetchAll` | ~X KB | < X×0.8 KB |
| Nº de `fetchAll` por hora (marketing) | N | < N×0.5 |
| Taxa de erro Cenário A | ? | < 0.5% |
