# LOAD_TEST_PLAN.md
# Plano de Testes de Carga e Performance

> Gerado em: 2026-06-17  
> Versão: 1.0  
> Status: **AGUARDANDO APROVAÇÃO — NÃO EXECUTAR**

---

## 1. Objetivo

Validar que o sistema RJNet Gestão de Eventos mantém:
- Tempo de resposta aceitável (< 500ms médio, < 1000ms P95) sob carga típica e de pico
- Integridade total dos dados durante operações concorrentes
- Resiliência a falhas de rede (fila offline, retry com backoff)
- Estabilidade do canal realtime (WebSocket) sob múltiplas conexões simultâneas
- Comportamento previsível no limite operacional (Cenário D)

---

## 2. Escopo

### Incluso no escopo

- Captura de leads simultânea por múltiplos vendedores
- Carga inicial do aplicativo (`fetchAll`)
- Polling de ranking via RPC (`rankingEvento`)
- Sincronização realtime (canal WebSocket → `fetchAll` no marketing)
- Flush de fila offline simultâneo (burst de upserts)
- Exportação CSV de leads
- Autenticação e recuperação de sessão

### Excluído do escopo

- Testes de segurança (cobertos por `tests/security.test.js`)
- Testes de unidade de lógica de negócio (cobertos por `tests/lead.unit.test.js`)
- Testes E2E de UI (cobertos por Playwright)
- Edge Function de gestão de usuários (baixo volume, não é caminho crítico)
- Ambiente de produção (proibido sem autorização explícita)

---

## 3. Ambiente

### Ambiente Alvo

```
Tipo:             Supabase de homologação (projeto separado do produção)
URL:              [configurar antes da execução]
Banco:            PostgreSQL 15 (gerenciado Supabase)
Auth:             Supabase Auth com JWT
Realtime:         Canal 'rjnet-sync'
Frontend:         npm run dev (localhost:3000) — ou build de homologação
Ferramenta:       k6 (versão >= 0.50.0)
```

### Configuração de Ambiente

```bash
# Variáveis necessárias antes de executar qualquer teste
export TEST_SUPABASE_URL="https://[projeto-homolog].supabase.co"
export TEST_SUPABASE_ANON_KEY="[anon-key-homolog]"
export TEST_SUPABASE_SERVICE_KEY="[service-key-homolog]"  # apenas para setup/cleanup
export TEST_MARKETING_USER="test.marketing@rjnet.invalid"
export TEST_MARKETING_PASS="TestMarketing@2026"
```

### Migrações Necessárias no Ambiente de Homologação

Aplicar na ordem:
1. `supabase/schema.sql`
2. `supabase/migracao-auth.sql`
3. `supabase/protecao-dados.sql`
4. `supabase/migracao-consentimento.sql`
5. `supabase/migracao-audit-exportacoes.sql`
6. `supabase/migracao-soft-delete-audit.sql`
7. `supabase/migracao-readd-cpf.sql`

---

## 4. Premissas

1. Os dados utilizados nos testes são **100% fictícios** — CPFs inválidos (ex: `000.000.000-00`), telefones inválidos (ex: `(00) 00000-0000`), e-mails `@test.invalid`
2. O ambiente de homologação é **isolado do ambiente de produção** (projeto Supabase distinto)
3. Os testes são executados com **aprovação prévia** do responsável técnico
4. Um **script de cleanup** remove todos os dados de teste após cada execução
5. O monitoramento do Supabase Dashboard é feito **em tempo real** durante os cenários C e D
6. Os testes de estresse (Cenário D) são executados **fora do horário de uso** do ambiente de homologação
7. O `rankingEvento` RPC (`ranking_evento`) deve estar criado no banco de homologação (incluído em `migracao-auth.sql`)
8. Todos os usuários de teste (`vendedor_N@test.invalid`) devem ser criados e ativados antes dos testes

---

## 5. Fluxos Testados

Os fluxos são derivados exclusivamente dos identificados no ARCHITECTURE_TEST_SUMMARY.md:

| Fluxo | Código | Cenários |
|-------|--------|---------|
| Captura de lead | FC-01 | A, B, C, D |
| Carga inicial (`fetchAll`) | FC-02 | A, B, C, D |
| Polling de ranking | FC-03 | A, B, C |
| Sincronização realtime | FC-04 | B, C |
| Exportação CSV | FC-05 | B |
| Autenticação | FC-06 | A, B, C, D |
| Flush fila offline | FC-07 | C |

---

## 6. Cenários

### Cenário A — Operação Normal

**Objetivo:** Validar comportamento sob carga cotidiana mínima.

**Configuração k6:**
```javascript
export const options = {
  vus: 6,         // 5 vendedores + 1 marketing
  duration: '10m',
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};
```

