# HYPOTHESIS_VALIDATION.md
# Comparação: Teoria (Auditoria Estática) vs. Realidade (Pós-Execução)

> Versão inicial: 2026-06-17  
> Status: **FASE PRÉ-EXECUÇÃO** — colunas de resultado a preencher após Cenário A  
> As hipóteses foram derivadas da análise estática do código e das decisões arquiteturais.

---

## Seção 1 — Hipóteses a Validar no Cenário A

| # | Hipótese | Origem | Confirmada | Notas |
|---|----------|--------|-----------|-------|
| H-001 | `fetchAll` demora > 500ms médio com 80 leads no banco | PA-001 | ⬜ | |
| H-002 | `saveLead` demora < 400ms médio | FC-01 | ⬜ | |
| H-003 | `rankingEvento` usa cache > 80% das chamadas | PA-003 | ⬜ | |
| H-004 | Taxa de erro < 1% em carga normal (6 VUs) | Cenário A | ⬜ | |
| H-005 | Debounce de 1500ms reduz nº de `fetchAll` vs 400ms | QW-005 | ⬜ | |
| H-006 | Timeout de 15s nunca é atingido em conexão estável | QW-003 | ⬜ | |
| H-007 | `ranking_evento` sem `deletado=false` inflava totais | PA-NEW-001 | ⬜ | Verificar antes/depois do QW-001 |

---

## Seção 2 — Hipóteses Já Validadas por Análise Estática

Estas hipóteses foram confirmadas ou refutadas antes de qualquer execução de teste, com base na inspeção direta do código-fonte.

| Hipótese | Status | Evidência |
|----------|--------|----------|
| `idx_leads_evento` não existe (PA-007 original) | ❌ **Refutada** | `schema.sql:52` tem `idx_leads_evento` |
| `ranking_evento` não filtra `deletado=false` | ✅ **Confirmada** | `migracao-auth.sql:157-168` — WHERE sem filtro deletado |
| `withRetry()` não tem timeout total | ✅ **Confirmada** | `dataService.js:102-115` |
| `fetchAll` executa `select('*')` sem pruning | ✅ **Confirmada** | `dataService.js:208-213` (antes do QW-004) |
| `REALTIME_DEBOUNCE_MS` era 400ms | ✅ **Confirmada** | `constants.js:18` (antes do QW-005) |
| Polling de ranking tem debounce ao adicionar lead | ✅ **Confirmada** — PA-003 suavizado | `useRanking.js:24-31` debounce de 3000ms |

---

## Seção 3 — Template de Preenchimento Pós-Cenário A

### H-001: `fetchAll` demora > 500ms médio com 80 leads

**Hipótese:** Com poucos dados (80 leads, Cenário A), o `fetchAll` deve ser rápido (< 200ms), mas com o overhead das 4 queries paralelas pode superar 300ms.

**Resultado medido:**
- avg: [ms]
- P95: [ms]
- Confirmada: [ ] Sim / [ ] Não / [ ] Parcialmente

**Análise:**

---

### H-002: `saveLead` demora < 400ms médio

**Hipótese:** Com 6 VUs e Supabase de homologação, a latência de upsert deve ficar abaixo do threshold de 400ms em média.

**Resultado medido:**
- avg: [ms]
- P95: [ms]
- Confirmada: [ ] Sim / [ ] Não / [ ] Parcialmente

**Análise:**

---

### H-003: `rankingEvento` usa cache > 80% das chamadas

**Hipótese:** Com cache TTL de 30s e polling de 60s, o cache deveria ser hit na maioria das chamadas (a cada lead novo → debounce 3s → cache hit se < 30s passados).

**Resultado medido:**
- Método: comparar total de chamadas k6 ao `/rpc/ranking_evento` com nº de queries reais vistas no Supabase Dashboard
- Hit rate estimado: [%]
- Confirmada: [ ] Sim / [ ] Não / [ ] Parcialmente

**Análise:**

---

### H-004: Taxa de erro < 1% em carga normal

**Resultado medido:**
- Taxa de erro: [%]
- Confirmada: [ ] Sim / [ ] Não

---

### H-005: Debounce 1500ms reduz nº de `fetchAll` vs 400ms

**Hipótese:** Em burst de 5 leads inseridos em 2 segundos, com debounce 400ms haveria 2-3 `fetchAll`. Com 1500ms, apenas 1.

**Nota:** Esta hipótese não pode ser testada diretamente no Cenário A (apenas 5 VUs com intervalo de 7s). Será testada no Cenário B.

**Status:** ⬜ Adiado para Cenário B

---

### H-006: Timeout de 15s nunca é atingido em conexão estável

**Hipótese:** Em ambiente controlado (homologação), o `AbortSignal.timeout(15000)` nunca será ativado.

**Resultado medido:**
- Timeouts observados: [n]
- Confirmada: [ ] Sim / [ ] Não

---

### H-007: `ranking_evento` sem `deletado=false` inflava totais

**Método de verificação pré-fix:**
```sql
-- Criar lead de teste, deletar, verificar se aparece no ranking
INSERT INTO leads (id, evento_id, vendedor_nome, nome, temperatura, deletado)
VALUES ('test-del', '[EVENTO_ID]', 'Teste', 'Lead Deletado', 'morno', true);

SELECT * FROM ranking_evento('[EVENTO_ID]');
-- Pre-fix: deve aparecer "Teste" com total 1 (BUG)
-- Post-fix: não deve aparecer (CORRETO)
```

**Resultado:**
- Pre-fix: Lead deletado aparecia no ranking? [ ] Sim / [ ] Não
- Post-fix: Bug corrigido? [ ] Confirmado

---

## Seção 4 — Tabela Consolidada de Resultados (preencher após Cenário A)

| Hipótese | Confirmada | Parcialmente | Refutada | Observação |
|----------|-----------|-------------|---------|-----------|
| H-001 fetchAll latência | ⬜ | ⬜ | ⬜ | |
| H-002 saveLead < 400ms | ⬜ | ⬜ | ⬜ | |
| H-003 ranking cache hit | ⬜ | ⬜ | ⬜ | |
| H-004 erro < 1% | ⬜ | ⬜ | ⬜ | |
| H-005 debounce (adiado) | — | — | — | Cenário B |
| H-006 timeout nunca ativo | ⬜ | ⬜ | ⬜ | |
| H-007 ranking fix | ⬜ | ⬜ | ⬜ | Pre-fix check |

---

## Seção 5 — Hipóteses Sobre Quick Wins (validar pós-implementação)

| Quick Win | Hipótese de impacto | Validação |
|-----------|--------------------|---------:|
| QW-001 fix ranking | Elimina leads deletados do placar | Verificar query pré/pós |
| QW-002 índices compostos | Reduz latência de ranking em > 50% com 1000+ leads | Cenário C |
| QW-003 timeout 15s | Elimina loading infinito | Cenário A (conexão estável → timeout não dispara) |
| QW-004 column pruning | Reduz payload do `fetchAll` em 10–20% | Medir tamanho da resposta |
| QW-005 debounce 1500ms | Reduz `fetchAll` por realtime em 30–60% em bursts | Cenário B |
