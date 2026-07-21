# RJNet Gestão de Eventos — CLAUDE.md

## Visão Geral

Sistema de gerenciamento de eventos para a RJNet. Permite controle de eventos, estoque de materiais, captura de leads e gestão de equipe comercial.

**Stack:** React 19 + Vite 8 + Supabase (PostgreSQL + Auth) + Chart.js 4  
**Deploy:** Vercel  
**Testes:** Playwright (E2E) + Node.js (unitários)

## Documentação de Referência

@doc/architecture/SYSTEM_MAP.md

| Arquivo | Conteúdo | Quando ler |
|---------|----------|------------|
| `doc/architecture/SYSTEM_MAP.md` | **Arquitetura viva** — estrutura, fluxo de dados e restrições. Carregado automaticamente via `@import` acima. | Toda sessão (automático) |
| `doc/architecture/DECISIONS.md` | Histórico de decisões arquiteturais e técnicas com justificativas | Antes de qualquer mudança arquitetural ou de padrão |
| `doc/architecture/SUPABASE.md` | Configuração detalhada do Supabase (schema, RLS, Edge Functions) | Antes de qualquer alteração no banco ou schema |
| `doc/CHANGELOG.md` | Histórico de mudanças por versão | Consulta histórica |
| `doc/BOAS_PRATICAS.md` | **Boas práticas e dicas do sistema** — fluxo de desenvolvimento, git, preview Vercel, commits atômicos, princípios de UX | Referência geral; ao iniciar qualquer sessão de desenvolvimento |
| `doc/SEGURANCA_MODERACAO.md` | **Moderação da captação pública** — processo de remoção/denúncia para conteúdo ilegal submetido via formulário público, proteções técnicas em vigor (D-067) | Antes de alterar o formulário público ou lidar com um lead suspeito/ilegal |
| `doc/SEGURANCA_HARDENING.md` | **Hardening de segurança (painel + deploy)** — checklist de configuração externa que sustenta os controles do código: ordem de migrações, auto-cadastro off, secret `CORS_ALLOWED_ORIGINS`, padrão `revoke` em SECURITY DEFINER, bucket público (D-078, auditoria de 2026-07-17) | Antes de alterar RLS/Edge Functions/auth, ao aplicar migrações ou preparar deploy; ao criar qualquer função SECURITY DEFINER ou policy nova |
| `doc/simulador/SIMULADOR_IMPLEMENTATION_PLAN.md` | 🗂️ **Plano ORIGINAL de implementação do Simulador** (F0–F5 implementadas, D-072/D-073) — parcialmente superado pela evolução do produto em D-074–D-077 (nota no topo do arquivo aponta as divergências); útil como histórico, não como arquitetura corrente | Consulta histórica do desenho original; para o estado atual, use a seção "Simulador" de `SYSTEM_MAP.md` |
| `doc/architecture/ARCHITECTURE_FIX_PLAN.md` | Plano de correções arquiteturais pós-auditoria (D-030) — desvios identificados e corrigidos | Antes de qualquer refatoração estrutural ou auditoria de conformidade arquitetural |
| 🗂️ `doc/architecture/historico/REFATORAÇÃO.md` | **HISTÓRICO.** Estado da refatoração original de `main.jsx` (18/18 concluídas) | Raramente — refatoração encerrada |
| `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` | **Auditoria oficial de LGPD, segurança e governança** — não conformidades, matriz de dados, riscos | Antes de qualquer alteração que envolva coleta, armazenamento ou compartilhamento de dados |
| `doc/lgpd/PLANO_DE_ACAO_LGPD.md` | **Plano de ação executável** — checklist rastreável de todas as correções LGPD/segurança com status (PA-01 a PA-22) | Ao implementar qualquer correção de conformidade ou segurança |
| `doc/lgpd/RIPD.md` | PA-17/LGPD — Relatório de Impacto à Proteção de Dados Pessoais | Antes de avaliar risco de um novo tratamento de dados pessoais |
| `doc/lgpd/ROPA.md` | PA-18/LGPD — Registro de Operações de Tratamento de Dados Pessoais | Antes de mapear ou alterar um fluxo de dados pessoais |
| `doc/lgpd/POLITICA_DE_PRIVACIDADE.md` | PA-16/LGPD — Política de Privacidade RJNet Telecomunicações | Antes de alterar o texto público de privacidade ou o consentimento exibido ao titular |
| `doc/lgpd/PLANO_INCIDENTES.md` | PA-20/LGPD — Plano de Resposta a Incidentes de Dados Pessoais | Em caso de incidente/vazamento, ou antes de alterar o processo de resposta |
| `doc/lgpd/ROTEIRO_DSAR.md` | PA-15/LGPD — Procedimentos para exercício dos direitos do art. 18 da LGPD (acesso, correção, exclusão) | Ao atender uma solicitação de titular |
| `doc/lgpd/DPA_FORNECEDORES.md` | PA-14/LGPD — Registro de acordos de processamento de dados com fornecedores que recebem dados pessoais de titulares brasileiros | Antes de contratar/alterar um fornecedor que processe dados pessoais |
| `doc/lgpd/PENDENCIAS_POS_AUDITORIA.md` | Checklist de pendências pós-auditoria (gerado em 2026-06-16) — blocos técnico/organizacional/decisão especial; **contém itens ainda em aberto** (ver "Painel de Status Consolidado" — itens 🟡/🔴 — em `PLANO_DE_ACAO_LGPD.md`) — não mover para histórico enquanto isso não for resolvido | Ao planejar o fechamento das pendências organizacionais/jurídicas de LGPD |
| `doc/performance/TECHNICAL_BACKLOG.md` | **Backlog técnico de performance** — TB-001 a TB-012 priorizados (Crítico/Alto/Médio/Baixo) | Antes de qualquer sprint de performance |
| `doc/performance/PERFORMANCE_AUDIT.md` | Auditoria estática de performance — findings PA-001 a PA-NEW-001 | Referência histórica de findings |
| `doc/performance/PERFORMANCE_REVIEW.md` | Revisão/validação de cada achado de `PERFORMANCE_AUDIT.md` (confirmado/falso positivo/parcial) | Depois de `PERFORMANCE_AUDIT.md`, antes de priorizar um achado |
| `doc/performance/QUICK_WINS.md` | Quick wins de performance — QW-001 a QW-006 com status de implementação | Antes de implementar melhorias de performance |
| `doc/performance/ARCHITECTURE_TEST_SUMMARY.md` | Resumo arquitetural para testes de performance, baseado em SYSTEM_MAP/DECISIONS/SUPABASE/CLAUDE.md | Antes de preparar um cenário de teste de carga |
| `doc/performance/HOMOLOGATION_CHECKLIST.md` | Checklist de preparação do ambiente de homologação para testes de carga | Antes de executar qualquer cenário de teste |
| `doc/performance/LOAD_TEST_PLAN.md` | Plano de testes de carga — 4 cenários k6 (Normal, Pico, Crítico, Estresse) | Antes de executar testes |
| `doc/performance/LOAD_TEST_COST_ESTIMATE.md` | Estimativa de impacto e custo dos testes de carga no ambiente de homologação (Supabase Free Tier) | Antes de autorizar a execução de um cenário de teste |
| `tests/load/README.md` | Instruções de execução dos testes de carga k6 — pré-requisitos, comandos por cenário, cleanup obrigatório | Ao executar fisicamente um cenário de teste de carga |
| `doc/performance/LOAD_TEST_REPORT.md` | Template de relatório de resultados dos testes de carga — preencher após cada execução | Após cada execução de testes; ⏸️ ainda não preenchido |
| `doc/performance/HYPOTHESIS_VALIDATION.md` | Hipóteses a validar no Cenário A — template de preenchimento pós-execução | Após execução do Cenário A; ⏸️ ainda não preenchido |
| `doc/performance/PERFORMANCE_HISTORY.md` | Histórico de evolução da performance ao longo do tempo — atualizar após cada execução de testes de carga | Após cada execução de testes; ⏸️ ainda não preenchido |
| `doc/ui/UI_VERSIONS.md` | **Catálogo de versões de UI/UX** — paleta, navegação, telas, componentes, padrões de UX por versão. **V3 é a versão atual em produção** (redesign visual, 2026-06-18); V2 foi implementada por completo (22/22 etapas) e depois superada pela V3 no mesmo dia | Antes de qualquer mudança de interface; ao iniciar nova versão de UI |
| `doc/ui/UX_UI_V3_PROPOSAL.md` | Proposta de redesign visual da V3 — **versão atual em produção** | Antes de qualquer mudança visual na interface corrente |
| `doc/ui/UX_UI_V3_IMPLEMENTATION_PLAN.md` | Plano de implementação da V3 — fases de execução do redesign vigente | Antes de qualquer mudança visual na interface corrente |
| `doc/ui/UX_UI_V3_CHANGELOG.md` | Changelog de implementação da V3 — hashes git, arquivos alterados, comandos de rollback | Referência para rollback pontual de um item da V3 |
| 🗂️ `doc/ui/historico/UX_UI_V2_PROPOSAL.md` | **HISTÓRICO.** Proposta estratégica da V2 — auditoria, problemas, proposta por tela, design system, roadmap em 3 fases. Totalmente implementada e já superada pela V3; mantida como referência de diagnóstico de UX, não como pendência | Consulta histórica de diagnóstico de UX |
| 🗂️ `doc/ui/historico/UX_UI_V2_IMPLEMENTATION_PLAN.md` | **HISTÓRICO.** Plano de implementação da V2 — 22 etapas em 3 fases (A: CSS, B: reorganização, C: componentes). Status: 22/22 concluídas (ver changelog) | Consulta histórica |
| 🗂️ `doc/ui/historico/UX_UI_V2_CHANGELOG.md` | **HISTÓRICO.** Changelog de implementação da V2 — cada etapa com hash git, arquivos alterados, status e comandos de rollback. 22/22 etapas concluídas em 2026-06-18, nenhuma revertida | Consulta histórica / rollback pontual de um item específico da V2 |

