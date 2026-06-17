# PERFORMANCE_HISTORY.md
# Histórico de Performance

> Objetivo: registrar a evolução da performance do sistema ao longo do tempo.  
> Atualizar após cada execução de testes de carga.

---

## Formato de Registro

```
### [PERF-NNN] — Data | Versão | Ambiente
**Cenário:** [A/B/C/D]
**Resultado:** [APROVADO / RESSALVAS / REPROVADO / INFORMATIVO]
**Métricas:**
  - avg: Xms | P95: Xms | P99: Xms | erro: X%
  - saveLead avg: Xms | fetchAll P95: Xms
**Gargalos observados:** [ou "Nenhum"]
**Melhorias implementadas:** [ou "Nenhuma nesta execução"]
**Impacto observado:** [ou "N/A — baseline"]
```

---

## Histórico

### [PERF-001] — 2026-06-17 | Análise estática | Sem execução

**Cenário:** Auditoria estática (sem execução de testes)  
**Resultado:** INFORMATIVO  
**Métricas:** N/A — sem execução  
**Gargalos previstos por análise de código:**
- `fetchAll()` sem paginação — risco ALTO em volumes > 500 leads (PA-001)
- Canal realtime dispara fetchAll completo a cada mutação (PA-002)
- Polling de ranking fixo em 60s sem adaptação (PA-003)
- Ausência de índice confirmado em `leads(evento_id)` (PA-007)
- React Context sem seletores causa re-renders globais (PA-004)

**Melhorias implementadas nesta fase:** Nenhuma (fase de documentação)  
**Próximos passos:** Obter aprovação para execução do Cenário A em ambiente de homologação

---

### [PERF-002] — 2026-06-17 | Quick Wins QW-001 a QW-005 | Produção

**Cenário:** Implementação de melhorias (sem execução de testes de carga)  
**Resultado:** INFORMATIVO — melhorias aplicadas  
**Métricas:** N/A — aguarda execução do Cenário A  
**Melhorias implementadas:**
- QW-001: `ranking_evento` corrigido para filtrar `deletado = false` — bug de integridade eliminado (D-036)
- QW-002: 3 índices compostos criados em `leads` — 11 índices totais confirmados no Supabase Dashboard
- QW-003: `AbortSignal.timeout(15s)` em `carregar()` — elimina loading infinito (D-036)
- QW-004: Column pruning em `fetchAll` — `select('*')` → colunas explícitas (D-037)
- QW-005: `REALTIME_DEBOUNCE_MS` 400ms → 1500ms — reduz fetchAll em bursts (D-038)

**Impacto esperado:** ranking correto imediatamente; latência de queries reduzida; menos fetchAll por realtime  
**Próximos passos:** Criar ambiente de homologação e executar Cenário A para validar hipóteses H-001 a H-007

---

<!-- Adicionar entradas abaixo conforme os testes forem executados -->

### [PERF-002] — [DATA] | [VERSÃO] | Supabase Homologação

**Cenário:** A — Operação Normal  
**Resultado:** [PREENCHER]  
**Métricas:**
- avg: [ms] | P95: [ms] | P99: [ms] | erro: [%]
- saveLead avg: [ms] | fetchAll P95: [ms] | ranking P95: [ms]

**Gargalos observados:** [PREENCHER]  
**Melhorias implementadas:** [PREENCHER]  
**Impacto observado:** [PREENCHER]

---

### [PERF-003] — [DATA] | [VERSÃO] | Supabase Homologação

**Cenário:** B — Pico Operacional  
**Resultado:** [PREENCHER]  
**Métricas:**
- avg: [ms] | P95: [ms] | P99: [ms] | erro: [%]
- saveLead avg: [ms] | fetchAll P95: [ms]

**Gargalos observados:** [PREENCHER]  
**Melhorias implementadas:** [PREENCHER]  
**Impacto observado:** [PREENCHER]

---

### [PERF-004] — [DATA] | [VERSÃO] | Supabase Homologação

**Cenário:** C — Evento Crítico  
**Resultado:** [PREENCHER]  
**Métricas:**
- avg: [ms] | P95: [ms] | P99: [ms] | erro: [%]
- Flush burst P95: [ms] | Integridade: [OK/FALHA]

**Gargalos observados:** [PREENCHER]  
**Melhorias implementadas:** [PREENCHER]  
**Impacto observado:** [PREENCHER]

---

### [PERF-005] — [DATA] | [VERSÃO] | Supabase Homologação

**Cenário:** D — Estresse  
**Resultado:** INFORMATIVO  
**Métricas:**
- Ponto de degradação (P95 > 1000ms): [VU count]
- Ponto de falha (erro > 1%): [VU count]
- VU máximo testado: [n]
- Limite de WebSocket atingido: [sim/não]

**Gargalos confirmados:** [PREENCHER]  
**Capacidade máxima estimada:** [PREENCHER — ex: "sistema suporta até X VUs com P95 < 1000ms"]

---

## Tendência de Performance

> Atualizar esta tabela a cada execução para visualizar a evolução.

| Execução | Data | Cenário | avg | P95 | Erro% | Observação |
|----------|------|---------|-----|-----|-------|-----------|
| PERF-001 | 2026-06-17 | Estático | N/A | N/A | N/A | Baseline — análise de código |
| PERF-002 | [DATA] | A | [ms] | [ms] | [%] | |
| PERF-003 | [DATA] | B | [ms] | [ms] | [%] | |
| PERF-004 | [DATA] | C | [ms] | [ms] | [%] | |
| PERF-005 | [DATA] | D | [ms] | [ms] | [%] | Limite: [VU] |
