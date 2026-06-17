# LOAD_TEST_REPORT.md
# Relatório de Resultados — Testes de Carga

> **STATUS: TEMPLATE — Aguardando execução autorizada**  
> Preencher este documento após cada sessão de testes.  
> Versão do template: 1.0 | Gerado em: 2026-06-17

---

## Identificação

| Campo | Valor |
|-------|-------|
| Data de execução | [PREENCHER] |
| Versão do sistema | [PREENCHER — git rev-parse HEAD] |
| Ambiente | Supabase Homologação — projeto: [PREENCHER] |
| Executado por | [PREENCHER] |
| Ferramenta | k6 v[PREENCHER] |
| Autorização | [PREENCHER — nome do responsável] |

---

## Cenário Executado

Marcar os cenários executados nesta sessão:

- [ ] Cenário A — Operação Normal (5 VUs, 10 min)
- [ ] Cenário B — Pico Operacional (15 VUs, 18 min)
- [ ] Cenário C — Evento Crítico (20 VUs + flush, 8 min)
- [ ] Cenário D — Estresse (ramp-up até 100 VUs, 12 min)

---

## Métricas por Cenário

### Cenário A — Operação Normal

| Métrica | Resultado | Limite | Status |
|---------|-----------|--------|--------|
| Tempo médio (avg) | [ms] | < 500ms | ⬜ |
| P50 | [ms] | - | ⬜ |
| P95 | [ms] | < 1000ms | ⬜ |
| P99 | [ms] | < 2000ms | ⬜ |
| Throughput | [req/s] | - | ⬜ |
| Taxa de erro | [%] | < 1% | ⬜ |
| Total de leads inseridos | [n] | ~85 esperados | ⬜ |
| Leads duplicados | [n] | 0 | ⬜ |
| `saveLead` avg | [ms] | < 400ms | ⬜ |
| `saveLead` P95 | [ms] | < 800ms | ⬜ |
| `fetchAll` P95 | [ms] | < 1500ms | ⬜ |
| `ranking` P95 | [ms] | < 1000ms | ⬜ |

**Resultado:** ⬜ APROVADO / ⬜ APROVADO COM RESSALVAS / ⬜ REPROVADO

---

### Cenário B — Pico Operacional

| Métrica | Resultado | Limite | Status |
|---------|-----------|--------|--------|
| Tempo médio (avg) | [ms] | < 500ms | ⬜ |
| P50 | [ms] | - | ⬜ |
| P95 | [ms] | < 1000ms | ⬜ |
| P99 | [ms] | < 2000ms | ⬜ |
| Throughput | [req/s] | - | ⬜ |
| Taxa de erro | [%] | < 1% | ⬜ |
| Total de leads inseridos | [n] | ~720 esperados | ⬜ |
| Leads duplicados | [n] | 0 | ⬜ |
| `saveLead` avg | [ms] | < 400ms | ⬜ |
| `saveLead` P95 | [ms] | < 800ms | ⬜ |
| `fetchAll` P95 | [ms] | < 2000ms | ⬜ |
| `exportCSV` P95 | [ms] | < 3000ms | ⬜ |

**Resultado:** ⬜ APROVADO / ⬜ APROVADO COM RESSALVAS / ⬜ REPROVADO

---

### Cenário C — Evento Crítico

| Métrica | Resultado | Limite | Status |
|---------|-----------|--------|--------|
| Tempo médio (avg) | [ms] | < 700ms | ⬜ |
| P95 | [ms] | < 1500ms | ⬜ |
| P99 | [ms] | < 3000ms | ⬜ |
| Taxa de erro | [%] | < 1% | ⬜ |
| Total de leads inseridos | [n] | ~400+ esperados | ⬜ |
| Leads do flush (burst) | [n] | 200 esperados | ⬜ |
| Flush P95 | [ms] | < 2000ms | ⬜ |
| Duplicatas no flush | [n] | 0 | ⬜ |
| Integridade pós-flush | [sim/não] | Sim | ⬜ |

**Resultado:** ⬜ APROVADO / ⬜ APROVADO COM RESSALVAS / ⬜ REPROVADO

---

### Cenário D — Estresse

| VU Count | Latência avg | P95 | Taxa de erro | Observação |
|----------|-------------|-----|-------------|-----------|
| 10 VUs | [ms] | [ms] | [%] | baseline |
| 25 VUs | [ms] | [ms] | [%] | |
| 50 VUs | [ms] | [ms] | [%] | |
| 75 VUs | [ms] | [ms] | [%] | |
| 100 VUs | [ms] | [ms] | [%] | |

**Ponto de degradação identificado:** [VU count onde P95 > 1000ms ou erro > 1%]  
**Ponto de falha identificado:** [VU count onde erro > 5% ou serviço degradou]

---

## Resultado Global

| Cenário | Resultado | Observação |
|---------|-----------|-----------|
| A — Normal | ⬜ APROVADO / ⬜ RESSALVAS / ⬜ REPROVADO | |
| B — Pico | ⬜ APROVADO / ⬜ RESSALVAS / ⬜ REPROVADO | |
| C — Crítico | ⬜ APROVADO / ⬜ RESSALVAS / ⬜ REPROVADO | |
| D — Estresse | ⬜ INFORMATIVO | Ponto de degradação: [VU] |

---

## Evidências

Adicionar após execução:

- [ ] Output JSON do k6 (`results/scenario-*.json`)
- [ ] Screenshot do Supabase Dashboard (Database → Usage)
- [ ] Screenshot do Supabase Dashboard (Realtime → Usage)
- [ ] Query de verificação de integridade de dados

### Query de Verificação de Integridade (executar no Supabase SQL Editor)

```sql
-- Verificar duplicatas (mesmo vendedor_id + evento_id + nome + criado_em próximos)
SELECT evento_id, vendedor_id, nome, COUNT(*) as total
FROM leads
WHERE observacao = 'Lead gerado automaticamente por teste de carga k6'
GROUP BY evento_id, vendedor_id, nome
HAVING COUNT(*) > 1;
-- Resultado esperado: 0 linhas

-- Total de leads inseridos no evento de teste
SELECT COUNT(*) as total_leads
FROM leads
WHERE observacao = 'Lead gerado automaticamente por teste de carga k6';
```

---

## Observações e Análise

[Preencher após execução — comportamentos inesperados, gargalos observados, etc.]

---

## Próximos Passos

Após análise dos resultados, registrar em `doc/performance/PERFORMANCE_AUDIT.md` qualquer gargalo identificado e em `doc/performance/PERFORMANCE_HISTORY.md` o histórico desta execução.
