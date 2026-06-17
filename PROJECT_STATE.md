# PROJECT_STATE.md — RJNet Gestão de Eventos

> **Gerado em:** 2026-06-17  
> **Método:** Inventário completo de CHANGELOG, DECISIONS (D-001–D-041), SYSTEM_MAP, SUPABASE, LGPD_AUDIT_AND_COMPLIANCE, PLANO_DE_ACAO_LGPD, PENDENCIAS_POS_AUDITORIA, TECHNICAL_BACKLOG, QUICK_WINS, PERFORMANCE_HISTORY, PERFORMANCE_REVIEW, PERFORMANCE_AUDIT, ARCHITECTURE_TEST_SUMMARY, LOAD_TEST_PLAN, HYPOTHESIS_VALIDATION, REFATORAÇÃO  
> **Nível de confiança:** **Alto** — documentação densa e consistente entre si; divergências pontuais identificadas e registradas na seção 8

---

## 1. Saúde do Projeto

🟡 **Atenção**

O projeto está tecnicamente maduro (refatoração 100% concluída, LGPD em estágio avançado, quick wins de performance aplicados), mas há **pendências operacionais críticas**: migrações SQL produzidas mas não executadas em produção, e ações organizacionais LGPD sem responsável confirmado, colocando o sistema em risco regulatório e de segurança de dados no ambiente produtivo.

---

## 2. Status Geral

**Produção Inicial** — o sistema está implantado e em uso. A última versão de código é estável. Bloqueadores são operacionais (execução de scripts SQL no Supabase, configuração de secrets) e organizacionais (DPO, DPA, e-mail de privacidade), não de código.

---

## 3. Grau de Maturidade

**Pré-Produção** (no sentido de conformidade e performance validada) / **Produção Inicial** (no sentido de uso em campo)

O código está em produção. A conformidade LGPD completa e os testes de carga formais ainda não foram concluídos — o sistema não atingiu a maturidade de "Produção Estável".

---

## 4. Arquitetura Atual

| Camada | Tecnologia | Estado |
|--------|------------|--------|
| Frontend | React 19 + Vite 8 | ✅ Estável |
| Estado global | React Context (AppProvider) | ✅ Estável |
| Camada de API | Factory pattern (`src/api/`) | ✅ Estável |
| Camada de dados | `src/lib/dataService.js` | ✅ Estável |
| Backend | Supabase (PostgreSQL + Auth + Realtime) | ✅ Estável |
| Deploy | Vercel (CDN estático) | ✅ Estável |
| Auth | Supabase Auth com JWT + RBAC (marketing / vendedor) | ✅ Estável |
| Offline | Fila criptografada (AES-GCM 256 + PBKDF2) em localStorage | ✅ Estável |
| MFA | TOTP implementado no código | ⚠️ Não habilitado no Dashboard Supabase |
| Testes | Playwright E2E + Node.js unitários | ✅ Existem |
| Testes de carga | k6 (scripts prontos) | ⏳ Não executados |

**Dois perfis de acesso:** `marketing` (gestão completa) e `vendedor` (captura + ranking).  
**Dois modos de operação:** Supabase (produção) e local/localStorage (dev/demo).

---

## 5. Módulos Concluídos

### Refatoração (18/18 etapas — 100% concluída)

Refatoração encerrada. `src/main.jsx` foi de ~2.354 linhas para ~35. Código distribuído em 25+ módulos:

- `src/utils/` — format, masks, csv, mockData, ids
- `src/lib/` — supabase, mode, dataService, crypto, security, cache, constants
- `src/components/` — ui.jsx, SyncBadge, modals (EventModal, MaterialModal)
- `src/context/` — AppContext, AppProvider
- `src/apps/` — Root, MarketingApp, VendedorApp
- `src/auth/` — Login, LoginAuth, NovaSenha, RootAuth, RootLegacy
- `src/features/` — events (Dashboard, EventosTab, EventDetail), inventory, leads, checkin, team
- `src/hooks/` — useApp, usePersisted, useRanking
- `src/api/` — eventoApi, leadApi, materialApi, vendedorApi, equipeApi