**Fluxo do vendedor virtual (5 VUs):**
1. `POST /auth/v1/token` — login como `vendedor_N@test.invalid`
2. `GET /rest/v1/eventos?status=eq.ativo` — busca evento ativo
3. Loop por 10 minutos:
   - A cada 7s: `POST /rest/v1/leads` — inserir lead fictício
   - A cada 60s: `POST /rest/v1/rpc/ranking_evento` — consultar ranking
   - Esperar resposta de cada operação

**Fluxo do marketing virtual (1 VU):**
1. `POST /auth/v1/token` — login como `marketing@test.invalid`
2. `GET /rest/v1/materiais`, `GET /rest/v1/eventos`, `GET /rest/v1/leads`, `GET /rest/v1/perfis` — carga inicial
3. Conectar WebSocket ao canal realtime (simulado via polling a cada 5s nos testes)
4. A cada 5s: verificar leads (simular atualização de dashboard)

**Dados esperados ao final:**
- ~85 leads inseridos (5 vendors × 7s interval × 10min = ~43 leads, ~86 com 2 ciclos)
- Taxa de erro < 1%
- P95 < 1000ms

---

### Cenário B — Pico Operacional

**Objetivo:** Validar comportamento no evento típico de maior volume.

**Configuração k6:**
```javascript
export const options = {
  stages: [
    { duration: '1m', target: 17 }, // ramp-up: 15 vendedores + 2 marketing
    { duration: '15m', target: 17 }, // operação sustentada
    { duration: '2m', target: 0 },   // ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{type:saveLead}': ['p(95)<800'],
  },
};
```

**Fluxo do vendedor virtual (15 VUs):**
1. Login
2. Loop por 15 minutos:
   - A cada 5s: `POST /rest/v1/leads` com lead fictício e `consentimento_coletado: true`
   - A cada 60s: `POST /rest/v1/rpc/ranking_evento`
   - Verificar resposta HTTP 201/200

**Fluxo do marketing virtual (2 VUs):**
1. Login
2. `fetchAll` inicial (4 queries paralelas)
3. A cada 10s: `GET /rest/v1/leads?deletado=eq.false` — simular atualização
4. Uma vez aos 8 minutos: exportação CSV (GET de todos os leads do evento)

**Métricas específicas monitoradas:**
- Latência do `saveLead` (tagged `type:saveLead`)
- Latência do `fetchAll` (tagged `type:fetchAll`)
- Latência do `rankingEvento` (tagged `type:ranking`)
- Taxa de erros por endpoint

---

### Cenário C — Evento Crítico

**Objetivo:** Simular o pior caso operacional previsto: evento máximo com flush simultâneo de fila offline.

**Fases do cenário:**

**Fase 1 — Warm-up (0:00–1:00):** 23 usuários autenticam e fazem `fetchAll` inicial

**Fase 2 — Operação normal (1:00–6:00):** 20 vendedores capturando leads, 3 marketing atualizando dashboard

**Fase 3 — Simulação offline (6:00–6:30):** 10 dos 20 vendedores "ficam offline" (pausa nas requisições)

**Fase 4 — Flush simultâneo (6:30–7:00):** Os 10 vendedores "reconectam" e fazem flush de 20 leads cada (200 upserts em burst de 30s)

**Fase 5 — Estabilização (7:00–8:00):** Todos os 20 retomam operação normal; validar integridade

**Configuração k6:**
```javascript
export const options = {
  scenarios: {
    vendedores_ativos: {
      executor: 'constant-vus',
      vus: 10, // vendedores que permanecem online
      duration: '8m',
    },
    vendedores_offline_flush: {
      executor: 'shared-iterations',
      vus: 10,
      iterations: 200, // 10 VUs × 20 leads cada
      startTime: '6m30s', // começa o flush após pausa simulada
    },
    marketing: {
      executor: 'constant-vus',
      vus: 3,
      duration: '8m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{type:flush}': ['p(95)<2000'],
  },
};
```

**Validações pós-cenário:**
- Query de integridade: verificar que total de leads = leads inseridos (sem duplicatas, sem perdas)
- Verificar tabela `audit_exportacoes` (PA-06) se exportação ocorreu
- Verificar `audit_log` (PA-13, se migração aplicada)

---

### Cenário D — Estresse

**Objetivo:** Identificar o ponto de degradação e o limite operacional do sistema.

**Configuração k6:**
```javascript
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // baseline
    { duration: '2m', target: 25 },   // aumento gradual
    { duration: '2m', target: 50 },   // carga pesada
    { duration: '2m', target: 75 },   // estresse
    { duration: '2m', target: 100 },  // limite esperado
    { duration: '2m', target: 0 },    // ramp-down
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'], // mais permissivo — estresse intencional
  },
};
```

