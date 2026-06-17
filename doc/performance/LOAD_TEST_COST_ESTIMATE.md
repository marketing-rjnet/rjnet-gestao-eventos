# LOAD_TEST_COST_ESTIMATE.md
# Estimativa de Impacto e Custo — Testes de Carga

> Gerado em: 2026-06-17  
> Ambiente alvo: Supabase Free Tier (homologação)  
> **ATENÇÃO: Nenhum teste deve ser executado sem aprovação explícita.**

---

## Premissas de Contexto

Com base na arquitetura e no modelo de negócio identificados:

- **Evento típico:** 2–8 horas de duração, 5–20 vendedores em campo
- **Lead médio por vendedor/hora:** 5–15 leads
- **Usuários marketing:** 1–3 simultâneos (dashboard)
- **Tabelas:** `leads`, `eventos`, `materiais`, `perfis` (sem sharding)
- **Realtime:** 1 canal WebSocket global (`rjnet-sync`) por sessão de marketing

---

## 1. Cenários Propostos

### Cenário A — Operação Normal
**Descrição:** Evento padrão com 5 vendedores, 2 horas de duração.

| Parâmetro | Valor |
|-----------|-------|
| Vendedores ativos | 5 |
| Usuários marketing | 1 |
| Duração do evento | 2 horas |
| Leads por vendedor/hora | 8 |
| Total de leads esperados | ~80 |
| Concurrent users no pico | 6 |

### Cenário B — Pico Operacional
**Descrição:** Evento grande com 15 vendedores, 4 horas, 2 usuários marketing.

| Parâmetro | Valor |
|-----------|-------|
| Vendedores ativos | 15 |
| Usuários marketing | 2 |
| Duração do evento | 4 horas |
| Leads por vendedor/hora | 12 |
| Total de leads esperados | ~720 |
| Concurrent users no pico | 17 |

### Cenário C — Evento Crítico
**Descrição:** Evento máximo com 20 vendedores, flush simultâneo de fila offline, ranking sob demanda.

| Parâmetro | Valor |
|-----------|-------|
| Vendedores ativos | 20 |
| Usuários marketing | 3 |
| Duração | 6 horas |
| Leads por vendedor/hora | 15 |
| Total de leads esperados | ~1800 |
| Concurrent users no pico | 23 |
| Vendedores offline (flush simultâneo) | 10 |
| Leads na fila offline por vendedor | 20 |

### Cenário D — Estresse
**Descrição:** Descobrir o limite operacional. Vendedores virtuais escalados até degradação.

| Parâmetro | Valor |
|-----------|-------|
| VUs inicial | 10 |
| VUs máximo | 100 |
| Ramp-up | 5 VUs/30s |
| Duração | 10 minutos |
| Objetivo | encontrar ponto de falha |

---

## 2. Estimativa de Operações por Cenário

### Cenário A — Operação Normal

| Operação | Quantidade | Frequência | Total em 2h |
|----------|-----------|-----------|------------|
| `fetchAll` (carga inicial) | 6 usuários × 1 | once | 6 |
| `saveLead` (upsert) | 5 vendors × 8/h × 2h | contínuo | **80** |
| `rankingEvento` (RPC) | 5 vendors × 1/min × 120min | polling | 600 → **cache HIT ~570** (~30 reais) |
| `subscribeChanges` refresh | 80 lead inserts × debounce | realtime | ~80 `fetchAll` no marketing |
| `auth.getSession` | 6 × 1 | abertura | 6 |
| Exportação CSV | 0–2 | manual | 0–2 |
| **Total de requests ao banco** | | | **~200 queries reais** |

### Cenário B — Pico Operacional

| Operação | Quantidade | Total em 4h |
|----------|-----------|------------|
| `fetchAll` (carga inicial) | 17 usuários | 17 |
| `saveLead` (upsert) | 15 × 12 × 4h | **720** |
| `rankingEvento` (RPC) | 15 × 1/min × 240min | ~3600 → **~360 reais** (cache) |
| `fetchAll` realtime (marketing) | ~720 lead events × 2 mkt | ~1440 → debounce reduz para **~200** |
| `auth.*` | 17 usuários × sessão | 17–34 |
| **Total de requests ao banco** | | **~1.300 queries reais** |

