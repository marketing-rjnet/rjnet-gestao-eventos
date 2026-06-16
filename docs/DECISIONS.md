# DECISIONS.md

## Objetivo

Este documento é a fonte oficial das decisões arquiteturais, técnicas e estratégicas tomadas durante a evolução do sistema RJNet Gestão de Eventos. Seu propósito é preservar o raciocínio por trás de cada escolha relevante, evitar que decisões passadas sejam revertidas inadvertidamente e acelerar o onboarding de novas sessões de IA ou desenvolvedores.

---

## Regras de Atualização

Este documento deve ser atualizado sempre que ocorrer:

- Nova feature relevante
- Mudança de arquitetura
- Refatoração estrutural
- Mudança de padrão de código
- Mudança de estratégia de autenticação
- Mudança de estratégia de persistência
- Mudança de estratégia de cache
- Mudança de integração com Supabase
- Mudança de fluxo de dados
- Mudança de segurança
- Mudança de organização de diretórios

---

## Template de Registro

### Data

### Tipo

(Arquitetura | Refatoração | Segurança | Performance | Feature | Infraestrutura)

### Decisão

Descrição objetiva.

### Motivação

Por que a decisão foi tomada.

### Alternativas Avaliadas

Lista das alternativas consideradas.

### Impactos

Benefícios e consequências.

### Arquivos Afetados

Lista dos arquivos envolvidos.

### Riscos

Riscos conhecidos.

### Status

- Ativa
- Substituída
- Obsoleta

---

## Histórico de Decisões

---

### [D-031] — Auditoria de LGPD, segurança e governança de dados

**Data:** 2026-06-16

**Tipo:** Segurança / Governança / Compliance

**Decisão:**
Realização de auditoria completa de LGPD, segurança da informação, governança de dados e arquitetura Supabase do sistema. Os resultados foram documentados em `docs/LGPD_AUDIT_AND_COMPLIANCE.md` como fonte oficial de conformidade. Um plano de ação executável com 21 itens foi criado em `docs/PLANO_DE_ACAO_LGPD.md`.

**Motivação:**
O sistema trata dados pessoais de cidadãos (titulares externos) capturados durante eventos comerciais, sem mecanismo de consentimento implementado. A auditoria foi necessária para identificar e priorizar as não conformidades com a LGPD (Lei 13.709/2018) e com as boas práticas de segurança da informação.

**Principais não conformidades identificadas:**
- Ausência total de consentimento LGPD para coleta de dados de leads (L-01)
- Senha de marketing exposta no bundle JavaScript público via `VITE_MARKETING_PASS` (S-01)
- Policies anônimas no `schema.sql` que concedem acesso total sem autenticação se `migracao-auth.sql` não estiver aplicado (BD-01)
- CORS aberto na Edge Function administrativa (S-04)
- Sem log de exportações CSV contendo dados pessoais (A-01)
- Sem política de retenção de dados (L-04)
- Transferência internacional de dados sem DPA com Supabase Inc. (L-07)

**Nota geral de conformidade obtida:** 4,2 / 10

**Plano de ação:** 21 ações organizadas em 4 fases (imediata, curto, médio e longo prazo). Ver `docs/PLANO_DE_ACAO_LGPD.md` para o plano completo com responsáveis, prazos e evidências.

**Alternativas Avaliadas:**
Correção pontual de itens críticos sem auditoria formal — descartada pois não garante visão completa dos riscos nem conformidade sistêmica.

**Impactos:**
- Cria a base documental obrigatória para eventual fiscalização pela ANPD
- Define roteiro técnico claro para elevar a nota de conformidade de 4,2 para 8,7 (após Fase 4)
- Incorpora `docs/LGPD_AUDIT_AND_COMPLIANCE.md` e `docs/PLANO_DE_ACAO_LGPD.md` como documentos obrigatórios de referência no `CLAUDE.md`

**Arquivos afetados:**
- `docs/LGPD_AUDIT_AND_COMPLIANCE.md` (criado)
- `docs/PLANO_DE_ACAO_LGPD.md` (criado)
- `CLAUDE.md` (atualizado — tabela de referência de documentação)

**Riscos:**
- Ações do plano não implementadas geram risco regulatório contínuo
- Sem DPO nomeado, a execução do plano pode ficar sem responsável formal

**Status:** Ativa

---

### [D-001] — Arquitetura monolítica inicial em `src/main.jsx`

**Data:** Pré-15/06/2026 (estado inicial do projeto)

**Tipo:** Arquitetura

**Decisão:**
Todo o código do frontend foi inicialmente colocado em um único arquivo `src/main.jsx` (~2.354 linhas), incluindo componentes, contexto, hooks, constantes e lógica de negócio.

**Motivação:**
Velocidade de desenvolvimento inicial. Em projetos pequenos ou MVPs, um único arquivo elimina a sobrecarga de decisões de organização e permite iteração rápida.

**Alternativas Avaliadas:**
- Estrutura modular desde o início (descartada pela complexidade inicial)
- Estrutura por domínio (descartada por overhead prematuro)

**Impactos:**
- Positivo: desenvolvimento inicial ágil, sem fricção de imports
- Negativo: arquivo cresceu para ~2.354 linhas, dificultando manutenção, revisões e onboarding

**Arquivos Afetados:**
- `src/main.jsx`

**Riscos:**
- Arquivo tornou-se difícil de navegar e revisar
- Risco de regressões ao alterar qualquer parte do monolítico

**Status:** Substituída (por decisão D-002 — refatoração progressiva)

---

### [D-002] — Refatoração progressiva sem alteração de comportamento

**Data:** 15/06/2026

**Tipo:** Arquitetura / Refatoração

**Decisão:**
Adotar refatoração progressiva em 18 etapas para decompor `src/main.jsx` em módulos coesos, sem alterar nenhum comportamento, regra de negócio ou melhoria funcional durante o processo.

**Motivação:**
O arquivo monolítico atingiu um tamanho (~2.354 linhas) que torna qualquer alteração arriscada. A refatoração progressiva permite reduzir o risco por etapa, com commits independentes e validações a cada passo.

**Alternativas Avaliadas:**
- Reescrever do zero (descartada — alto risco de regressão e perda de comportamentos implícitos)
- Refatoração em uma única sessão (descartada — risco excessivo sem checkpoints)
- Manter o monolítico (descartada — débito técnico crescente)

**Impactos:**
- Positivo: risco controlado por etapa; histórico de commits rastreável; sem downtime de funcionalidades
- Negativo: processo longo (18 etapas); importações temporárias cruzadas em etapas intermediárias (ex: `useApp.js` → `../main`)

**Arquivos Afetados:**
- `src/main.jsx` (arquivo de origem)
- Todos os arquivos criados ao longo das etapas (ver REFATORAÇÃO.md)

**Riscos:**
- Imports circulares temporários entre etapas (especialmente Etapa 7 e 16)
- Divergência entre o plano documentado e o estado real do código após cada sessão

**Status:** Ativa

---

### [D-003] — Modo dual: Supabase vs localStorage

**Data:** Pré-15/06/2026 (estado inicial do projeto)

**Tipo:** Arquitetura / Infraestrutura

**Decisão:**
O sistema opera em dois modos detectados em runtime pela presença da variável de ambiente `VITE_SUPABASE_URL`:
- **Modo Supabase:** dados persistidos no banco, auth com RBAC, realtime
- **Modo legado (local):** dados em localStorage, credenciais simples via `.env.local`

