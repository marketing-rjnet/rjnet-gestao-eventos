# ARCHITECTURE_TEST_SUMMARY.md
# Resumo Arquitetural para Testes de Performance

> Gerado em: 2026-06-17  
> Baseado em: SYSTEM_MAP.md, DECISIONS.md, SUPABASE.md, CLAUDE.md

---

## 1. Arquitetura Identificada

### Resumo Técnico

O RJNet Gestão de Eventos é uma SPA React (React 19 + Vite 8) com dois modos de operação:

- **Modo Supabase (produção):** PostgreSQL gerenciado, Auth JWT, RLS, realtime via WebSocket (canais Supabase), Edge Functions Deno
- **Modo local (desenvolvimento/demo):** localStorage puro, sem backend, sem rede

A camada de dados (`src/lib/dataService.js`) é a única ponte entre a aplicação e o Supabase. Ela implementa:

- Mapeamento automático camelCase ↔ snake_case
- `withRetry()` com backoff exponencial (800ms base, 3 tentativas máx.)
- `trackPerf()` com alerta para requisições > 1s
- Fila offline com criptografia AES-GCM 256 (PA-05/LGPD)
- Cache em memória com TTL de 30s para rankings (via `src/lib/cache.js`)
- Subscriptions realtime com debounce de 400ms

### Principais Módulos

| Módulo | Responsabilidade | Criticidade |
|--------|-----------------|-------------|
| `src/lib/dataService.js` | Queries, auth, realtime, fila offline, retry | **CRÍTICA** |
| `src/context/AppProvider.jsx` | Orquestração de estado global + factories de API | **ALTA** |
| `src/api/leadApi.js` | CRUD de leads + ranking | **ALTA** |
| `src/api/eventoApi.js` | CRUD de eventos | **ALTA** |
| `src/apps/VendedorApp.jsx` | Shell do vendedor: captura de leads, toast, undo | **ALTA** |
| `src/features/events/Dashboard.jsx` | KPIs, gráfico donut, próximos eventos | **MÉDIA** |
| `src/features/leads/LeadsTab.jsx` | Visualização, filtros, exportação CSV | **MÉDIA** |
| `src/lib/cache.js` | Cache em memória com TTL | **MÉDIA** |
| `src/lib/crypto.js` | Criptografia da fila offline (AES-GCM + PBKDF2) | **MÉDIA** |
| `supabase/functions/atualizar-email-usuario` | Edge Function administrativa | **BAIXA** |

### Dependências Relevantes

| Dependência | Versão | Impacto em Performance |
|-------------|--------|----------------------|
| `@supabase/supabase-js` | ^2.108.1 | Gerencia conexões WebSocket + REST |
| `react` + `react-dom` | ^19.2.0 | Re-renders controlados por Context |
| `chart.js` | ^4.5.1 | Destruição/recriação no unmount |
| Supabase PostgreSQL | gerenciado | Queries + RLS + realtime |
| Supabase Auth | gerenciado | JWT + sessão por usuário |
| Supabase Realtime | gerenciado | WebSocket persistente |
| Vercel (CDN) | gerenciado | Serve o bundle estático |

---

## 2. Fluxos Críticos

Os fluxos foram ordenados por impacto potencial em caso de degradação.

### FC-01 — Captura de Lead pelo Vendedor
**Prioridade: CRÍTICA**

```
VendedorApp.submit()
  → createLeadApi.addLead()
    → setState otimista (imediato)
    → db.saveLead() (assíncrono)
      → leadToDb() (serialização + JSON.stringify de servicoInteresse)
      → supabase.from('leads').upsert()
        → [se offline] addToQueue() → encryptQueue() → localStorage
      → invalidarRanking(eventoId)
      → canal realtime notifica marketing em ~400ms
```

**Por que é crítico:** Todo o propósito do sistema em campo é este fluxo. Latência percebida aqui impacta diretamente a produtividade dos vendedores em eventos.

### FC-02 — Carga Inicial do Aplicativo
**Prioridade: CRÍTICA**

```
AppProvider (useEffect de carga)
  → fetchAll(signal)
    → Promise.all([materiais, perfis, eventos, leads])  ← 4 queries paralelas
    → withRetry() com até 3 tentativas
    → setState de todos os domínios
    → subscribeChanges() (inicia WebSocket)
```

