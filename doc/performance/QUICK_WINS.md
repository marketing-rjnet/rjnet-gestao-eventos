# QUICK_WINS.md
# Melhorias de Performance de Baixo Risco

> Gerado em: 2026-06-17  
> Critério de inclusão: não altera regras de negócio, não altera UX, não requer refatoração estrutural, baixo risco de regressão.

---

## Sumário

| ID | Título | Prioridade | Esforço | Risco | Status |
|----|--------|-----------|---------|-------|--------|
| QW-001 | Fix `ranking_evento`: filtrar `deletado = false` | 🔴 Crítico | Baixo | Mínimo | ✅ Implementado |
| QW-002 | Índice composto `leads(evento_id, deletado)` | 🟠 Alto | Baixo | Mínimo | ✅ Implementado |
| QW-003 | Timeout de 15s em `fetchAll` via `AbortSignal` | 🟠 Alto | Baixo | Mínimo | ✅ Implementado |
| QW-004 | Pruning de colunas no `fetchAll` | 🟡 Médio | Baixo | Baixo | ✅ Implementado |
| QW-005 | Aumentar debounce realtime de 400ms para 1500ms | 🟡 Médio | Mínimo | Baixo | ✅ Implementado |
| QW-006 | Indicador de loading na exportação CSV | 🟢 Baixo | Baixo | Mínimo | Backlog |

---

## QW-001 — Fix `ranking_evento`: filtrar `deletado = false`

**Problema:**  
A função SQL `ranking_evento` (SECURITY DEFINER) não aplica RLS e não filtra `deletado = false`. Leads excluídos via soft delete continuam sendo contados no placar — resultado inflado e incorreto.

**Benefício esperado:**  
- Correção de bug de integridade: placar reflete apenas leads válidos
- Redução marginal no custo da query (menos linhas varridas)
- Consistência entre "Meus Leads" (filtrado) e "Placar" (não filtrado → agora filtrado)

**Risco:**  
Mínimo. A mudança apenas remove registros inválidos do resultado. Nenhum componente do frontend depende de leads deletados no ranking.

**Esforço estimado:**  
30 minutos (criar migration SQL, testar query localmente).

**Prioridade:** 🔴 Crítico (bug de integridade de dados)

---

## QW-002 — Índice composto `leads(evento_id, deletado)` e partial index

**Problema:**  
Existem índices simples em `evento_id` e `deletado` separadamente, mas a query mais frequente combina os dois:
```sql
-- fetchAll: WHERE deletado = false ORDER BY criado_em
-- ranking: WHERE evento_id = $1 (sem filtro de deletado)
```
Um índice composto permite ao PostgreSQL satisfazer ambas as condições com um único index scan em vez de dois.

**Benefício esperado:**  
- Redução de latência nas queries de ranking e fetchAll em produção com histórico crescente
- Impacto cresce proporcionalmente ao volume de dados (significativo em > 5.000 leads)

**Risco:**  
Mínimo. Índices são additive — não alteram comportamento, apenas melhoram performance. Idempotente (`CREATE INDEX IF NOT EXISTS`).

**Esforço estimado:**  
20 minutos (criar migration SQL).

**Prioridade:** 🟠 Alto

---

## QW-003 — Timeout de 15s em `fetchAll` via `AbortSignal`

**Problema:**  
`fetchAll()` pode ficar pendente indefinidamente em conexão instável (sem timeout total). O usuário vê spinner de loading por minutos. `withRetry` soma até ~5.6s de delay + tempo de timeout TCP do sistema.

**Benefício esperado:**  
- UI sempre resolve em ≤ 15s (mostra erro de sync ao invés de loading infinito)
- Melhor UX em conexões instáveis (contexto de eventos em campo)

**Risco:**  
Mínimo. `AbortSignal.any()` é uma composição de sinais — o `abortRef` existente continua funcionando. Compatível com Supabase JS `abortSignal()`.

**Esforço estimado:**  
20 minutos (1-2 linhas no AppProvider).

**Prioridade:** 🟠 Alto

---

## QW-004 — Pruning de colunas no `fetchAll`

**Problema:**  
`fetchAll` busca `select('*')` em todas as tabelas. Para `materiais` e `perfis`, nem todos os campos são utilizados pelos componentes. O campo `materiais JSONB` nos eventos pode ser grande e é sempre retornado.

**Benefício esperado:**  
- Redução no payload transferido a cada `fetchAll` (~10–30% dependendo do schema)
- Menos memória usada no cliente para parsing JSON

**Risco:**  
Baixo. Requer auditoria cuidadosa dos campos usados em cada feature para não omitir campo necessário. Mitigado por: os mapeadores `fromDb` já ignoram campos não mapeados.

**Esforço estimado:**  
45 minutos (auditar campos usados + testar).

**Prioridade:** 🟡 Médio

---

## QW-005 — Aumentar debounce realtime de 400ms para 1500ms

**Problema:**  
`REALTIME_DEBOUNCE_MS = 400` em `constants.js` — o canal realtime dispara `fetchAll` após 400ms de silêncio. Em bursts de inserção (vários leads em 2-3s), pode gerar múltiplos `fetchAll` consecutivos se o burst tiver pausas > 400ms.

**Benefício esperado:**  
- Redução de 30–60% no número de `fetchAll` disparados durante captura intensa de leads
- Tradeoff: dashboard do marketing atualiza com até 1.5s de atraso (era 400ms + latência de rede)

**Risco:**  
Baixo. Atraso de 1.5s em vez de 400ms é imperceptível para o caso de uso de dashboard de marketing. Alteração em `constants.js` centralizada.

**Esforço estimado:**  
5 minutos (1 linha em constants.js).

**Prioridade:** 🟡 Médio

---

## QW-006 — Indicador de loading na exportação CSV

**Problema:**  
`exportLeadsCSV()` é síncrona. Com volumes médios (< 2000 leads) o impacto é imperceptível, mas sem feedback visual o usuário pode clicar repetidamente achando que o sistema não respondeu.

**Benefício esperado:**  
- UX: feedback imediato ao usuário de que a exportação está em andamento
- Prevenção de duplo-clique que geraria múltiplos downloads

**Risco:**  
Mínimo. Adicionar estado `exportando` booleano no componente `LeadsTab`.

**Esforço estimado:**  
30 minutos (estado + disabled no botão + loading indicator).

**Prioridade:** 🟢 Baixo — entra no backlog