---

## Estrutura do Projeto

> **Refatoração concluída** — 18/18 etapas executadas. Ver `doc/architecture/historico/REFATORAÇÃO.md`.

```
src/
├── main.jsx              # Ponto de entrada (~35 linhas) — ErrorBoundary + ReactDOM.createRoot
├── index.css             # Estilos globais (tema dark)
├── api/
│   ├── eventoApi.js      # Factory createEventoApi — CRUD de eventos (etapa 17)
│   ├── leadApi.js        # Factory createLeadApi — CRUD de leads (etapa 17)
│   ├── materialApi.js    # Factory createMaterialApi — CRUD de materiais (etapa 17)
│   ├── vendedorApi.js    # Factory createVendedorApi — CRUD de vendedores (etapa 17)
│   ├── ofertaApi.js      # Factory createOfertaApi — ofertas por serviço + registro de envio (D-057)
│   ├── equipeApi.js      # Factory createEquipeApi — CRUD de usuários Auth com RBAC (modo Supabase)
│   ├── formularioApi.js  # Factory createFormularioApi — CRUD de formulários do Form Builder (D-062)
│   ├── campoPersonalizadoApi.js # Factory createCampoPersonalizadoApi — campos personalizados reutilizáveis (D-063)
│   └── simuladorApi.js   # Factory createSimuladorApi — campanhas do Simulador, 3 tipos oferta/demanda/quiz (D-072, D-076, D-080)
├── context/
│   ├── AppContext.js     # createContext — definição do AppContext (etapa 16)
│   ├── AppProvider.jsx   # Provider: orquestra estado + chama factories de API (etapas 16–17)
│   └── index.js          # Re-exports de context (etapa 16)
├── apps/
│   ├── Root.jsx          # Roteador raiz: detecta modo e dark mode (etapa 14)
│   ├── MarketingApp.jsx  # Shell do usuário marketing: navegação, tabs, dark mode (etapa 14)
│   ├── ComercialApp.jsx  # Shell do gerente comercial: Início/Eventos/Ofertas/Relatórios, sem estoque/equipe/monitor (D-059)
│   └── VendedorApp.jsx   # Shell completo do vendedor + LeadEditInline + OfertaPickerModal (etapa 13, D-057)
├── auth/
│   ├── Login.jsx         # Formulário de login modo legado (etapa 8)
│   ├── LoginAuth.jsx     # Formulário de login Supabase + recuperação de senha (etapa 8)
│   ├── NovaSenha.jsx     # Formulário de redefinição de senha por link (etapa 8)
│   ├── RootAuth.jsx      # Roteador de auth modo Supabase (etapa 8)
│   ├── RootLegacy.jsx    # Roteador de auth modo legado (etapa 8)
│   └── index.js          # Re-exports de auth (etapa 8)
├── components/
│   ├── ui.jsx            # Icon, StatusBadge, TipoBadge, Kpi, ChartView (etapa 6)
│   ├── SyncBadge.jsx     # Indicador visual de sincronização (etapa 7)
│   └── modals/
│       ├── EventModal.jsx             # Modal de criação/edição de evento (etapa 9)
│       ├── MaterialModal.jsx          # Modal de criação/edição de material — modo dual via prop `material` (etapa 9, D-056)
│       ├── MaterialChecklistModal.jsx # Importação em lote: 14 itens pré-definidos, marketing only (D-053)
│       ├── OfertaModal.jsx            # Edição de oferta (imagem+copy) por serviço, marketing only (D-057)
│       └── index.js                   # Re-exports de modais (etapa 9)
├── features/
│   ├── events/
│   │   ├── Dashboard.jsx     # KPIs, gráfico de leads, próximos eventos; cards clicáveis Evento/Mês (etapa 10, D-060)
│   │   ├── EventosTab.jsx    # Lista de eventos com filtros de status (etapa 10)
│   │   ├── EventDetail.jsx   # Detalhe do evento, materiais e leads (etapa 10)
│   │   └── index.js          # Re-exports de events (etapa 10)
│   ├── inventory/
│   │   ├── EstoqueTab.jsx    # Gestão de materiais por nível de estoque (etapa 11)
│   │   └── index.js          # Re-export de inventory (etapa 11)
│   ├── offers/
│   │   ├── OfertasTab.jsx    # Lista fixa (5 serviços): oferta ativa por serviço, marketing only (D-057)
│   │   └── index.js          # Re-export de offers (D-057)
│   ├── leads/
│   │   ├── LeadsTab.jsx      # Filtros, gráfico e exportação CSV de leads (etapa 11)
│   │   ├── MesDetail.jsx     # Detalhe do mês: leads por vendedor + tabela agrupada por dia (accordion, com horário), espelha EventDetail sem materiais (D-060, D-066, D-068)
│   │   └── index.js          # Re-export de leads (etapa 11)
│   ├── checkin/
│   │   ├── CheckinTab.jsx    # Busca de lead por CPF em evento (etapa 11)
│   │   └── index.js          # Re-export de checkin (etapa 11)
│   ├── team/
│   │   ├── EquipeTab.jsx     # Gestão de vendedores modo local (etapa 12)
│   │   ├── EquipeAuthTab.jsx # Gestão de usuários com RBAC modo Supabase (etapa 12)
│   │   └── index.js          # Re-exports de team (etapa 12)
│   ├── monitoring/
│   │   ├── MonitoringTab.jsx # Diagnóstico ao vivo: cards, feed 9 tipos, toolbar sessão ▶/■, limpar log (D-044–D-051)
│   │   └── index.js          # Re-export de monitoring (D-044)
│   ├── formularios/
│   │   ├── FormBuilderTab.jsx # CRUD de formulários + CamposPersonalizadosManager; cada formulário já gera seu próprio QR Code/link, marketing only (D-062, D-063, D-065)
│   │   └── index.js          # Re-export de formularios (D-062)
│   └── simulador/
│       ├── SimuladorTab.jsx  # Campanhas do Simulador (tipos Oferta/Demanda): CRUD + construtor de perguntas + QR (UTM impresso embutido) + link, marketing only (D-072, D-075, D-076)
│       └── index.js          # Re-export de simulador (D-072)
├── public/
│   ├── FormularioPublico.jsx   # Página pública dinâmica do Form Builder, sem sessão (D-062, D-063)
│   └── SimuladorPublico.jsx    # Página pública — 3 fluxos independentes (Oferta: quiz→perfil deduzido→pacote+combo; Demanda: perguntas→mensagem; Quiz: perguntas→faixa+resumo compartilhável), captura UTM (D-072, D-076, D-077, D-080, D-082)
├── hooks/
│   ├── useApp.js         # Hook useApp() — wrapper de useContext(AppContext) (etapa 7)
│   ├── usePersisted.js   # Hook de sincronização de estado com localStorage/sessionStorage (etapa 15)
│   └── useRanking.js     # Hook de polling de ranking com debounce e cleanup automático (etapa 15)
├── utils/
│   ├── format.js         # fmtDate, fmtDateLong, initials, label maps (etapa 1)
│   ├── masks.js          # maskCpf, maskTel, validarCpf, validarTelefone (etapa 2)
│   ├── csv.js            # exportLeadsCSV (etapa 3)
│   ├── ids.js            # genId(prefix) — gerador de IDs temporários para modo local
│   └── mockData.js       # MOCK_MATERIAIS, MOCK_VENDEDORES, MOCK_EVENTOS, MOCK_LEADS (etapa 4)
└── lib/
    ├── supabase.js       # Inicialização do cliente Supabase + supabaseEnabled
    ├── mode.js           # isSupabaseMode(), getMode(), MODE — detecção centralizada de modo (etapa 18)
    ├── dataService.js    # Camada de dados (queries, auth, realtime, retry)
    ├── activityLog.js    # Buffer localStorage + Supabase Realtime broadcast canal rjnet-monitor (D-044, D-045, D-046)
    ├── crypto.js         # PA-05/LGPD: AES-GCM 256 + PBKDF2 para criptografia da fila offline
    ├── security.js       # Sanitização e XSS prevention
    ├── cache.js          # Cache em memória com TTL
    ├── localPublicSubmit.js # Fallback local (sem Supabase) para as páginas públicas (Form Builder, Simulador) — dev/teste only (D-062, D-072)
    ├── simulador.js      # Catálogo fixo PERGUNTAS_SIMULADOR + scoring (calcularPerfil/resumoPerfil) — sem imports, espelhado em Deno (D-072)
    └── constants.js      # Constantes globais — SYNC_STATUS, STATUS_EVENTO, NIVEL_ESTOQUE, CAMPOS_FORMULARIO (etapas 5, D-062)

supabase/
├── schema.sql               # Schema inicial (4 tabelas + seed)
├── migracao-auth.sql        # RLS policies + integração Auth
├── protecao-dados.sql       # Soft delete
├── migracao-ofertas.sql     # Tabelas ofertas/oferta_envios + bucket Storage (D-057)
├── migracao-leads-mensais.sql  # Coluna mes_referencia + ranking_mes + retenção (D-058)
├── migracao-comercial.sql   # Papel comercial + RLS de eventos/ofertas/leads (D-059)
├── migracao-retencao.sql    # Retenção LGPD automática (PA-10)
├── migracao-qrcode.sql            # Colunas origem/qr_code_id/qr_code_label em leads + RLS ajustada (D-061)
├── migracao-qrcode-retencao.sql   # Retenção LGPD para leads sem evento/mês (D-061)
├── migracao-form-builder.sql      # Tabela formularios + RLS anon (D-062)
├── migracao-campos-personalizados.sql # Tabela campos_personalizados + RLS anon + leads.campos_extras (D-063)
├── migracao-moderacao-formulario.sql  # Coluna leads.origem_ip + índice para rate limit (D-067)
├── migracao-simulador.sql   # Tabela simuladores + colunas simulador_id/perfil_consumo/pontuacao/oferta_recomendada/cidade/utm em leads (D-072)
├── migracao-demanda.sql     # RPC demanda_por_regiao() — relatório interno de demanda por cidade/bairro (D-073)
├── migracao-simulador-perguntas.sql  # Coluna simuladores.perguntas (jsonb) — questionário próprio por campanha (D-075)
├── migracao-simulador-tipos.sql      # Migra tipo perfil_consumo/territorial → oferta/demanda + coluna mensagem_resultado (D-076)
├── migracao-simulador-quiz.sql       # 3º tipo 'quiz' + colunas simuladores.quiz_perguntas/quiz_faixas (D-080)
├── seed-usuarios-teste.sql
├── config.toml              # Config local do Supabase
└── functions/
    ├── _shared/captacao.ts               # CORS, sanitização, validadores e rate limit compartilhados das portas públicas (D-072)
    ├── atualizar-email-usuario/index.ts  # Edge Function (gerenciamento de usuários)
    ├── submeter-formulario/index.ts      # Edge Function pública — submissão do Form Builder; bloqueio de link, IP e rate limit (D-062, D-063, D-067)
    └── submeter-simulador/index.ts       # Edge Function pública — submissão do Simulador; ramifica por tipo oferta/demanda/quiz, recalcula perfil/score/acertos no servidor (D-072, D-076, D-077, D-080)

tests/
├── security.test.js      # E2E: SQL injection, XSS
├── security.unit.test.js # Unit: funções de sanitização
├── lead.unit.test.js     # Unit: validação de leads
├── simulador.unit.test.js # Unit: catálogo + scoring do Simulador (importa o módulo real, D-072)
├── simulador.test.js     # E2E: wizard público do Simulador em modo local (D-072)
├── comercial.test.js     # E2E: dashboard comercial
├── estoque.test.js       # E2E: inventário
├── marketing.test.js     # E2E: dashboard marketing
└── helpers/auth.js       # Helpers de autenticação para testes

data/
├── colaboradores.example.json
└── estoque.example.json
```