**Por que é crítico:** Tempo de carregamento inicial define a percepção de velocidade do sistema. 4 queries paralelas sem paginação podem causar lentidão com volumes grandes.

### FC-03 — Polling de Ranking (VendedorApp)
**Prioridade: ALTA**

```
useRanking(eventoId, leadsCount)
  → setInterval a cada 60s
    → rankingEvento(eventoId)
      → cache.get() → HIT: retorna imediato
      → MISS: supabase.rpc('ranking_evento', { eid })
        → cache.set(result, TTL 30s)
```

**Por que é alto:** Com 20 vendedores ativos, gera 20 queries por minuto ao banco via RPC. Cache de 30s mitiga mas não elimina.

### FC-04 — Sincronização Realtime (Marketing Dashboard)
**Prioridade: ALTA**

```
subscribeChanges(onChange)
  → canal 'rjnet-sync' (WebSocket Supabase)
    → evento postgres_changes (qualquer tabela)
      → debounce(400ms)
        → fetchAll() (recarga completa de todos os dados)
```

**Por que é alto:** Cada mutação de qualquer tabela dispara um `fetchAll()` completo no marketing. Com múltiplos vendedores inserindo leads em paralelo, o debounce de 400ms pode ainda gerar múltiplos fetchAll consecutivos.

### FC-05 — Exportação CSV de Leads
**Prioridade: MÉDIA**

```
LeadsTab.exportar()
  → db.registrarExportacao() (auditoria PA-06 — fire-and-forget)
  → exportLeadsCSV(leadsFiltrados)
    → geração em memória (sem streaming)
    → Blob + URL.createObjectURL()
    → download via <a> temporário
```

**Por que é médio:** Geração em memória pode ser problemática com volumes grandes (milhares de leads). Não há paginação ou streaming.

### FC-06 — Autenticação e Recuperação de Sessão
**Prioridade: MÉDIA**

```
RootAuth (mount)
  → auth.getSessao()
    → supabase.auth.getSession()
    → auth.getPerfil(userId) → supabase.from('perfis').select(*)
      → verificação de perfil ativo
        → [se MFA] listFactors() → challenge TOTP
```

**Por que é médio:** A autenticação tem múltiplas roundtrips ao Supabase. Com muitos usuários abrindo o app simultaneamente (início de evento), pode gerar pico de requisições de auth.

### FC-07 — Flush da Fila Offline
**Prioridade: MÉDIA**

```
[reconecta à rede]
  → flushPendingQueue()
    → getQueue() → decryptQueue() (AES-GCM)
    → supabase.from('eventos').select(ids ativos)
    → for each op: supabase.from('leads').upsert()
```

**Por que é médio:** Se vários vendedores ficam offline durante o evento e reconectam simultaneamente (ex: Wi-Fi voltou), pode gerar burst de upserts no banco.

---

## 3. Componentes Sensíveis

### 3.1 Componentes de Alto Risco

| Componente | Risco | Motivo |
|-----------|-------|--------|
| `fetchAll()` | **ALTO** | 4 queries paralelas sem paginação; chamado a cada evento realtime |
| `subscribeChanges()` | **ALTO** | 1 canal WebSocket global; cada mutação dispara `fetchAll()` completo |
| `rankingEvento()` | **MÉDIO** | RPC com agregação; chamado via polling de 60s por cada vendedor |
| `flushPendingQueue()` | **MÉDIO** | Burst de upserts ao reconectar |
| `exportLeadsCSV()` | **MÉDIO** | Geração em memória sem streaming |
| `encryptQueue()` / `decryptQueue()` | **BAIXO** | PBKDF2-SHA256 com 100k iterações é custoso por design |

### 3.2 Componentes Mais Acessados

Em produção durante um evento ativo:

1. `db.saveLead()` — chamado por cada vendedor a cada lead capturado
2. `rankingEvento()` — chamado por todos os vendedores a cada 60s (mitigado por cache)
3. `fetchAll()` — chamado pelo marketing via realtime (debounce 400ms)
4. `supabase.auth.getSession()` — chamado a cada abertura do app

---

## 4. Riscos Potenciais

### 4.1 Concorrência