**Motivação:**
Permitir desenvolvimento e demonstração sem dependência de credenciais Supabase, e ao mesmo tempo suportar produção com todos os recursos de segurança e persistência.

**Alternativas Avaliadas:**
- Sempre exigir Supabase (descartada — bloqueia desenvolvimento e demo)
- Sempre usar localStorage (descartada — não escala para múltiplos usuários/dispositivos)
- Feature flag explícita (descartada — variável de ambiente já cumpre esse papel)

**Impactos:**
- Positivo: onboarding sem fricção; desenvolvimento offline possível; fallback automático
- Negativo: lógica condicional duplicada em múltiplos arquivos (`AppProvider`, `Root`, `dataService`); testes E2E precisam de dois servidores (porta 3000 e 3001)
- **Atualização (Etapa 18, D-003a):** a duplicação foi eliminada — `src/lib/mode.js` centraliza a detecção de modo; todos os módulos importam `isSupabaseMode()` de `./mode` em vez de verificar `VITE_SUPABASE_URL` diretamente.

**Arquivos Afetados:**
- `src/lib/supabase.js`
- `src/lib/dataService.js`
- `src/main.jsx` (Root, AppProvider)
- `playwright.config.js`
- **`src/lib/mode.js`** (criado na Etapa 18 — centraliza a detecção)

**Riscos:**
- Divergência de comportamento entre os dois modos pode passar despercebida se testes não cobrirem ambos

**Status:** Ativa — consolidada na Etapa 18 via `src/lib/mode.js` (ver D-003a)

---

### [D-003a] — Centralização da detecção de modo em `src/lib/mode.js` (Etapa 18)

**Data:** 16/06/2026

**Tipo:** Refatoração / Arquitetura

**Decisão:**
Criado `src/lib/mode.js` exportando `isSupabaseMode()`, `getMode()` e a constante `MODE`. Todos os módulos que precisam detectar o modo ativo passam a importar `isSupabaseMode` de `./mode`, nunca acessando `supabaseEnabled` de `./supabase` ou `import.meta.env.VITE_SUPABASE_URL` diretamente.

**Motivação:**
A detecção de modo estava duplicada em `AppProvider`, `Root`, `dataService` e outros arquivos como verificação direta de `supabaseEnabled` ou `import.meta.env.VITE_SUPABASE_URL`. Qualquer mudança na lógica de detecção (ex.: novo critério, fallback, feature flag) obrigava alterar múltiplos arquivos. `mode.js` é o único ponto de mudança.

**Alternativas Avaliadas:**
- Manter verificações inline de `supabaseEnabled` em cada módulo (descartada — D-003 identificou isso como negativo explícito)
- Adicionar helpers em `supabase.js` (descartada — `supabase.js` inicializa o cliente; misturar helpers de modo acoplaria dois conceitos distintos)

**Impactos:**
- Positivo: ponto único de mudança para qualquer evolução na lógica de detecção de modo
- Positivo: módulos downstream não precisam importar de `supabase.js` — dependência mais estreita
- Positivo: elimina o negativo identificado em D-003 (duplicação em múltiplos arquivos)

**Arquivos Afetados:**
- `src/lib/mode.js` (criado)
- `src/context/AppProvider.jsx` (migrado para `isSupabaseMode()`)
- `src/apps/Root.jsx` (migrado)
- `src/apps/MarketingApp.jsx` (migrado)
- `src/components/SyncBadge.jsx` (migrado)
- `src/lib/dataService.js` (migrado)

**Riscos:**
- Nenhum — mudança puramente de indireção; comportamento idêntico

**Status:** Ativa

---

### [D-004] — RLS como segunda linha de defesa

**Data:** Pré-15/06/2026

**Tipo:** Segurança

**Decisão:**
Row Level Security (RLS) do Supabase é configurado como camada de segurança no banco, independente da lógica do frontend. O frontend sanitiza inputs, mas não é confiado como única barreira.

**Motivação:**
Qualquer vazamento de chave ou bypass do frontend não deve expor dados de outros usuários. O banco decide o que cada papel pode ler/escrever.

**Alternativas Avaliadas:**
- Segurança apenas no frontend (descartada — insuficiente; facilmente contornada)
- Segurança apenas via API própria (descartada — introduziria camada adicional sem benefício neste stack)

**Impactos:**
- Positivo: vendedor não acessa leads de outros vendedores mesmo com acesso direto à API
- Positivo: usuário desativado é bloqueado imediatamente no banco, não apenas no frontend
- Negativo: lógica de permissão duplicada (frontend filtra para UX, banco filtra para segurança)

**Arquivos Afetados:**
- `supabase/migracao-auth.sql`
- `supabase/schema.sql`
- `src/lib/dataService.js`

**Riscos:**
- Policies mal configuradas podem silenciosamente negar operações legítimas (ex: vendedor não consegue criar lead)

**Status:** Ativa

---

### [D-005] — Sanitização de inputs no frontend antes de gravar no banco

**Data:** Pré-15/06/2026

**Tipo:** Segurança

**Decisão:**
Todos os inputs de usuário passam por `sanitizeText()` de `src/lib/security.js` antes de qualquer operação de escrita no banco ou localStorage.

**Motivação:**
Prevenir XSS armazenado. Embora o JSX auto-escape na renderização, dados armazenados sujos podem causar problemas em contextos futuros (ex: exportação CSV, logs, notificações).

**Alternativas Avaliadas:**
- Sanitizar apenas na renderização (descartada — dados sujos ficam armazenados)
- Confiar no auto-escape do JSX (descartada — não cobre todos os contextos de uso)

**Impactos:**
- Positivo: dados sempre limpos no banco
- Negativo: sanitização deve ser lembrada em toda operação de escrita nova

**Arquivos Afetados:**
- `src/lib/security.js`
- `src/main.jsx` (todos os handlers de formulário)
- `config/security.js` (espelho para testes Node.js)

**Riscos:**
- Esquecimento de `sanitizeText()` em novos formulários/handlers — sem lint rule automatizada

**Status:** Ativa

---

### [D-006] — Updates otimistas com sync assíncrono

**Data:** Pré-15/06/2026

**Tipo:** Arquitetura / Performance

**Decisão:**
Toda ação do usuário (criar lead, editar evento, etc.) atualiza a UI imediatamente e envia ao banco em segundo plano. Se o sync falhar, o dado fica salvo localmente e um aviso é exibido.

**Motivação:**
Latência percebida pelo usuário é crítica, especialmente para vendedores em eventos usando celular com conexão instável.

**Alternativas Avaliadas:**
- Aguardar confirmação do banco antes de atualizar UI (descartada — latência percebida inaceitável)
- Sem fallback em caso de falha (descartada — perda de dados inaceitável)

**Impactos:**
- Positivo: UI responsiva independente da qualidade da conexão
- Negativo: estado local pode divergir temporariamente do banco; complexidade de tratamento de erro aumentada

**Arquivos Afetados:**
- `src/lib/dataService.js`
- `src/main.jsx` (AppProvider — handlers de ação)

**Riscos:**
- Conflito de versão se dois usuários editam o mesmo registro simultaneamente (sem mecanismo de lock)

**Status:** Ativa

---

### [D-007] — Retry com backoff exponencial em operações de rede

**Data:** Pré-15/06/2026

**Tipo:** Infraestrutura / Performance

**Decisão:**
Operações de rede em `dataService.js` usam retry automático com backoff exponencial: 800ms inicial, dobrando a cada tentativa.

**Motivação:**
Conexões instáveis em eventos (3G/4G, Wi-Fi de feira) causam falhas transitórias que não devem resultar em erro para o usuário.