---

## Scripts

```bash
npm run dev          # Dev server em localhost:3000
npm run build        # Build de produção → dist/
npm run preview      # Preview do build

npm test             # E2E Playwright completo
npm run test:unit    # Testes unitários (security + lead)
npm run test:all     # Suite completa
npm run test:ui      # Playwright modo UI
npm run test:report  # Relatório HTML
npm run test:security # Testes de segurança E2E
```

---

## Variáveis de Ambiente

Copie `.env.example` para `.env.local` e preencha:

```bash
VITE_SUPABASE_URL=        # URL do projeto Supabase
VITE_SUPABASE_ANON_KEY=   # Chave pública anon

VITE_MARKETING_USER=marketing   # Modo local (sem Supabase)
VITE_MARKETING_PASS=

TEST_MARKETING_USER=marketing   # Credenciais para testes E2E
TEST_MARKETING_PASS=
```

Sem `VITE_SUPABASE_URL`, o app usa localStorage como fallback.

---

## Banco de Dados (Supabase / PostgreSQL)

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `materiais` | Estoque de materiais promocionais |
| `eventos` | Eventos (datas, local, tipo, status, materiais JSONB) |
| `leads` | Leads capturados por vendedor, vinculados a **evento OU mês de referência** (mutuamente exclusivos — D-058) |
| `perfis` | Perfis de usuários Auth (papel: marketing/vendedor/comercial) |
| `vendedores` | Tabela legada (substituída por `perfis` no modo Auth) |
| `ofertas` | Oferta ativa por serviço (imagem+copy), `servico` como PK — máx. 5 linhas (D-057) |
| `oferta_envios` | Indicador de clique em "Enviar oferta" por lead/serviço — não é confirmação de entrega; também aceita evento OU mês (D-057, D-058) |
| `formularios` | Formulários do Form Builder — nome, slug, campos escolhidos do catálogo fixo, campos personalizados vinculados, obrigatoriedade; leitura `anon` restrita a `ativo=true` (D-062) |
| `campos_personalizados` | Catálogo de campos de texto livre reutilizáveis entre formulários, criados pelo marketing; leitura `anon` restrita a `ativo=true` (D-063) |
| `simuladores` | Campanhas do Simulador — identidade (nome, slug, tipo, agrupador); tipo `oferta` usa quiz fixo em código (sem construtor); tipo `demanda` guarda seu PRÓPRIO questionário em `perguntas` (jsonb) + `mensagem_resultado`; tipo `quiz` guarda perguntas com resposta certa em `quiz_perguntas` (jsonb) + faixas de classificação em `quiz_faixas` (jsonb), editados pelo marketing; leitura `anon` restrita a `ativo=true` (D-072, D-075, D-076, D-080) |