### Features de negócio implementadas

| Feature | Status | Observações |
|---------|--------|-------------|
| CRUD de eventos | ✅ | Inclui exclusão protegida (só status ≠ ativo) |
| Filtro padrão "Ativo" em EventosTab | ✅ | D-040 — chips reordenados |
| CRUD de materiais + alocação por evento | ✅ | |
| Captura de leads (VendedorApp) | ✅ | Modo rápido, multi-seleção de serviços, CPF opcional |
| Edição e exclusão de lead pelo vendedor | ✅ | Soft delete com confirmação inline |
| Campo "Já é cliente" (Não/Sim) | ✅ | D-029 |
| `servicoInteresse` multi-select (array) | ✅ | D-026, backward-compat com string legada |
| Meta em 3 níveis (Bronze/Prata/Ouro) | ✅ | D-027 |
| Ranking em tempo real | ✅ | Cache 30s + polling 60s |
| Toast com undo | ✅ | |
| Check-in por nome | ✅ | Migrado de CPF para nome em PA-08 |
| Exportação CSV | ✅ | Por evento (individual) ou consolidado (N eventos) |
| Dashboard KPIs + gráfico donut | ✅ | |
| Gestão de equipe (modo local e Supabase) | ✅ | `EquipeTab` + `EquipeAuthTab` |
| Dark/light mode | ✅ | Persistido em localStorage |
| Sync offline com fila criptografada | ✅ | AES-GCM 256 |
| MFA TOTP (código) | ✅ código | ⚠️ Não ativo no Supabase Dashboard |
| Auditoria de exportações CSV | ✅ | Tabela `audit_exportacoes` |
| Log de exclusão de leads | ✅ | `deletado_em` + `deletado_por` |
| Consentimento LGPD no formulário | ✅ | Checkbox obrigatório |

---

## 6. Pendências Abertas

### 6.1 Migrações SQL prontas mas NÃO executadas em produção

> **Risco: ALTO.** Código implementado, SQL gerado, mas não aplicado ao banco.

| Item | Arquivo | Impacto se não executado |
|------|---------|--------------------------|
| RLS vendedor — vendedor lê APENAS seus próprios leads | `supabase/migracao-rls-vendedor-leads.sql` | 🔴 Vazamento de dados entre vendedores |
| Audit log de leads | `supabase/migracao-audit-log.sql` | 🟠 Sem rastreabilidade de INSERT/UPDATE/DELETE |
| Retenção automática (pg_cron) | `supabase/migracao-retencao.sql` | 🟠 Leads deletados acumulam indefinidamente |
| Secret CORS + redeploy Edge Function | Dashboard + `supabase functions deploy` | 🟠 CORS ainda aberto sem restrição de origem |
| Habilitar TOTP no Supabase Dashboard | Dashboard → Authentication → MFA | 🟡 MFA não ativo apesar do código existir |

**Ordem de execução recomendada (ver `doc/lgpd/PENDENCIAS_POS_AUDITORIA.md`):**
1. `migracao-rls-vendedor-leads.sql` (urgente — privacidade)
2. `migracao-audit-log.sql`
3. pg_cron → `migracao-retencao.sql`
4. CORS secret + deploy Edge Function
5. Habilitar TOTP

### 6.2 Pendências organizacionais / jurídicas

| Item | Responsável | Status |
|------|-------------|--------|
| Criar e-mail privacidade@rjnet.com.br | TI | 🔴 Em aberto |
| Assinar DPA com Supabase Inc. | Gestão/Jurídico | 🔴 Em aberto |
| Nomear DPO (art. 41 LGPD) | Diretoria | 🔴 Em aberto |
| Publicar Política de Privacidade externamente | Marketing/TI | 🔴 Em aberto |
| Decidir sobre campos `endereço` e `observação` | Negócio/Jurídico | 🔴 Em aberto |
| Definir tratamento dos 70 leads históricos sem consentimento | Negócio/Jurídico | 🔴 Em aberto |