**Alternativas Avaliadas:**
- Retry imediato (descartada — sobrecarrega o servidor em cascata)
- Sem retry (descartada — UX ruim em ambientes de evento)
- Retry com intervalo fixo (descartada — menos eficiente que backoff)

**Impactos:**
- Positivo: resiliência a falhas transitórias de rede
- Negativo: operações podem demorar mais antes de falhar definitivamente

**Arquivos Afetados:**
- `src/lib/dataService.js`

**Riscos:**
- Nenhum conhecido além do tempo de espera em caso de falha persistente

**Status:** Ativa

---

### [D-008] — Realtime via subscriptions Supabase com debounce de 400ms

**Data:** Pré-15/06/2026

**Tipo:** Arquitetura / Performance

**Decisão:**
Mudanças no banco são recebidas via canais realtime do Supabase. As atualizações de estado React são debounced em 400ms para evitar re-renders excessivos em bursts de eventos.

**Motivação:**
Sem debounce, múltiplas inserções em sequência (ex: vários vendedores registrando leads simultaneamente) causariam re-renders encadeados, degradando a performance do painel do marketing.

**Alternativas Avaliadas:**
- Polling periódico (descartada — latência maior, mais requisições)
- Realtime sem debounce (descartada — re-renders em cascata)
- WebSocket próprio (descartada — Supabase já fornece essa infraestrutura)

**Impactos:**
- Positivo: UI atualizada em tempo real com custo de re-render controlado
- Negativo: delay de até 400ms para exibir mudanças externas

**Arquivos Afetados:**
- `src/lib/dataService.js`
- `src/lib/constants.js` (`REALTIME_DEBOUNCE_MS = 400`)

**Riscos:**
- Subscriptions não canceladas no unmount causam memory leak (mitigado por cleanup no `useEffect`)

**Status:** Ativa

---

### [D-009] — Cache em memória com TTL de 30s para rankings

**Data:** Pré-15/06/2026

**Tipo:** Performance

**Decisão:**
Rankings de eventos são cacheados em memória (`src/lib/cache.js`) com TTL de 30 segundos para evitar requisições repetidas ao banco.

**Motivação:**
Rankings são consultados frequentemente (polling de 60s no VendedorApp) e seus dados mudam com baixa frequência relativa. Cache reduz carga no banco sem impactar percepção de atualidade.

**Alternativas Avaliadas:**
- Sem cache (descartada — requisições desnecessárias ao banco)
- Cache mais longo (descartada — dados desatualizados por muito tempo)
- Cache no localStorage (descartada — overhead desnecessário para dados transitórios)

**Impactos:**
- Positivo: menos requisições ao banco; menor latência para leituras repetidas
- Negativo: ranking pode estar defasado em até 30s entre requisições

**Arquivos Afetados:**
- `src/lib/cache.js`
- `src/lib/dataService.js`

**Riscos:**
- Invalidação de cache não automática em caso de mudanças externas (mitigado pelo realtime para os dados principais)

**Status:** Ativa

---

### [D-010] — Extração de utilitários puros (Etapas 1–4)

**Data:** 15/06/2026

**Tipo:** Refatoração

**Decisão:**
Funções puras de formatação, validação, máscaras de input, exportação CSV e dados mock foram extraídas de `main.jsx` para módulos dedicados em `src/utils/`.

**Motivação:**
Funções puras sem efeitos colaterais são os candidatos mais seguros para extração inicial: zero risco de quebra de comportamento, testáveis isoladamente, e reduzem o tamanho do monolítico.

**Alternativas Avaliadas:**
- Extrair junto com componentes (descartada — risco maior; melhor separar por tipo primeiro)

**Impactos:**
- Positivo: ~135 linhas removidas de `main.jsx`; funções reutilizáveis entre módulos
- Negativo: nenhum

**Arquivos Afetados:**
- `src/utils/format.js` (criado)
- `src/utils/masks.js` (criado)
- `src/utils/csv.js` (criado)
- `src/utils/mockData.js` (criado)
- `src/main.jsx` (removidas as definições)

**Riscos:**
- Nenhum — funções puras

**Status:** Ativa

---

### [D-011] — Dados de pacotes de serviços mantidos em `main.jsx`

**Data:** 15/06/2026

**Tipo:** Refatoração

**Decisão:**
Os dados da tabela de planos/pacotes de serviços exibida no VendedorApp **não** foram extraídos para `src/utils/mockData.js`. Permaneceram embutidos no JSX de `main.jsx`.

**Motivação:**
Os dados de pacotes estão diretamente acoplados ao JSX de renderização (inline na tabela), tornando a extração de custo maior que o benefício nesta etapa. A Etapa 4 decidiu não mover dados acoplados à renderização.

**Alternativas Avaliadas:**
- Extrair para `mockData.js` (avaliada e descartada — acoplamento com JSX torna a extração artificial)
- Extrair para constantes em `constants.js` (avaliada e descartada — mesmo problema)

**Impactos:**
- Positivo: nenhuma alteração de comportamento; etapa concluída mais rapidamente
- Negativo: dado de configuração ainda no arquivo monolítico; será extraído junto com o componente na Etapa 13

**Arquivos Afetados:**
- `src/main.jsx` (dados permanecem aqui até Etapa 13)
- `src/utils/mockData.js` (não alterado)

**Riscos:**
- Nenhum — decisão conservadora

**Status:** Ativa

---

### [D-012] — Centralização de constantes em `src/lib/constants.js` (Etapa 5)

**Data:** 15/06/2026

**Tipo:** Refatoração

**Decisão:**
Todos os magic strings e magic numbers do domínio foram centralizados em `src/lib/constants.js`, incluindo enums de status, limites de UI, delays de timing e configurações de gráfico.

**Motivação:**
Valores literais espalhados no código dificultam ajustes (ex: mudar o limite de eventos futuros exibiria obriga buscar todas as ocorrências do número `3`). Centralização torna mudanças de configuração triviais.

**Alternativas Avaliadas:**
- Manter literais no código (descartada — manutenção difícil)
- Arquivo de configuração JSON (descartada — sem tipagem; constants.js já é suficiente)

**Impactos:**
- Positivo: ~15 linhas removidas de `main.jsx`; valores de configuração com nome semântico
- Negativo: nenhum

**Arquivos Afetados:**
- `src/lib/constants.js` (ampliado com novas constantes)
- `src/main.jsx` (literais substituídos por referências)

**Riscos:**
- Nenhum

**Status:** Ativa

---

### [D-013] — UI Components extraídos para `src/components/ui.jsx` (Etapa 6)

**Data:** 15/06/2026

**Tipo:** Refatoração

**Decisão:**
Componentes de UI genéricos e sem lógica de negócio (`Icon`, `StatusBadge`, `TipoBadge`, `Kpi`, `ChartView`) foram extraídos para um único arquivo `src/components/ui.jsx`. `SyncBadge` foi mantido em `main.jsx` para ser extraído na Etapa 7.

**Motivação:**
Componentes puramente visuais são reutilizáveis por qualquer feature futura e têm zero dependência de estado ou contexto. São candidatos ideais para uma biblioteca interna de UI.

**Alternativas Avaliadas:**
- Um arquivo por componente (avaliada — mais granular, mas overhead desnecessário neste tamanho)
- Manter em `main.jsx` (descartada — impede reutilização e aumenta ruído no monolítico)