### Enums usados nos dados

- **status evento:** `planejado`, `ativo`, `encerrado`
- **tipo evento:** `sinalizacao`, `presenca_comercial`, `ativacao_especial`
- **temperatura lead:** `frio`, `morno`, `quente`, `convertido`
- **serviços de interesse (array):** `internet_residencial`, `internet_empresarial`, `rjnet_movel`, `streamings`, `outro` — `servicoInteresse` é `string[]` no frontend; serializado como JSON string na coluna TEXT `servico_interesse` do banco (backward-compat com string simples legada)
- **metas do vendedor:** `META_BRONZE=20`, `META_PRATA=40`, `META_OURO=60` — `META_DIARIA` é alias de `META_OURO`
- **papel perfil:** `marketing`, `vendedor`, `comercial` (D-059 — mesmo nível do marketing em eventos/ofertas/leads, sem estoque nem gestão de equipe)
- **mês de referência do lead (D-058):** `mes_referencia` é `date` com o primeiro dia do mês (ex: `2026-07-01`); `leads.evento_id`/`leads.mes_referencia` são mutuamente exclusivos (`check (num_nonnulls(evento_id, mes_referencia) <= 1)` — relaxado de `= 1` para `<= 1` em D-061, permitindo leads sem nenhum dos dois: origem QR Code/Formulário)
- **atribuição do lead (D-061, D-062, D-063, D-072):** `origem` (`evento`/`mes`/`qrcode`/`formulario`/`simulador`), `qr_code_id`/`qr_code_label`, `formulario_id`, `simulador_id`, `bairro`/`cidade`, `campos_extras` (JSONB), `perfil_consumo`/`pontuacao`/`oferta_recomendada` (Simulador, calculados no servidor), `utm` (JSONB, atribuição de tráfego) — eixo ortogonal ao contexto operacional (evento/mês); leads de captação digital não têm `vendedor_id` até serem distribuídos pelo marketing/comercial