### Cenário C — Evento Crítico

| Operação | Quantidade | Total em 6h |
|----------|-----------|------------|
| `fetchAll` (carga inicial) | 23 usuários | 23 |
| `saveLead` (upsert) | 20 × 15 × 6h | **1.800** |
| Flush fila offline (burst) | 10 vendors × 20 leads | **200 upserts simultâneos** |
| `rankingEvento` (RPC) | 20 × 1/min × 360min | ~7200 → **~720 reais** (cache) |
| `fetchAll` realtime | ~2000 eventos × 3 mkt | **~500 reais** (debounce) |
| **Total de requests ao banco** | | **~3.250 queries reais** |

### Cenário D — Estresse

| Operação | VUs | Duração | Estimativa total |
|----------|-----|---------|-----------------|
| Login (auth.signIn) | 10→100 | ramp 5min | ~500 auth requests |
| `saveLead` | 10→100 | 10min | **~6.000 upserts** |
| `rankingEvento` | 10→100 | 10min | ~10.000 → **~1.000 reais** (cache) |
| `fetchAll` | 10→100 | 10min | **~2.000** |
| **Total** | | | **~10.000 requests** |

---

## 3. Impacto Estimado por Recurso

### 3.1 Banco de Dados (PostgreSQL)

| Cenário | Reads/hora | Writes/hora | Risco |
|---------|-----------|------------|-------|
| A — Normal | ~80 | ~40 | Baixo |
| B — Pico | ~350 | ~180 | Moderado |
| C — Evento Crítico | ~600 | ~350 | **Alto** (burst flush) |
| D — Estresse | ~1.200 | ~600 | **Crítico** |

**Supabase Free Tier:** 500MB de banco, 2GB de transferência/mês, sem limite de conexões declarado (usa `pgbouncer`).

**Risco principal:** O `fetchAll()` sem paginação carrega toda a tabela `leads`. Com 1800 leads (Cenário C), cada `fetchAll` transfere ~180KB de JSON. Com 3 usuários marketing fazendo fetch a cada 400ms de debounce → potencial de 500 × 180KB = **~90MB de transferência** só do realtime.

### 3.2 Storage

| Operação | Impacto |
|----------|---------|
| localStorage (fila offline) | < 1MB por dispositivo (20 leads × ~2KB/lead cifrado) |
| Cache em memória (rankings) | < 50KB por evento |
| CSV exportado | < 5MB para 1800 leads |

**Supabase Storage:** não utilizado por esta aplicação. Sem custo.

### 3.3 Banda (Transferência de Dados)

| Cenário | Transferência estimada (banco → app) |
|---------|--------------------------------------|
| A — Normal | ~5MB (2h) |
| B — Pico | ~50MB (4h) |
| C — Evento Crítico | **~150MB** (6h) — principalmente `fetchAll` realtime |
| D — Estresse | **~200MB** (10min) |

**Free Tier Supabase:** 2GB/mês incluídos. Cenário D pode consumir ~10% do limite mensal em 10 minutos se repetido muitas vezes.

### 3.4 Realtime (WebSocket)

| Cenário | Conexões simultâneas | Mensagens/hora |
|---------|---------------------|----------------|
| A — Normal | 1 | ~80 |
| B — Pico | 2 | ~720 |
| C — Evento Crítico | 3 | ~2000 |
| D — Estresse | 10–100 | ~10.000 |

**Supabase Free Tier:** 200 conexões simultâneas máx. Cenário D pode saturar se cada VU abrir uma conexão WebSocket própria. **Risco real identificado.**

### 3.5 Autenticação (Supabase Auth)

| Cenário | Login requests | Refresh tokens |
|---------|---------------|----------------|
| A — Normal | 6 | ~6/hora |
| B — Pico | 17 | ~17/hora |
| C — Evento Crítico | 23 | ~23/hora |
| D — Estresse | ~500 (ramp) | irrelevante |