**Fluxo simplificado (todos os VUs):**
1. Login (uma vez)
2. Loop:
   - A cada 3s: `POST /rest/v1/leads` (operação mais crítica)
   - A cada 30s: `GET /rest/v1/rpc/ranking_evento`

**O que observar:**
- Em qual VU count a latência P95 ultrapassa 1000ms
- Em qual VU count a taxa de erro ultrapassa 1%
- Se o Supabase retorna `429 Too Many Requests`
- Se as conexões WebSocket começam a falhar (limite de 200)
- Comportamento do `withRetry()` sob falha (800ms → 1600ms → 3200ms)

**Critério de parada automática:**
```javascript
// Parar o teste se taxa de erro > 20% por mais de 30s
thresholds: { http_req_failed: ['rate<0.20'] }
// ou se P99 > 5000ms
```

---

## 7. Critérios de Aprovação

| Critério | Limite | Cenários A/B | Cenário C | Cenário D |
|----------|--------|-------------|-----------|-----------|
| Taxa de erro | < 1% | ✅ Obrigatório | ✅ Obrigatório | ⚠️ < 5% (estresse) |
| Tempo médio | < 500ms | ✅ Obrigatório | ✅ Obrigatório | - |
| P95 | < 1000ms | ✅ Obrigatório | < 1500ms | - |
| P99 | < 2000ms | ✅ Obrigatório | < 3000ms | - |
| Perda de dados | 0 | ✅ Obrigatório | ✅ Obrigatório | ✅ Obrigatório |
| Duplicatas | 0 | ✅ Obrigatório | ✅ Obrigatório | ✅ Obrigatório |
| Ranking íntegro | Sim | ✅ Obrigatório | ✅ Obrigatório | - |
| Cache invalidado após mutação | Sim | ✅ Obrigatório | ✅ Obrigatório | - |

### Resultado Possível

- **APROVADO:** Todos os critérios obrigatórios atendidos
- **APROVADO COM RESSALVAS:** Critérios de latência excedidos mas sem perda de dados
- **REPROVADO:** Qualquer perda ou duplicação de dados, ou taxa de erro > 1% em A/B/C

---

## 8. Métricas Monitoradas

### Via k6

| Métrica | Descrição |
|---------|-----------|
| `http_req_duration` | Latência de cada request REST |
| `http_req_failed` | Taxa de falha HTTP (4xx/5xx) |
| `http_reqs` | Throughput (requests/segundo) |
| `iterations` | Iterações completadas por VU |
| `vus` | VUs ativos ao longo do tempo |
| `http_req_duration{type:saveLead}` | Latência específica de inserção de lead |
| `http_req_duration{type:fetchAll}` | Latência específica de carga inicial |
| `http_req_duration{type:ranking}` | Latência específica de ranking RPC |

### Via Supabase Dashboard (manual durante C e D)

| Métrica | Localização | Alerta |
|---------|------------|--------|
| Database connections | Database → Usage | > 80% do limite |
| Realtime connections | Realtime → Usage | > 150 de 200 |
| API requests/minuto | API → Usage | Pico anômalo |
| Query duration (p99) | Database → Query Performance | > 2000ms |
| Storage used | Database → Usage | > 400MB de 500MB |

---

## 9. Riscos do Plano

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| Ambiente de homologação compartilhado | Baixa | Executar fora do horário comercial; projeto dedicado |
| Dados de teste não removidos | Média | Script de cleanup obrigatório pós-execução |
| Limite de WebSocket atingido no Cenário D | Média | Limitar VUs a 50 na primeira execução; monitorar dashboard |
| `fetchAll` sem paginação travando | Alta em C/D | Documentado como risco; observar P95 do `fetchAll` |
| Custo de PBKDF2 no device do vendedor | Baixa | Operação assíncrona; não bloqueia UI |
| Vazamento de dados fictícios | Baixíssima | Projeto isolado + cleanup obrigatório |

---

## 10. Processo de Execução

```
1. Obter aprovação explícita → [responsável técnico assina]
2. Provisionar projeto Supabase de homologação
3. Aplicar migrações (ordem obrigatória — ver Seção 3)
4. Criar usuários de teste via `supabase/seed-usuarios-teste.sql` adaptado
5. Executar Cenário A → analisar resultados → documentar em LOAD_TEST_REPORT.md
6. Executar Cenário B → analisar resultados → documentar
7. Executar Cenário C → analisar resultados → documentar
8. (se C aprovado) Executar Cenário D → analisar → documentar
9. Executar script de cleanup
10. Atualizar PERFORMANCE_HISTORY.md com os resultados
```