**Impactos:**
- Positivo: ~100 linhas removidas de `main.jsx`; base para biblioteca de UI interna
- Negativo: `ChartView` mantém import de `chart.js` localmente (dependência do componente)

**Arquivos Afetados:**
- `src/components/ui.jsx` (criado)
- `src/main.jsx` (removidas definições; adicionado import)

**Riscos:**
- `ChartView` deve destruir instância do Chart.js no unmount para evitar memory leak (implementado com `useEffect` cleanup)

**Status:** Ativa

---

### [D-014] — Mapeamento camelCase ↔ snake_case centralizado no `dataService`

**Data:** Pré-15/06/2026

**Tipo:** Arquitetura

**Decisão:**
A conversão entre camelCase (JavaScript) e snake_case (banco de dados) é feita automaticamente pela camada `dataService.js`. Os componentes e contexto nunca lidam com snake_case diretamente.

**Motivação:**
Eliminar inconsistência de nomenclatura no código JS e isolar o conhecimento do schema do banco em um único lugar.

**Alternativas Avaliadas:**
- Usar snake_case em todo o JS (descartada — quebra convenções JS)
- Conversão manual em cada componente (descartada — duplicação e inconsistência)

**Impactos:**
- Positivo: código JS com nomenclatura consistente; mudanças no schema do banco impactam apenas `dataService.js`
- Negativo: bug de mapeamento é invisível se o campo simplesmente retornar `undefined`

**Arquivos Afetados:**
- `src/lib/dataService.js`

**Riscos:**
- Novos campos no banco devem ser adicionados ao mapeamento manualmente

**Status:** Ativa

---

### [D-015] — Headers de segurança configurados via `vercel.json`

**Data:** Pré-15/06/2026

**Tipo:** Segurança / Infraestrutura

**Decisão:**
Headers HTTP de segurança (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy) são configurados no `vercel.json`, não no código da aplicação.

**Motivação:**
Headers de segurança devem ser aplicados na camada de transporte/servidor, não no frontend. A Vercel os aplica em todas as rotas automaticamente.

**Alternativas Avaliadas:**
- Headers via meta tags HTML (descartada — menos efetivo; não cobre todos os headers)
- Middleware de servidor próprio (descartada — overhead desnecessário com Vercel)

**Impactos:**
- Positivo: CSP com `connect-src` permitindo `*.supabase.co`; proteção contra clickjacking, MIME sniffing e acesso indevido a câmera/microfone
- Negativo: headers não aplicados em ambiente de dev local (apenas produção Vercel)

**Arquivos Afetados:**
- `vercel.json`

**Riscos:**
- Atualização do domínio Supabase exige atualização do CSP

**Status:** Ativa

---

### [D-016] — Componentes de auth extraídos para `src/auth/` (Etapa 8)

**Data:** 15/06/2026

**Tipo:** Refatoração

**Decisão:**
`Login`, `LoginAuth`, `NovaSenha`, `RootAuth` e `RootLegacy` foram extraídos de `main.jsx` para módulos dedicados em `src/auth/`, com re-export via `src/auth/index.js`.

**Motivação:**
Fluxos de autenticação são domínio independente do restante da aplicação. Mantê-los em `main.jsx` misturava lógica de identidade/acesso com lógica de negócio. A extração isola esse domínio e facilita substituição futura do mecanismo de auth.

**Alternativas Avaliadas:**
- Manter em `main.jsx` até Etapa 16 (descartada — custo de contexto alto; componentes de auth são candidatos simples para extração precoce)
- Um único arquivo `src/auth/index.jsx` (descartada — granularidade por componente facilita revisão e testes)

**Impactos:**
- Positivo: ~235 linhas removidas de `main.jsx`; domínio de auth isolado; `Auth` constants movidos para `Login.jsx`
- Negativo: `RootLegacy` importa `usePersisted` de `../main` temporariamente (será corrigido na Etapa 15); `RootAuth`/`RootLegacy` recebem `MarketingApp` e `VendedorApp` como props (pois ainda estão em `main.jsx`)

**Arquivos Afetados:**
- `src/auth/Login.jsx` (criado)
- `src/auth/LoginAuth.jsx` (criado)
- `src/auth/NovaSenha.jsx` (criado)
- `src/auth/RootAuth.jsx` (criado)
- `src/auth/RootLegacy.jsx` (criado)
- `src/auth/index.js` (criado)
- `src/main.jsx` (removidas definições; adicionado import de `./auth`; `usePersisted` exportado; `Root` passa props de app)

**Riscos:**
- `RootLegacy` depende de `usePersisted` de `../main` — import circular temporário (mesmo padrão de `useApp.js` → `../main` já existente)
- `MarketingApp` e `VendedorApp` passados como props — padrão não convencional; será eliminado quando esses componentes forem extraídos nas Etapas 13 e 14

**Status:** Ativa

---

### [D-017] — Feature tabs de eventos extraídas para `src/features/events/` (Etapa 10)

**Data:** 15/06/2026

**Tipo:** Refatoração

**Decisão:**
`Dashboard`, `EventosTab` e `EventDetail` foram extraídos de `main.jsx` para módulos dedicados em `src/features/events/`, com re-export via `src/features/events/index.js`.

**Motivação:**
Os três componentes formam o domínio funcional de eventos e totalizam ~350 linhas. Agrupá-los em `src/features/events/` isola esse domínio, facilita navegação e prepara estrutura para as etapas seguintes.

**Alternativas Avaliadas:**
- Um arquivo único `src/features/events/index.jsx` (descartada — granularidade por componente facilita revisão)
- Manter em `main.jsx` (descartada — domínio bem definido, sem riscos de extração)

**Impactos:**
- Positivo: ~350 linhas removidas de `main.jsx`; CHART_COLORS movido para Dashboard.jsx; imports desnecessários limpos
- Negativo: `darkScale` ainda permanece em `main.jsx` pois `LeadsTab` (não extraído nesta etapa) também a usa

**Arquivos Afetados:**
- `src/features/events/Dashboard.jsx` (criado)
- `src/features/events/EventosTab.jsx` (criado)
- `src/features/events/EventDetail.jsx` (criado)
- `src/features/events/index.js` (criado)
- `src/main.jsx` (removidas definições; adicionado import de `./features/events`; imports limpos)

**Riscos:**
- `darkScale` duplicado: está em `EventDetail.jsx` como constante local E em `main.jsx` para `LeadsTab`. Será consolidado quando `LeadsTab` for extraído na Etapa 11.

**Status:** Ativa

---

### [D-018] — Feature tabs de estoque, leads e checkin extraídas para `src/features/` (Etapa 11)

**Data:** 15/06/2026

**Tipo:** Refatoração

**Decisão:**
`EstoqueTab`, `LeadsTab` e `CheckinTab` foram extraídos de `main.jsx` para módulos dedicados em `src/features/inventory/`, `src/features/leads/` e `src/features/checkin/` respectivamente, cada um com re-export via `index.js`.

**Motivação:**
Os três componentes formam domínios funcionais independentes que totalizavam ~348 linhas no monolítico. Agrupá-los por domínio em `src/features/` segue o padrão estabelecido na Etapa 10, isolando responsabilidades e facilitando navegação.

**Alternativas Avaliadas:**
- Agrupar todos em `src/features/marketing/` (descartada — domínios distintos merecem pastas próprias)
- Manter em `main.jsx` (descartada — domínios bem definidos, sem riscos de extração)