### RLS (Row Level Security)

- `marketing`: acesso total a todas as tabelas
- `comercial` (D-059): escreve em `eventos`, `ofertas` e `leads` no mesmo nível de `marketing` (inclusive leads de qualquer vendedor); **não** tem escrita em `materiais` (estoque) nem em `perfis` (gestão de equipe) — nessas duas, RLS continua restrita a `marketing`
- `vendedor`: leitura de todos os leads; escrita/edição apenas nos próprios leads — exige `vendedor_id is not null and vendedor_id = auth.uid()` (D-061: antes da atribuição, leads de QR Code/Formulário não têm `vendedor_id` e ficam visíveis só para marketing/comercial); regra idêntica para leads de evento ou de mês (D-058), RLS nunca depende de `evento_id`/`mes_referencia`
- `ofertas`: leitura para qualquer papel autenticado; escrita restrita a `marketing`/`comercial` (D-059)
- `oferta_envios`: leitura para marketing/vendedor; inserção pelo marketing (qualquer) ou vendedor (apenas com seu próprio `vendedor_id`)
- `formularios`/`campos_personalizados` (D-062, D-063): **primeiras policies `anon` do projeto** — leitura pública restrita a `ativo=true`, necessária para a página pública do Form Builder renderizar sem sessão; escrita restrita a `marketing`

### Storage

- Bucket `ofertas` (público) — imagens de oferta por serviço, path `<servico>.<ext>` (D-057). Escrita restrita a `marketing` via policies em `storage.objects`.

---

## Arquitetura

### Gerenciamento de Estado e Camada de Dados