### 6.3 Performance — itens de backlog ainda não implementados

| ID | Título | Prioridade | Complexidade |
|----|--------|-----------|--------------|
| TB-005 | `subscribeChanges()` — delta em vez de refetch completo | 🟠 Alto | Alta |
| TB-008 | React Context — sub-contextos por domínio | 🟡 Médio | Alta |
| TB-009 | `getMateriaisDisponiveis()` memoizado | 🟡 Médio | Baixa |
| TB-010 | Indicador de loading na exportação CSV (QW-006) | 🟡 Médio | Baixa |
| TB-011 | Polling de ranking com backoff adaptativo | 🟢 Baixo | Baixa |
| TB-012 | Canais realtime por entidade | 🟢 Baixo | Média |

### 6.4 Testes de carga não executados

Os 4 cenários k6 (A–D) foram planejados e documentados (`doc/performance/LOAD_TEST_PLAN.md`), scripts prontos, mas nenhum foi executado. O ambiente de homologação ainda não foi provisionado.

---

## 7. Correções e Implementações Recentes (última sessão — 2026-06-17)

| Decisão | O que foi feito |
|---------|----------------|
| D-036 (QW-001, QW-003) | Fix `ranking_evento` para filtrar `deletado = false`; timeout 15s em `fetchAll` via `AbortSignal` |
| D-037 (QW-004) | Column pruning: `select('*')` → colunas explícitas no `fetchAll` |
| D-038 (QW-005) | `REALTIME_DEBOUNCE_MS` 400ms → 1500ms |
| D-039 (TB-004) | Leads carregados on-demand por evento; `fetchAll` não carrega mais todos os leads; `LeadsTab` redesenhada como central de exportação |
| D-040 | `EventosTab` abre com filtro padrão `"ativo"`; chips reordenados |
| D-041 | Botão "Excluir Evento" em `EventDetail` (só marketing, só eventos não ativos) |

Também aplicado em produção (2026-06-17):
- `supabase/fix-ranking-deletado.sql` — ✅ executado no Supabase Dashboard
- `supabase/perf-indices-compostos.sql` — ✅ 11 índices confirmados em `leads`

---

## 8. Status da Conformidade LGPD

**Nota atual (estimada):** 6,2 / 10 — Nível Intermediário  
**Nota esperada (após Bloco 1 técnico):** 7,9 / 10  
**Nota esperada (completa):** 9,1 / 10

### Plano de Ação (21 ações — PA-01 a PA-21)

| Fase | Ações | Status |
|------|-------|--------|
| Fase 1 — Correção Imediata | PA-01, PA-02, PA-03 | 🟢 3/3 concluídas |
| Fase 2 — Coleta e Segurança | PA-04, PA-05, PA-06, PA-07, PA-08, PA-09 | 🟢 6/6 concluídas |
| Fase 3 — Retenção e Auditoria | PA-10, PA-11, PA-12, PA-13, PA-14, PA-15 | 🟢 Código/SQL criados; ⚠️ SQL não executado em produção (PA-10, PA-11, PA-13) |
| Fase 4 — Governança | PA-16, PA-17, PA-18, PA-19, PA-20, PA-21 | 🟢 PA-16, PA-17, PA-18, PA-20 concluídos (docs); 🔴 PA-19, PA-21 dependem de decisão externa |

**Resumo:** 16/21 ações 🟢, 3/21 🟡 (pendentes aprovação DPO), 2/21 🔴 (decisão externa).