| Risco | Severidade | Detalhe |
|-------|-----------|---------|
| Múltiplos vendedores inserindo leads simultaneamente | **ALTA** | 20 upserts concorrentes na tabela `leads`; RLS adiciona overhead por query |
| Dois usuários editando o mesmo evento | **MÉDIA** | Sem lock otimista; último a salvar vence (perda silenciosa de dados) |
| Burst de flush de fila offline | **MÉDIA** | Todos reconectam ao mesmo tempo → N upserts simultâneos |
| Canal realtime único (`rjnet-sync`) | **BAIXA** | Canal global escuta todas as tabelas; sem filtragem por tabela |

### 4.2 Performance

| Risco | Severidade | Detalhe |
|-------|-----------|---------|
| `fetchAll()` sem paginação | **ALTA** | Com 1000+ leads, a query sem `limit` retorna tudo em memória |
| React Context re-render global | **MÉDIA** | Qualquer mudança em `AppContext` re-renderiza todos os consumidores |
| `exportLeadsCSV()` bloqueante | **MÉDIA** | Geração de Blob em memória; sem Web Worker |
| Chart.js destruição/recriação | **BAIXA** | Destruído no unmount — controlado, mas pode ser frequente |
| `rankingEvento()` RPC sem índice explícito | **BAIXA** | Documentado; TTL de 30s mitiga |

### 4.3 Sincronização

| Risco | Severidade | Detalhe |
|-------|-----------|---------|
| Estado local divergindo do banco | **MÉDIA** | Atualização otimista: UI muda antes da confirmação do banco; sem reconciliação de conflitos |
| Evento realtime perdido (WebSocket cai) | **MÉDIA** | Sem heartbeat explícito no código; sem lógica de reconexão forçada |
| Cache de ranking stale | **BAIXA** | TTL 30s + invalidação por mutação; pode mostrar dados desatualizados |
| `_sessionPromise` micro-cache stale | **BAIXA** | Descartado após o tick; risco mínimo |

### 4.4 Integridade de Dados

| Risco | Severidade | Detalhe |
|-------|-----------|---------|
| Lead duplicado na fila offline | **MÉDIA** | Se `upsert` falha e o lead já foi inserido (retry), pode gerar duplicata lógica |
| Soft delete inconsistente | **BAIXA** | `deletado=true` sem cascade; leads deletados não somem do ranking imediatamente |
| Migração de `servicoInteresse` de string para array | **BAIXA** | `leadFromDb` faz parse; dados antigos sem JSON válido viram `[string]` |

---

## 5. Estratégia Recomendada de Testes

### 5.1 Ferramenta: k6

**Justificativa técnica:**
- k6 é a ferramenta padrão de mercado para testes de carga de APIs REST e WebSocket, exatamente o perfil deste sistema
- Executa scripts JavaScript/ES6 nativamente — familiaridade para o time
- Suporte nativo a WebSocket (canais realtime Supabase usam WebSocket)
- Métricas P50/P95/P99 integradas
- Execução local sem custo de SaaS para testes em ambiente de homologação
- Integração com InfluxDB/Grafana para visualização histórica
- Alternativa avaliada e descartada: Artillery (menos flexível para cenários custom); Locust (Python — stack diferente); JMeter (pesado, XML)

### 5.2 Abordagem

1. **Mock do Supabase REST** para testes unitários de performance (sem custo de banco)
2. **Supabase local** (`supabase start`) para testes de integração
3. **Supabase de homologação** (projeto separado do produção) para testes de carga reais
4. **Nunca em produção** sem autorização explícita

### 5.3 Cenários Prioritários

| Prioridade | Cenário | Fluxo Principal |
|-----------|---------|----------------|
| 1 | Captura de leads simultânea | FC-01 |
| 2 | Carga inicial do app | FC-02 |
| 3 | Polling de ranking | FC-03 |
| 4 | Realtime marketing | FC-04 |
| 5 | Exportação CSV | FC-05 |

### 5.4 Critérios de Aprovação

| Métrica | Limite |
|---------|--------|
| Taxa de erro | < 1% |
| Tempo médio de resposta | < 500ms |
| P95 | < 1000ms |
| P99 | < 2000ms |
| Perda de dados | 0 (zero tolerância) |
| Sincronização | íntegra (sem divergências) |