Fonte oficial: `doc/architecture/SYSTEM_MAP.md` §2 "Arquitetura Atual" (auto-carregado no topo deste arquivo) — cobre `AppContext`/`AppProvider`/`usePersisted()`, atualizações otimistas, mapeamento camelCase↔snake_case, `withRetry()`, debounce de realtime e `AbortController`.

### Segurança

- `sanitizeText()` em todos os inputs antes de gravar no DB
- XSS prevenido por: auto-escaping do JSX + `escapeHtml()` explícito quando necessário
- SQL injection prevenido por: Supabase usa queries parametrizadas (sem concatenação)
- RLS como segunda linha de defesa
- Headers CSP, HSTS, X-Frame-Options configurados no `vercel.json`

### Performance

- Cache com TTL de 30s para rankings de eventos
- Chart.js destruído no unmount (evita memory leak)

---

## Módulos da UI

**Navegação do Marketing (D-065):** 3 botões diretos no header/bottom nav — Início, Eventos, Relatórios — e um botão "Mais" com dropdown (desktop)/bottom sheet (mobile) agrupado por categoria: **Captação** (Formulários), **Comercial** (Ofertas), **Operação** (Estoque, Check-in), **Sistema** (Equipe, Monitor). Comercial mantém os 4 botões diretos de sempre (sem "Mais"), Vendedor não muda.

| Tab | Papel | Funcionalidade |
|-----|-------|---------------|
| Dashboard | marketing, comercial | KPIs, gráfico de leads por serviço, alertas de estoque (leitura, mesmo para comercial) |
| Eventos | marketing, comercial | CRUD de eventos, alocação de materiais, resumo de leads por vendedor (D-059: comercial no mesmo nível do marketing) |
| Estoque | marketing | Gestão de materiais, status de disponibilidade |
| Ofertas | marketing, comercial | Oferta ativa por serviço (imagem 1080x1080 + copy), congelada para o vendedor consumir via WhatsApp (D-057, D-059) |
| Leads | marketing, comercial | Export CSV por evento e por mês de referência (D-058), auditoria de exportação (D-059: comercial edita/exclui leads de qualquer vendedor) |
| Equipe | marketing | CRUD de vendedores/usuários (comercial não gerencia equipe — D-059) |
| Formulários | marketing | Form Builder — criação de formulários dinâmicos (catálogo fixo de campos + campos personalizados reutilizáveis); cada formulário já gera seu próprio QR Code/link para divulgação (D-062, D-063; absorve o antigo gerador de QR Code standalone, retirado em D-065) |
| Simulador | marketing | 3 tipos de campanha independentes: **Oferta** (quiz fixo de qualificação → perfil deduzido → pacote + combo de upsell, incluindo plano Móvel), **Demanda** (perguntas configuráveis com peso → mensagem de resultado personalizada) e **Quiz de Acertos** (perguntas com resposta certa/errada → faixa de classificação editável, ex: evento MotoFest) — este último ganha também um Sorteador entre participantes; cada campanha gera link (tráfego pago) e QR Code (impresso, UTMs embutidos); leads chegam com perfil/pontuação/temperatura calculados no servidor e caem na fila de distribuição (D-072, D-074–D-077, D-080) |
| Monitor | marketing | Diagnóstico ao vivo (3 canais: CustomEvent/storage/Realtime) + histórico 30 dias, cards, feed 7 tipos (D-044–D-046); restrito ao marketing (D-059) |

---

## Autenticação

Dois modos:

1. **Local:** Credenciais simples (`VITE_MARKETING_USER` / `VITE_MARKETING_PASS`), sem Supabase
2. **Supabase Auth:** Login email/senha com RBAC via RLS — recomendado para produção

---

## Setup para Produção (Supabase)

1. Executar `supabase/schema.sql` no SQL Editor do Supabase
2. Executar `supabase/migracao-auth.sql` para Auth + RLS
3. Criar primeiro usuário marketing:
   ```sql
   UPDATE perfis SET papel = 'marketing', ativo = true WHERE email = 'seu@email.com';
   ```
4. Configurar variáveis de ambiente na Vercel (Settings → Environment Variables)
5. Deploy automático ao fazer push na branch principal

---

## Testes

### E2E (Playwright)

Dois servidores configurados no `playwright.config.js`:
- `localhost:3000` — modo local (localStorage, sem Supabase)
- `localhost:3001` — modo Supabase simulado (env mocked, REST interceptado via `page.route`)

Execução sequencial (1 worker) para evitar conflitos de estado React.

### Unitários (Node.js)

```bash
node tests/security.unit.test.js  # sanitização e validação
node tests/lead.unit.test.js       # validação de leads
```

---

## Deploy (Vercel)

- Build: `npm run build` → `dist/`
- Headers de segurança aplicados via `vercel.json`:
  - CSP com `connect-src` permitindo `*.supabase.co`
  - `X-Frame-Options: DENY`, HSTS, `nosniff`, `Permissions-Policy`

---

## Arquivos Críticos