**Impactos:**
- Positivo: ~348 linhas removidas de `main.jsx`; `darkScale` movida para `LeadsTab.jsx`; `NIVEL_ESTOQUE` e `exportLeadsCSV` removidos dos imports de `main.jsx`
- Negativo: `TEMPERATURA_CONFIG` duplicada em `CheckinTab.jsx` e `main.jsx` (VendedorApp ainda precisa dela); será eliminada quando VendedorApp for extraído na Etapa 13

**Arquivos Afetados:**
- `src/features/inventory/EstoqueTab.jsx` (criado)
- `src/features/inventory/index.js` (criado)
- `src/features/leads/LeadsTab.jsx` (criado)
- `src/features/leads/index.js` (criado)
- `src/features/checkin/CheckinTab.jsx` (criado)
- `src/features/checkin/index.js` (criado)
- `src/main.jsx` (removidas definições; adicionados imports; imports limpos)

**Riscos:**
- `TEMPERATURA_CONFIG` duplicada temporariamente entre `CheckinTab.jsx` e `main.jsx` — sem impacto funcional, será consolidada na Etapa 13

**Status:** Ativa

---

### [D-019] — Feature tabs de equipe extraídas para `src/features/team/` (Etapa 12)

**Data:** 15/06/2026

**Tipo:** Refatoração

**Decisão:**
`EquipeTab` e `EquipeAuthTab` foram extraídos de `main.jsx` para módulos dedicados em `src/features/team/`, com re-export via `src/features/team/index.js`.

**Motivação:**
Os dois componentes formam o domínio funcional de gestão de equipe e totalizavam ~247 linhas no monolítico. Agrupá-los em `src/features/team/` segue o padrão estabelecido nas etapas anteriores.

**Alternativas Avaliadas:**
- Um único arquivo `src/features/team/index.jsx` (descartada — granularidade por componente facilita revisão)
- Manter em `main.jsx` (descartada — domínio bem definido, sem riscos de extração)

**Impactos:**
- Positivo: ~247 linhas removidas de `main.jsx`; domínio de equipe isolado; `sanitize()` convertida para `sanitizeText()` diretamente
- Positivo: imports não mais usados em `main.jsx` foram limpos (RECENT_EVENTS_SHOWN, fmtDate, initials)
- Negativo: nenhum

**Arquivos Afetados:**
- `src/features/team/EquipeTab.jsx` (criado)
- `src/features/team/EquipeAuthTab.jsx` (criado)
- `src/features/team/index.js` (criado)
- `src/main.jsx` (removidas definições; adicionado import de `./features/team`; imports desnecessários limpos)

**Riscos:**
- Nenhum remanescente

**Status:** Ativa

---

### [D-020] — VendedorApp extraído para `src/apps/` com LeadEditInline embutido (Etapa 13)

**Data:** 15/06/2026

**Tipo:** Refatoração

**Decisão:**
`VendedorApp` e `LeadEditInline` foram extraídos de `main.jsx` para `src/apps/VendedorApp.jsx` como arquivo único. `LeadEditInline` permanece no mesmo arquivo em vez de ser separado em `src/apps/LeadEditInline.jsx`. `TEMPERATURA_CONFIG` e `OBS_ATALHOS` foram movidos para o escopo do módulo.

**Motivação:**
`LeadEditInline` é usado exclusivamente dentro de `VendedorApp` e tem ~65 linhas — tamanho que não justifica arquivo separado. Colocá-lo no mesmo módulo evita import desnecessário e mantém coesão. A criação do diretório `src/apps/` segue o plano arquitetural (Etapas 13–14) para shells de aplicação distintos do marketing e do vendedor.

**Alternativas Avaliadas:**
- Arquivo separado `src/apps/LeadEditInline.jsx` (avaliada — descartada por adicionar overhead sem benefício, dado o uso exclusivo dentro de VendedorApp)
- Manter em `main.jsx` (descartada — ~580 linhas de UI específica do vendedor no arquivo monolítico)

**Impactos:**
- Positivo: ~580 linhas removidas de `main.jsx`; domínio do vendedor isolado em `src/apps/`; imports desnecessários limpos de `main.jsx`
- Positivo: `TEMPERATURA_CONFIG` agora existe em local único (`VendedorApp.jsx`); duplicata em `CheckinTab.jsx` permanece por autonomia do módulo
- Negativo: nenhum

**Arquivos Afetados:**
- `src/apps/VendedorApp.jsx` (criado — contém LeadEditInline e VendedorApp)
- `src/main.jsx` (removidas definições; adicionado `import VendedorApp from './apps/VendedorApp'`; imports limpos)

**Riscos:**
- Polling de ranking com `setInterval` — cleanup garantido via `return () => clearInterval(interval)` no `useEffect`
- Toast com timer — cancelado corretamente em `handleUndo` e no `showToast` antes de novo toast

**Status:** Ativa

---

### [D-021] — MarketingApp e Root extraídos para `src/apps/` (Etapa 14)

**Data:** 15/06/2026

**Tipo:** Refatoração

**Decisão:**
`MarketingApp` (shell de navegação do marketing) e `Root` (roteador raiz com detecção de modo) foram extraídos de `main.jsx` para `src/apps/MarketingApp.jsx` e `src/apps/Root.jsx` respectivamente.

**Motivação:**
Os dois componentes representavam o último bloco de UI em `main.jsx`. Com a extração, o arquivo principal passa a conter apenas infraestrutura (`ErrorBoundary`, `AppContext`, `usePersisted`, `AppProvider`) e o ponto de entrada React (`ReactDOM.createRoot`). Isso prepara o arquivo para as Etapas 15–16, que irão extrair o restante.

**Alternativas Avaliadas:**
- Extrair em arquivo único `src/apps/index.jsx` (descartada — granularidade por componente facilita revisão e substituição independente)
- Manter em `main.jsx` até Etapa 16 (avaliada — desnecessário; componentes de UI não pertencem ao arquivo de infraestrutura)

**Impactos:**
- Positivo: ~85 linhas removidas de `main.jsx`; shells de aplicação agrupados em `src/apps/` junto com `VendedorApp`; `main.jsx` reduzido para ~245 linhas
- Positivo: `Root.jsx` encapsula toda a lógica de dark mode e detecção de modo, isolando essas responsabilidades
- Negativo: nenhum

**Arquivos Afetados:**
- `src/apps/MarketingApp.jsx` (criado)
- `src/apps/Root.jsx` (criado)
- `src/main.jsx` (removidas definições; imports de features/auth/ui/apps eliminados; adicionado `import Root from './apps/Root'`)

**Riscos:**
- Nenhum — extração conservadora sem alteração de lógica

**Status:** Ativa

---

### [D-022] — usePersisted e useRanking extraídos para `src/hooks/` (Etapa 15)

**Data:** 15/06/2026

**Tipo:** Refatoração

**Decisão:**
`usePersisted` foi extraído de `main.jsx` para `src/hooks/usePersisted.js`. A lógica de polling de ranking (3 `useEffect` + 2 `useState` + 2 `useRef`) foi extraída de `VendedorApp.jsx` para `src/hooks/useRanking.js`, que recebe `eventoId` e `leadsCount` como parâmetros. O import circular `RootLegacy.jsx → ../main` foi eliminado — agora importa de `../hooks/usePersisted` diretamente.

**Motivação:**
`usePersisted` é infraestrutura genérica de persistência usada em múltiplos contextos (`AppProvider`, `RootLegacy`). Mantê-lo em `main.jsx` bloqueava sua reutilização limpa e criava import circular. `useRanking` isola a lógica de polling com cleanup automático, reduzindo o tamanho e a responsabilidade de `VendedorApp.jsx`.