**Supabase Auth:** sem limite declarado no Free Tier para sign-in. Sem risco.

### 3.6 Edge Functions (Deno)

Usada apenas para criação/edição/exclusão de usuários (`createEquipeApi`). Não é chamada durante captura de leads. Impacto: mínimo nos cenários de teste.

**Free Tier:** 500.000 invocações/mês. Sem risco.

---

## 4. Riscos Identificados

### 4.1 Risco de Sobrecarga

| Componente | Cenário de Risco | Probabilidade | Impacto |
|-----------|-----------------|--------------|---------|
| `fetchAll` sem paginação | C e D | **Alta** | Lentidão geral, timeout |
| Realtime WebSocket (200 limit) | D | Média | Conexões recusadas |
| Burst de flush offline (10×20 upserts) | C | Média | Spike de latência no banco |
| Context re-render global (React) | C e D | Média | UI travando no marketing |
| PBKDF2 (100k iter) na fila offline | C | Baixa | CPU do dispositivo do vendedor |

### 4.2 Risco de Custo

| Recurso | Cenário | Custo estimado |
|---------|---------|---------------|
| Banco (PostgreSQL) | A–C | **$0** (Free Tier) |
| Transferência de dados | C | **$0** (< 2GB/mês) |
| Transferência de dados | D (repetido 10x) | **$0–$5/mês** |
| Edge Functions | Todos | **$0** (< 500k invocações) |
| Realtime | D | Risco de degradação, não de custo |

**Conclusão de custo:** Os cenários A, B e C têm custo zero no Free Tier. O Cenário D, se repetido excessivamente (> 20 vezes/mês), pode aproximar-se dos limites de transferência, mas sem custo financeiro (apenas degradação de velocidade).

### 4.3 Riscos de Limitações de Plataforma

| Limitação | Limite Free Tier | Risco |
|-----------|-----------------|-------|
| Conexões WebSocket simultâneas | 200 | Cenário D com > 200 VUs |
| Tamanho do banco | 500MB | Sem risco em testes |
| Requisições por segundo (não documentado) | ~50–100 rps estimado | Cenário D pode estressar |
| Função de ranking RPC | sem SLA documentado | Risco em Cenário D |

---

## 5. Recomendação Final

### Por Cenário

| Cenário | Classificação | Condição |
|---------|--------------|---------|
| A — Operação Normal | ✅ **SEGURO** | Executar em Supabase de homologação, dados fictícios |
| B — Pico Operacional | ✅ **SEGURO** | Executar em Supabase de homologação, dados fictícios |
| C — Evento Crítico | ⚠️ **SEGURO COM RESSALVAS** | Exige Supabase de homologação dedicado; monitorar transferência; dados fictícios |
| D — Estresse | ⚠️ **SEGURO COM RESSALVAS** | Supabase de homologação dedicado; limitar VUs a 50 primeiro; cuidado com limite de WebSocket |

### Ressalvas Obrigatórias

1. **Ambiente separado de produção:** usar projeto Supabase exclusivo para testes — nunca o projeto de produção
2. **Dados fictícios:** todos os leads, eventos e usuários gerados pelos testes devem usar dados sintéticos (CPFs/telefones inválidos, e-mails `@test.invalid`)
3. **Limpeza pós-teste:** script de cleanup deve remover todos os dados de teste após cada execução
4. **Sem testes não autorizados:** nenhum cenário deve ser iniciado sem aprovação explícita do responsável pelo projeto
5. **Monitoramento ativo:** durante Cenário C e D, monitorar Supabase Dashboard (Database → Usage, Auth → Usage) em tempo real

### Aprovação Necessária Antes de Execução

- [ ] Aprovação do responsável técnico
- [ ] Projeto Supabase de homologação criado e configurado
- [ ] Script de cleanup validado
- [ ] Ambiente de rede controlado (VPN ou rede local)