| Arquivo | Linhas | Propósito |
|---------|--------|-----------|
| `src/main.jsx` | ~35 | ErrorBoundary + ponto de entrada React |
| `src/api/eventoApi.js` | ~22 | Factory CRUD de eventos (etapa 17) |
| `src/api/leadApi.js` | ~76 | Factory CRUD de leads + `obterRanking`/`obterRankingMes` (etapa 17, D-058) |
| `src/api/materialApi.js` | ~30 | Factory CRUD de materiais e materiais de evento (etapa 17) |
| `src/api/vendedorApi.js` | ~18 | Factory CRUD de vendedores (etapa 17) |
| `src/api/ofertaApi.js` | ~20 | Factory de ofertas por serviço + registro de envio (D-057) |
| `src/api/equipeApi.js` | ~29 | Factory createEquipeApi — CRUD de usuários Auth com RBAC (modo Supabase) |
| `src/api/formularioApi.js` | ~22 | Factory createFormularioApi — CRUD de formulários do Form Builder (D-062) |
| `src/api/campoPersonalizadoApi.js` | ~31 | Factory createCampoPersonalizadoApi — CRUD de campos personalizados reutilizáveis (D-063) |
| `src/api/simuladorApi.js` | ~40 | Factory createSimuladorApi — CRUD de campanhas do Simulador; semeia perguntas/mensagem pra tipo demanda, quizPerguntas/quizFaixas pra tipo quiz (D-072, D-076, D-080) |
| `src/lib/simulador.js` | ~541 | Catálogos PERGUNTAS_OFERTA (fixo), PACOTES_INTERNET/APPS_ADICIONAIS/PLANOS_MOVEL, quizPerguntasPadrao/quizFaixasPadrao/corrigirQuiz/faixaPorAcertos, perfilPorRespostasOferta/calcularPerfilDinamico/resumoPerfil — sem imports, testável standalone e espelhado em Deno (D-072, D-074, D-075, D-077, D-080) |
| `src/public/SimuladorPublico.jsx` | ~727 | Página pública — 3 fluxos independentes por tipo de campanha (Oferta: quiz→perfil deduzido→pacote+combo; Demanda: perguntas→mensagem; Quiz: perguntas certo/errado→faixa de acertos + CTA de sorteio + resumo compartilhável em canvas), captura de UTM, honeypot, logo centralizada e checkbox LGPD sem overflow no mobile (D-072, D-076, D-077, D-080, D-081, D-082) |
| `src/features/simulador/SimuladorTab.jsx` | ~592 | Gestão de campanhas (tipos Oferta/Demanda/Quiz): CRUD + construtor de perguntas/mensagem/faixas + Sorteador + QR com UTM impresso embutido + link, marketing only (D-072, D-075, D-076, D-080) |
| `supabase/migracao-simulador.sql` | ~95 | Tabela simuladores + RLS anon + colunas do Simulador em leads + índices (D-072) |
| `supabase/migracao-simulador-perguntas.sql` | ~30 | Coluna simuladores.perguntas (jsonb) — questionário próprio por campanha (D-075) |
| `supabase/migracao-simulador-tipos.sql` | ~40 | Migra tipo perfil_consumo/territorial → oferta/demanda + coluna mensagem_resultado (D-076) |
| `supabase/migracao-simulador-quiz.sql` | ~45 | 3º tipo 'quiz' na constraint + colunas simuladores.quiz_perguntas/quiz_faixas (D-080) |
| `supabase/functions/_shared/captacao.ts` | ~80 | Miolo compartilhado das Edge Functions públicas: CORS, sanitização, containsLink, rate limit por IP (D-072) |
| `supabase/functions/submeter-simulador/index.ts` | ~461 | Edge Function pública — ramifica por tipo (oferta: deduz perfil do quiz fixo; demanda: recalcula score das perguntas da campanha; quiz: recalcula acertos/faixa), nunca aceita perfil/score/acertos pronto do cliente, sanitiza UTM (D-072, D-076, D-077, D-080) |
| `src/context/AppProvider.jsx` | ~161 | Provider: orquestra estado, efeitos e factories de API; `carregarLeadsMes` + contexto de refetch dual evento/mês (etapas 16–17, D-058) |
| `src/apps/VendedorApp.jsx` | ~884 | Shell completo do vendedor + LeadEditInline + OfertaPickerModal; seletor Evento/Atividade do Mês (etapa 13, D-057, D-058) |
| `src/apps/ComercialApp.jsx` | ~67 | Shell do gerente comercial: Início/Eventos/Ofertas/Relatórios, sem estoque/equipe/monitor (D-059); `abrirEvento` para o card de evento do Início — card de mês fica embutido no próprio `Dashboard.jsx` (D-060) |
| `src/auth/Login.jsx` | ~55 | Login modo legado (etapa 8) |
| `src/auth/LoginAuth.jsx` | ~75 | Login Supabase + recuperação de senha (etapa 8) |
| `src/auth/NovaSenha.jsx` | ~55 | Redefinição de senha por link (etapa 8) |
| `src/auth/RootAuth.jsx` | ~48 | Roteador de auth modo Supabase; 3 papéis — marketing/comercial/vendedor (etapa 8, D-059) |
| `src/auth/RootLegacy.jsx` | ~25 | Roteador de auth modo legado (etapa 8) |
| `src/components/ui.jsx` | ~80 | Componentes UI atômicos extraídos (etapa 6) |
| `src/components/SyncBadge.jsx` | ~14 | Indicador de sincronização (etapa 7) |
| `src/components/modals/EventModal.jsx` | ~90 | Modal de criação/edição de evento (etapa 9) |
| `src/components/modals/MaterialModal.jsx` | ~55 | Modal de criação/edição de material — modo dual via prop `material` (etapa 9, D-056) |
| `src/components/modals/MaterialChecklistModal.jsx` | ~100 | Importação em lote de materiais: 14 itens pré-definidos, seleção + ajuste de quantidade (D-053, marketing only) |
| `src/components/modals/OfertaModal.jsx` | ~65 | Upload de imagem (1080x1080) + copy por serviço, marketing only (D-057) |
| `src/features/offers/OfertasTab.jsx` | ~65 | Lista fixa das 5 ofertas por serviço, marketing only (D-057) |
| `src/features/events/Dashboard.jsx` | ~175 | KPIs, gráfico donut, próximos eventos; 2 hero cards clicáveis Evento/Mês via `obterRanking`/`obterRankingMes`; card de mês abre `MesDetail` embutido, sem trocar de aba (etapa 10, D-060) |
| `src/features/events/EventosTab.jsx` | ~60 | Lista de eventos com filtros (etapa 10) |
| `src/features/events/EventDetail.jsx` | ~175 | Detalhe do evento, materiais e leads (etapa 10) |
| `src/features/leads/MesDetail.jsx` | ~188 | Detalhe do mês: leads por vendedor + tabela agrupada por dia num accordion (`"Hoje"`/`"Ontem"`, dia mais recente aberto por padrão, busca expande dias com match, coluna "Horário" + leads ordenados do mais recente pro mais antigo dentro do dia), espelha `EventDetail.jsx` sem materiais (D-060, D-066, D-068) |
| `src/features/formularios/FormBuilderTab.jsx` | ~243 | CRUD de formulários + `CamposPersonalizadosManager`; cada formulário já gera seu próprio QR Code/link, marketing only (D-062, D-063, D-065) |
| `src/public/FormularioPublico.jsx` | ~242 | Página pública dinâmica do Form Builder, sem sessão, sem `AppContext` (D-062, D-063); bloqueio de link em texto livre no client (D-067); logo centralizada e checkbox LGPD sem overflow no mobile (D-081) |
| `src/lib/localPublicSubmit.js` | ~37 | Fallback local (sem Supabase) para páginas públicas, dev/teste only (D-061, D-062) |
| `src/hooks/useApp.js` | ~8 | Hook de acesso ao contexto (etapa 7) |
| `src/hooks/usePersisted.js` | ~26 | Hook de persistência em localStorage/sessionStorage (etapa 15) |
| `src/hooks/useRanking.js` | ~42 | Hook de polling de ranking com debounce e cleanup; parâmetro `obterFn` opcional reaproveitado para o placar por mês (etapa 15, D-058) |
| `src/utils/format.js` | ~48 | Formatação de datas, labels e iniciais; `mesesDoAno`/`mesReferenciaLabel`/`mesAtualRef` (etapa 1, D-058, D-060) |
| `src/utils/masks.js` | ~34 | Máscaras e validadores de CPF/telefone (etapa 2) |
| `src/utils/csv.js` | ~98 | Exportação CSV de leads por evento e por mês (etapa 3, D-058) |
| `src/utils/mockData.js` | ~57 | Dados mock para modo local (etapa 4) |
| `src/utils/ids.js` | ~2 | `genId(prefix)` — gerador de IDs temporários para modo local |
| `src/lib/constants.js` | ~29 | Constantes centralizadas (etapa 5) |
| `src/lib/mode.js` | ~10 | Detecção de modo Supabase/local centralizada (etapa 18) |
| `src/lib/dataService.js` | ~890 | Queries Supabase, auth, realtime, retry; `exec()` com onSuccess para lead_sync_ok (D-044b); fetch/ranking por mês em paralelo ao de evento (D-058); `origem_ip` em `LEADS_COLS`/`leadFromDb`/`leadToDb` (D-067) |
| `src/lib/activityLog.js` | ~100 | Buffer localStorage + Supabase Realtime broadcast + receiveActivityLog (D-044, D-045, D-046) |
| `src/features/monitoring/MonitoringTab.jsx` | ~460 | Monitor: 3 listeners (CustomEvent/storage/Realtime), histórico por dia, cards com status de atividade, feed 9 tipos, perf tiers, toolbar sessão, limpar log (D-044–D-051) |
| `src/lib/security.js` | ~57 | Sanitização de inputs; `containsLink()` detecta URL em texto livre (D-067) |
| `supabase/schema.sql` | ~135 | Schema e seed |
| `supabase/migracao-auth.sql` | ~195 | RLS e Auth |
| `supabase/migracao-ofertas.sql` | ~75 | Tabelas ofertas/oferta_envios, RLS e bucket Storage (D-057) |
| `supabase/migracao-leads-mensais.sql` | ~122 | Coluna `mes_referencia`, constraint de exclusividade, RPC `ranking_mes`, retenção LGPD estendida (D-058) |
| `supabase/migracao-comercial.sql` | ~94 | Papel `comercial` + RLS de `eventos`/`ofertas`/`leads`/bucket Storage (D-059) |
| `supabase/migracao-qrcode.sql` | ~68 | Colunas `origem`/`qr_code_id`/`qr_code_label`, constraint relaxada, RLS de visibilidade (D-061) — colunas seguem ativas (compartilhadas com origem `formulario`) mesmo após D-065 retirar o gerador standalone |
| `supabase/migracao-qrcode-retencao.sql` | ~86 | Retenção LGPD para leads sem evento/mês (D-061) |
| `supabase/migracao-form-builder.sql` | ~78 | Tabela `formularios`, colunas `formulario_id`/`bairro` em `leads`, RLS `anon` (D-062) |
| `supabase/migracao-campos-personalizados.sql` | ~63 | Tabela `campos_personalizados`, colunas em `formularios`/`leads`, RLS `anon` (D-063) |
| `supabase/functions/submeter-formulario/index.ts` | ~251 | Edge Function pública — submissão do Form Builder + campos personalizados (D-062, D-063); bloqueio de link, captura de IP e rate limit (D-067) |
| `supabase/migracao-moderacao-formulario.sql` | ~40 | Coluna `leads.origem_ip` + índice para rate limit (D-067) |
| `vercel.json` | ~35 | Headers CSP e segurança (img-src ampliado para Storage, D-057); rewrite SPA para `/f/:path*` (D-062; a rewrite `/qr/:path*` foi retirada em D-065) |
| `playwright.config.js` | ~71 | Config E2E dual-server |