**Artefatos jurídicos criados:**
- `doc/lgpd/RIPD.md` — pendente aprovação DPO
- `doc/lgpd/ROPA.md` — pendente validação DPO
- `doc/lgpd/PLANO_INCIDENTES.md` — pendente aprovação DPO + tabletop exercise
- `doc/lgpd/POLITICA_DE_PRIVACIDADE.md` — pendente publicação externa
- `doc/lgpd/DPA_FORNECEDORES.md` — pendente assinatura com Supabase Inc.
- `doc/lgpd/ROTEIRO_DSAR.md` — queries prontas; canal privacidade@rjnet.com.br pendente

---

## 9. Status de Performance

### Quick Wins Aplicados

| ID | Status | Onde aplicado |
|----|--------|---------------|
| QW-001 — Fix `ranking_evento` | ✅ Produção | `supabase/fix-ranking-deletado.sql` |
| QW-002 — Índices compostos `leads` | ✅ Produção | `supabase/perf-indices-compostos.sql` |
| QW-003 — Timeout 15s `fetchAll` | ✅ Código | `src/context/AppProvider.jsx` |
| QW-004 — Column pruning `fetchAll` | ✅ Código | `src/lib/dataService.js` |
| QW-005 — Debounce realtime 1500ms | ✅ Código | `src/lib/constants.js` |
| QW-006 — Loading exportação CSV | ⏳ Backlog | — |

### Testes de carga

| Execução | Status |
|----------|--------|
| Ambiente de homologação | ⏳ Não provisionado |
| Cenário A — Normal (5 VU, 10 min) | ⏳ Não executado |
| Cenário B — Pico (15 VU, 18 min) | ⏳ Não executado |
| Cenário C — Crítico (20 VU + flush) | ⏳ Não executado |
| Cenário D — Estresse (ramp-up 100 VU) | ⏳ Não executado |

**Baseline de performance:** sem execução; somente análise estática (PERF-001).  
**Hipóteses H-001 a H-007** (`doc/performance/HYPOTHESIS_VALIDATION.md`) aguardam execução do Cenário A para validação.

---

## 10. Riscos Conhecidos

| Risco | Severidade | Status |
|-------|-----------|--------|
| Vendedores veem leads de colegas (RLS não aplicado em produção) | 🔴 CRÍTICO | SQL pronto; não executado |
| DPA Supabase não assinado (transferência internacional sem garantia) | 🔴 ALTO | Depende de upgrade de plano + assinatura |
| DPO não nomeado (art. 41 LGPD) | 🔴 ALTO | Decisão da diretoria |
| 70 leads históricos sem consentimento | 🟠 MÉDIO | Decisão negócio/jurídico pendente |
| CORS Edge Function ainda aberto (secret não configurado) | 🟠 MÉDIO | Ação manual pendente |
| MFA não habilitado no Supabase Dashboard | 🟠 MÉDIO | Ação manual pendente |
| Sem audit log em produção | 🟠 MÉDIO | SQL pronto; não executado |
| Sem retenção automática em produção | 🟠 MÉDIO | SQL pronto; não executado |
| Testes de carga não executados — capacidade sob pico desconhecida | 🟡 BAIXO-MÉDIO | Bloqueio: ambiente de homologação |
| `subscribeChanges()` faz refetch completo (não delta) | 🟡 BAIXO-MÉDIO | TB-005 no backlog |
| React Context sem seletores — re-renders globais | 🟡 BAIXO-MÉDIO | TB-008 no backlog |

---

## 11. Inconsistências Detectadas