**Alternativas Avaliadas:**
- Manter `useRanking` inline em `VendedorApp.jsx` (descartada — 30 linhas de infra misturadas com UI; dificulta teste isolado)
- Extrair `useRanking` como método de `dataService.js` (descartada — polling é responsabilidade de hook React, não de camada de dados)

**Impactos:**
- Positivo: import circular `RootLegacy → main` eliminado; `main.jsx` reduzido para ~220 linhas; hooks reutilizáveis separados de componentes
- Positivo: `VendedorApp.jsx` mais legível — 30 linhas substituídas por 1 linha de destructuring
- Negativo: nenhum

**Arquivos Afetados:**
- `src/hooks/usePersisted.js` (criado)
- `src/hooks/useRanking.js` (criado)
- `src/main.jsx` (removida definição de `usePersisted`; adicionado import)
- `src/apps/VendedorApp.jsx` (lógica de ranking substituída por `useRanking`; imports limpos)
- `src/auth/RootLegacy.jsx` (import de `usePersisted` atualizado de `../main` para `../hooks/usePersisted`)

**Riscos:**
- Nenhum — extração conservadora; comportamento idêntico ao inline

**Status:** Ativa

---

### [D-023] — AppContext e AppProvider extraídos para `src/context/` (Etapa 16)

**Data:** 15/06/2026

**Tipo:** Refatoração / Infraestrutura

**Decisão:**
`AppContext` (createContext) e `AppProvider` (Provider com todo o estado e ações) foram extraídos de `main.jsx` para módulos dedicados em `src/context/`, com re-export via `src/context/index.js`. O import circular `useApp.js → ../main` foi eliminado — agora importa de `../context/AppContext` diretamente.

**Motivação:**
`main.jsx` continha ainda ~185 linhas de infraestrutura de estado (AppContext + AppProvider) que precisavam ser separadas do ponto de entrada React. Com a extração, `main.jsx` fica com ~35 linhas (apenas `ErrorBoundary` e `ReactDOM.createRoot`), atingindo a meta de < 100 linhas antes do fim da refatoração.

**Alternativas Avaliadas:**
- Manter AppContext separado de AppProvider (avaliada — desnecessário; `AppContext.js` tem apenas 3 linhas e cria apenas a referência do contexto)
- Usar arquivo único `src/context/index.js` para tudo (descartada — separação AppContext/AppProvider facilita import granular em `useApp.js`)

**Impactos:**
- Positivo: `main.jsx` reduzido para ~35 linhas; import circular `useApp.js → ../main` eliminado; `src/context/` contém toda a infraestrutura de estado
- Positivo: 102 módulos transformados no build (era 99); nenhuma regressão
- Negativo: nenhum

**Arquivos Afetados:**
- `src/context/AppContext.js` (criado — 3 linhas)
- `src/context/AppProvider.jsx` (criado — ~145 linhas)
- `src/context/index.js` (criado — 2 linhas)
- `src/main.jsx` (removidas definições; imports limpos; reduzido para ~35 linhas)
- `src/hooks/useApp.js` (import de AppContext atualizado de `../main` para `../context/AppContext`)

**Riscos:**
- Nenhum remanescente — build validado; import circular eliminado

**Status:** Ativa

---

### [D-025] — SYSTEM_MAP.md como documento de arquitetura viva

**Data:** 16/06/2026

**Tipo:** Infraestrutura / Documentação

**Decisão:**
Criação de `SYSTEM_MAP.md` como fonte única de verdade sobre a arquitetura atual do sistema. O documento cobre: visão geral funcional, arquitetura por camada, estrutura de diretórios, apps principais, domínios de negócio, fluxo de dados, regras técnicas, dependências e restrições arquiteturais. É atualizado a cada mudança estrutural relevante.

**Motivação:**
À medida que a refatoração progressiva avança (17 de 18 etapas), o sistema ganhou estrutura modular significativa. Sem um mapa centralizado, cada nova sessão de IA ou desenvolvedor precisa reconstituir o entendimento da arquitetura lendo múltiplos arquivos. O `SYSTEM_MAP.md` resolve isso em 30 segundos de leitura.

**Alternativas Avaliadas:**
- Manter arquitetura apenas no `CLAUDE.md` (descartada — CLAUDE.md já é longo e mistura operacional com arquitetural)
- Diagrama Mermaid/C4 (descartada — não reflete código real; fica desatualizado rapidamente)
- README.md (descartada — README é para usuários/ops, não para IA/devs)

**Impactos:**
- Positivo: onboarding de nova sessão de IA em < 1 min; restrições arquiteturais explícitas evitam violações involuntárias
- Positivo: `CLAUDE.md` pode ser simplificado progressivamente — detalhes arquiteturais migram para `SYSTEM_MAP.md`
- Negativo: requer manutenção ativa — deve ser atualizado a cada mudança estrutural (nova etapa, nova camada, nova regra)

**Arquivos Afetados:**
- `SYSTEM_MAP.md` (criado)
- `CLAUDE.md` (adicionada seção "Documentação de Referência" apontando para SYSTEM_MAP.md)
- `DECISIONS.md` (este registro)

**Riscos:**
- Divergência entre `SYSTEM_MAP.md` e o código real se não for atualizado após mudanças estruturais

**Status:** Ativa

---

### [D-024] — Módulos de API por domínio via factory functions (Etapa 17)

**Data:** 16/06/2026

**Tipo:** Refatoração / Arquitetura

**Decisão:**
As implementações de CRUD do `AppProvider` foram extraídas para 4 módulos de API em `src/api/`, cada um expondo uma factory function (`createEventoApi`, `createLeadApi`, `createMaterialApi`, `createVendedorApi`). As factories recebem os setters e estado necessários como parâmetros e retornam objetos com as funções de domínio. O `AppProvider` chama as factories no corpo do componente e passa as funções resultantes para o `useMemo`.

**Motivação:**
O `AppProvider` acumulava ~100 linhas de lógica CRUD junto com a orquestração de estado e efeitos de infraestrutura (realtime, carregar, subscriptions). Separar os CRUDs por domínio mantém o Provider como orquestrador puro de estado e isola cada domínio em módulo rastreável.

**Alternativas Avaliadas:**
- Hooks por domínio (`useEventoActions`, etc.) — descartada: hooks precisam ser chamados no topo do componente e criariam ordem de execução implícita; factories são chamadas simples no corpo
- Funções exportadas com parâmetros diretos (sem factory) — descartada: obrigaria passar 4-5 args em cada chamada no `useMemo`, reduzindo legibilidade
- Manter CRUD inline no `AppProvider` — descartada: Provider com 170 linhas mistura responsabilidades de estado + persistência + domínio

**Impactos:**
- Positivo: `AppProvider.jsx` reduzido de ~170 para ~100 linhas; CRUD por domínio isolado e testável individualmente; import de `db` e `invalidarRanking` saiu do Provider
- Positivo: `patchEvento` (compartilhado entre eventoApi e materialApi) é retornado por `createEventoApi` e injetado em `createMaterialApi` via parâmetro — sem acoplamento direto entre módulos
- Negativo: factories recriadas a cada render (custo mínimo; idêntico ao comportamento anterior com funções inline)

**Arquivos Afetados:**
- `src/api/eventoApi.js` (criado)
- `src/api/leadApi.js` (criado)
- `src/api/materialApi.js` (criado)
- `src/api/vendedorApi.js` (criado)
- `src/context/AppProvider.jsx` (atualizado — CRUDs removidos; factories importadas)

**Riscos:**
- `useMemo` captura as funções das factories corretamente porque suas deps (`eventos`, `leads`, etc.) fazem parte do array de dependências — comportamento preservado
- Nenhum import circular: `api/` importa apenas de `lib/dataService`; não importa de `context/`

**Status:** Ativa

---

### [D-026] — `servicoInteresse` como array com persistência JSON-string backward-compatible

**Data:** 2026-06-16

**Tipo:** Feature / Arquitetura

**Decisão:**
O campo `servicoInteresse` dos leads passa a ser um array de strings em vez de string simples. Na persistência (Supabase), o array é serializado como JSON string na coluna `servico_interesse` (TEXT existente, sem alteração de schema). Na leitura (`leadFromDb`), dados antigos (string simples) são normalizados automaticamente para `[string]`; dados novos são armazenados como JSON array string.

**Motivação:**
Vendedores em campo identificavam frequentemente interesse em mais de um serviço (ex: Internet + RJNET Móvel). O campo único impedia registrar essa informação sem gambiarras (concatenação, campo extra, etc.).

**Alternativas Avaliadas:**
- Novo campo JSONB `servicos_interesse` no banco (avaliada — requer migração de schema; descartada para compatibilidade imediata)
- String comma-separated (avaliada — menos robusto para parse e filtro; descartada)
- Manter string + campo adicional (descartada — duplicação desnecessária)

**Impactos:**
- Positivo: multi-seleção de serviços sem migração de banco; backward-compatible com todos os leads existentes
- Positivo: filtros em `LeadsTab` e contagem em `Dashboard` atualizados para iterar sobre array
- Negativo: `servico_interesse` no banco armazena JSON string em coluna TEXT — tipo não reflete conteúdo; uma migração para JSONB seria mais correta no longo prazo

**Arquivos Afetados:**
- `src/lib/dataService.js` (leadFromDb: parse JSON com fallback; leadToDb: JSON.stringify)
- `src/apps/VendedorApp.jsx` (multi-select UI; FORM_VAZIO inicia com array; LeadEditInline normaliza legados)
- `src/utils/format.js` (servicoLabel suporta array)
- `src/utils/mockData.js` (mock atualizado para array)
- `src/features/leads/LeadsTab.jsx` (hasServico helper; filtro e byService para arrays)
- `src/features/events/Dashboard.jsx` (dist calculation itera array por lead)

**Riscos:**
- Dado antigo (string) passa a ser JSON string após qualquer edição pelo vendedor — sem impacto no frontend, mas visível no Supabase Studio como string JSON
- Consultas SQL diretas no banco precisarão de `json_array_elements_text` para filtrar por serviço

**Status:** Ativa

---

### [D-027] — Meta de leads em 3 níveis: Bronze / Prata / Ouro

**Data:** 2026-06-16

**Tipo:** Feature

**Decisão:**
A meta diária única (`META_DIARIA = 15`) foi substituída por três níveis progressivos em `constants.js`:
- 🥉 Bronze: `META_BRONZE = 20`
- 🥈 Prata: `META_PRATA = 40`
- 🥇 Ouro: `META_OURO = 60`

`META_DIARIA` foi mantido como alias de `META_OURO` (60) para backward-compatibility. A barra de progresso mostra os 3 marcos com cores distintas por nível (bronze: `#b45309`, prata: `#9ca3af`, ouro: `var(--green)`). O Placar da equipe exibe a medalha conquistada ao lado do total de cada vendedor.

**Motivação:**
Uma única meta não expressava progressão. Com 3 níveis, vendedores têm motivação contínua ao longo do evento: alcançar bronze, depois prata, depois ouro — em vez de um estado binário de "bateu/não bateu".

**Alternativas Avaliadas:**
- Meta única configurável pelo marketing (avaliada — não dá feedback progressivo; descartada)
- 5 níveis (avaliada — excessivamente granular para contexto de evento; descartada)
- Metas personalizáveis por evento (avaliada — overhead desnecessário; descartada)

**Impactos:**
- Positivo: feedback visual contínuo com 3 marcos de conquista na barra e no badge
- Positivo: sem quebra em código existente (`META_DIARIA` mantido como alias)
- Negativo: nenhum

**Arquivos Afetados:**
- `src/lib/constants.js` (`META_BRONZE`, `META_PRATA`, `META_OURO` adicionados; `META_DIARIA = META_OURO`)
- `src/apps/VendedorApp.jsx` (barra de progresso, count-badge com medalha, ranking com medalhas)
- `src/index.css` (`.meta-bar-fill.bronze/.prata/.ouro`; `.meta-bar-stages`; `.meta-stage`)

**Riscos:**
- Nenhum — mudança puramente aditiva; `META_DIARIA` mantido como alias

**Status:** Ativa

---

### [D-028] — Organização dos docs em `docs/` com @import seletivo no CLAUDE.md

**Data:** 16/06/2026

**Tipo:** Infraestrutura / Documentação

**Decisão:**
Os arquivos de documentação (`CHANGELOG.md`, `DECISIONS.md`, `REFATORAÇÃO.md`, `SUPABASE.md`, `SYSTEM_MAP.md`) foram movidos da raiz do projeto para o diretório `docs/`. O `CLAUDE.md` permanece na raiz (convenção Claude Code). O `SYSTEM_MAP.md` é carregado automaticamente via `@docs/SYSTEM_MAP.md` no topo do `CLAUDE.md`. Os demais docs são consultados sob demanda com regras explícitas de quando ler cada um.

**Motivação:**
Raiz com 6 arquivos `.md` soltos dificultava a identificação de arquivos de código vs. documentação. Com o crescimento do projeto, novas docs especializadas (ex: `docs/WHATSAPP.md`, `docs/API.md`) entrariam no lugar natural sem poluir a raiz. Além disso, a convenção `@import` garante que a arquitetura viva seja sempre carregada, independente de o Claude decidir ou não ler `SYSTEM_MAP.md`.

**Alternativas Avaliadas:**
- Manter todos na raiz (descartada — escala mal; raiz fica ruidosa com novas docs)
- `@import` de todos os docs (descartada — consome contexto desnecessariamente; `REFATORAÇÃO.md` está concluída, `CHANGELOG.md` é histórico passivo)
- `@import` de `SYSTEM_MAP.md` + `DECISIONS.md` (avaliada — `DECISIONS.md` tem ~1000 linhas; custo de contexto alto; preferível regra explícita de quando ler)

**Impactos:**
- Positivo: raiz mais limpa; novos docs entram em `docs/` sem fricção; `SYSTEM_MAP.md` garantido em toda sessão
- Positivo: regras explícitas na tabela do `CLAUDE.md` guiam Claude sobre quando consultar cada doc
- Negativo: caminhos de referência nos docs precisam ser atualizados manualmente se houver mais movimentações

**Arquivos Afetados:**
- `docs/` (criado)
- `docs/CHANGELOG.md`, `docs/DECISIONS.md`, `docs/REFATORAÇÃO.md`, `docs/SUPABASE.md`, `docs/SYSTEM_MAP.md` (movidos da raiz)
- `CLAUDE.md` (adicionado `@docs/SYSTEM_MAP.md`; tabela de referência atualizada com caminhos e coluna "Quando ler")
- `docs/SYSTEM_MAP.md` (nota de localização adicionada no cabeçalho)
- `docs/CHANGELOG.md` (entrada adicionada)

**Riscos:**
- Arquivos antigos na raiz removidos — links externos ou scripts que apontem para `CHANGELOG.md` na raiz precisarão ser atualizados