| Inconsistência | Origem | Impacto |
|---------------|--------|---------|
| `ARCHITECTURE_TEST_SUMMARY.md` (gerado 2026-06-17) menciona debounce de 400ms — valor já atualizado para 1500ms por D-038 no mesmo dia | Documento gerado antes de D-038 ser implementado | Baixo — documentação desatualizada; código correto |
| `PERFORMANCE_REVIEW.md` descreve `fetchAll` carregando leads sem paginação (PA-001) — resolvido por D-039 (leads on-demand) | Auditoria precedeu D-039 | Baixo — auditoria histórica; código corrigido |
| `PLANO_DE_ACAO_LGPD.md` indica "Status geral: 15 de 21 ações concluídas" no cabeçalho, mas o CHANGELOG v3.3 descreve 16/21 concluídas | Header desatualizado no PLANO | Baixo — CHANGELOG é a fonte mais recente |
| `PENDENCIAS_POS_AUDITORIA.md` trata RLS vendedor (1.1), audit log (1.2) e retenção (1.3) como não executados — consistente com ausência de evidência contrária | — | Confirma o risco real |

---

## 12. Resumo Executivo

O RJNet Gestão de Eventos é um sistema de captura de leads em eventos de campo que atingiu maturidade técnica significativa em tempo acelerado. A refatoração de 18 etapas está 100% concluída, o plano LGPD de 21 ações teve 76% das ações implementadas, e 5 de 6 quick wins de performance foram aplicados — dois deles diretamente em banco de produção (fix do placar, índices compostos).

O principal risco ativo é operacional: três scripts SQL críticos (RLS vendedor, audit log, retenção automática) foram escritos e testados mas não foram executados no banco de produção. Enquanto o RLS permanecer sem a migration `migracao-rls-vendedor-leads.sql`, os dados pessoais de todos os leads ficam visíveis para todos os vendedores — não conformidade grave de privacidade LGPD.

O segundo risco é organizacional: DPO não nomeado, DPA Supabase não assinado, canal privacidade@rjnet.com.br inexistente, Política de Privacidade não publicada externamente. Esses itens dependem de decisão e ação fora do escopo do time técnico.

---

## 13. Próximas Ações Recomendadas

**Imediatas (técnicas, < 1 hora total — qualquer operador):**

1. Executar `supabase/migracao-rls-vendedor-leads.sql` no Supabase SQL Editor ← **prioridade máxima**
2. Executar `supabase/migracao-audit-log.sql`
3. Habilitar pg_cron → executar `supabase/migracao-retencao.sql`
4. Configurar secret `CORS_ALLOWED_ORIGINS` → `supabase functions deploy atualizar-email-usuario`
5. Habilitar TOTP no Supabase Dashboard → orientar usuários marketing

**Curto prazo (decisão organizacional):**

6. Criar e-mail privacidade@rjnet.com.br (TI)
7. Nomear DPO (Diretoria)
8. Assinar DPA com Supabase Inc. (Gestão/Financeiro)
9. Publicar Política de Privacidade externamente

**Médio prazo (técnico):**

10. Provisionar ambiente de homologação → executar Cenário A (k6) → validar hipóteses H-001–H-007
11. Implementar TB-009 (`getMateriaisDisponiveis` memoizado) — quick win de re-render
12. Implementar QW-006 (loading CSV) — TB-010
13. Avaliar TB-005 (delta realtime) após métricas do Cenário A

---

## 14. Referências Cruzadas

| Documento | Última atualização | Leitura obrigatória antes de |
|----------|--------------------|------------------------------|
| `doc/architecture/SYSTEM_MAP.md` | 2026-06-17 | Toda sessão |
| `doc/architecture/DECISIONS.md` | 2026-06-17 (D-041) | Qualquer mudança arquitetural |
| `doc/lgpd/PENDENCIAS_POS_AUDITORIA.md` | 2026-06-16 | Operações no Supabase |
| `doc/lgpd/PLANO_DE_ACAO_LGPD.md` | 2026-06-16 | Ações de conformidade |
| `doc/performance/TECHNICAL_BACKLOG.md` | 2026-06-17 | Sprint de performance |
| `doc/performance/LOAD_TEST_PLAN.md` | 2026-06-17 | Execução de testes de carga |
| `doc/CHANGELOG.md` | 2026-06-17 (v3.3) | Histórico de mudanças |