**Status:** Ativa

---

### [D-029] — Controle Sim/Não para "já é cliente" e exclusão de lead pelo vendedor

**Data:** 16/06/2026

**Tipo:** Feature

**Decisão:**
O campo "Já é cliente RJNet?" foi migrado de checkbox para controle segmentado com dois botões **Não / Sim**, usando o padrão `.seg-control` / `.seg-btn` já existente no projeto. O valor armazenado continua sendo booleano. Adicionado botão **"Excluir lead"** na aba "Meus Leads" do `VendedorApp`, com confirmação inline em dois passos antes de executar a exclusão.

**Motivação:**
- Checkbox desmarcado era ambíguo: podia significar "não é cliente" ou "campo não respondido". Botões explícitos Não/Sim eliminam a ambiguidade.
- Vendedores precisavam poder corrigir cadastros errados sem depender do marketing para excluir o lead.

**Alternativas Avaliadas:**
- Manter checkbox (descartada — ambiguidade de estado)
- Radio buttons HTML nativos (descartada — inconsistente com o padrão visual `.seg-btn` já adotado para temperatura e serviços)
- Confirmação via `window.confirm()` (descartada — bloqueado em alguns WebViews mobile; inline é mais confiável)

**Impactos:**
- Positivo: UX mais clara para campo de cliente existente
- Positivo: vendedor pode corrigir erros de cadastro sem abrir chamado para o marketing
- A exclusão usa o soft delete existente (`deletado = true`), sem alterar a arquitetura de dados

**Arquivos Afetados:**
- `src/apps/VendedorApp.jsx` (campo Sim/Não, estado `confirmandoDelId`, UI de exclusão)
- `src/index.css` (classes `.lm-del-btn`, `.lm-del-confirm`, `.lm-del-confirm-yes`, `.lm-del-confirm-no`)

**Riscos:**
- Nenhum — exclusão via soft delete preserva o dado no banco; sem impacto em integridade referencial

**Status:** Ativa

---

### [D-030] — Correções arquiteturais pós-auditoria (ARCHITECTURE_FIX_PLAN)

**Data:** 16/06/2026

**Tipo:** Refatoração / Segurança

**Decisão:**
Execução integral do `docs/ARCHITECTURE_FIX_PLAN.md` — 6 correções aplicadas para eliminar desvios identificados na auditoria pós-refatoração de 18 etapas.

**C-1 — Sanitização no fluxo de edição de lead (`src/apps/VendedorApp.jsx`)**
A função `salvarEdicao` passou a chamar `sanitizeText()` nos campos de texto livres (`nome`, `cpf`, `endereco`, `observacao`) antes de repassar para `updateLead`, espelhando o padrão do `submit` de criação. Eliminado vetor de XSS armazenado (D-005).

**C-6 — Correção do `SYSTEM_MAP.md` sobre `mode.js`**
Removida a nota incorreta que afirmava que `src/lib/mode.js` não existe. O documento agora descreve corretamente que `mode.js` exporta `isSupabaseMode()` e `getMode()` como abstração obrigatória sobre `supabaseEnabled`.

**C-5 — `genId` extraído para `src/utils/ids.js`**
A função pura `genId(prefix)` foi movida do `AppProvider` para `src/utils/ids.js` (D-010). As 4 factories (`eventoApi`, `leadApi`, `materialApi`, `vendedorApi`) passaram a importar diretamente de `utils/ids`. O `AppProvider` não define nem injeta mais `genId`.

**C-3 — `obterRanking` movida para `createLeadApi`**
A função de agregação de ranking foi extraída do `AppProvider` para `src/api/leadApi.js`, que já é o módulo centralizador do domínio de leads. O `AppProvider` agora apenas desestrutura `obterRanking` da factory e a expõe via contexto.

**C-4 — `addLead` retorna o objeto criado**
`createLeadApi.addLead` passou a retornar o objeto `novo` com o ID canônico. `VendedorApp.submit` removeu a pré-geração local de ID e usa o ID retornado pela factory para o toast de confirmação. A geração de ID é responsabilidade exclusiva da camada de API.

**C-2 — `createEquipeApi` e refatoração de `EquipeAuthTab`**
Criado `src/api/equipeApi.js` com factory `createEquipeApi({ recarregar })` expondo `criarUsuario`, `atualizarPerfil` e `excluirUsuario`. A factory importa `auth` de `dataService` e move para si a lógica de `toSlug` e sanitização de nome. O `AppProvider` instancia a factory e expõe as três operações via contexto. `EquipeAuthTab` removeu o import direto de `dataService` e passou a consumir exclusivamente via `useApp()`.

**Motivação:**
Eliminar os 6 desvios arquiteturais identificados na auditoria, garantindo que nenhum componente de feature acesse `dataService` diretamente e que todos os caminhos de escrita apliquem sanitização.

**Alternativas Avaliadas:**
- Manter desvios e documentar exceções (descartada — viola contratos explícitos em D-005, D-010, D-024 e SYSTEM_MAP §7/§9)

**Impactos:**
- Positivo: camada de UI completamente desacoplada de `dataService`
- Positivo: `AppProvider` é orquestrador puro, sem lógica de domínio
- Positivo: `createLeadApi` centraliza todo o domínio de leads (CRUD + ranking)
- Positivo: sanitização sem exceções em todos os caminhos de escrita de lead

**Arquivos Afetados:**
- `src/apps/VendedorApp.jsx` (C-1, C-4)
- `docs/SYSTEM_MAP.md` (C-6)
- `src/utils/ids.js` (novo — C-5)
- `src/api/eventoApi.js`, `leadApi.js`, `materialApi.js`, `vendedorApi.js` (C-5)
- `src/api/leadApi.js` (C-3, C-4)
- `src/api/equipeApi.js` (novo — C-2)
- `src/context/AppProvider.jsx` (C-2, C-3, C-4, C-5)
- `src/features/team/EquipeAuthTab.jsx` (C-2)

**Riscos:**
- Baixo: mudanças de comportamento visível são nulas; a geração de ID e os resultados de ranking são idênticos ao código anterior

**Status:** Ativa

---

## Processo Obrigatório

Sempre que uma etapa da refatoração for concluída:

1. Atualizar `REFATORAÇÃO.md` (marcar etapa como concluída, registrar observações)
2. Atualizar `CLAUDE.md` (ajustar estrutura de diretórios se necessário)
3. Verificar se houve decisão arquitetural relevante
4. Caso sim, registrar no `DECISIONS.md` seguindo o template acima

Nenhuma etapa deve ser considerada concluída sem essa verificação.

---

## Recuperação de Contexto

Antes de executar qualquer alteração no projeto, uma nova sessão de IA deve:

1. Ler `SYSTEM_MAP.md` — arquitetura viva: estrutura, fluxo de dados, regras técnicas e restrições
2. Ler `CLAUDE.md` — stack, scripts, variáveis de ambiente, banco de dados
3. Ler `REFATORAÇÃO.md` — estado atual da refatoração, próxima etapa pendente
4. Ler `DECISIONS.md` (este arquivo) — decisões anteriores que devem ser respeitadas
5. Respeitar decisões previamente registradas
6. Não substituir decisões existentes sem criar um novo registro (`[D-NNN]`) justificando a mudança

Ao iniciar uma sessão, verificar:
- Qual é a próxima etapa da refatoração pendente?
- O estado atual do código corresponde ao que o plano indica como concluído?
- Existe alguma decisão neste documento que restringe a abordagem planejada?
