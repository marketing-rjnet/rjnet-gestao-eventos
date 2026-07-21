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

### [D-051] — Monitor: correção da contagem de leads ao encerrar sessão

**Data:** 2026-06-18
**Tipo:** Bugfix

**Decisão:** `handleEncerrarSessao` deve contar `lead_add - lead_remove` apenas dentro do escopo temporal da sessão atual (desde o último `session_start`), com `Math.max(0, ...)` como guarda.

**Causa raiz:** A implementação original usava `logs.filter(l => l.type === 'lead_add').length` — sem escopo de sessão e sem subtrair remoções. Dois bugs independentes:
1. Contava leads de sessões anteriores ou do histórico do dia.
2. Não descontava leads excluídos pelo vendedor durante a sessão.

**Solução:**
```js
const lastStart = [...logs].reverse().find(l => l.type === 'session_start');
const sessionLogs = logs.filter(l => !lastStart || l.ts >= lastStart.ts);
const count = Math.max(0,
  sessionLogs.filter(l => l.type === 'lead_add').length -
  sessionLogs.filter(l => l.type === 'lead_remove').length,
);
```

**Invariante:** `Math.max(0, ...)` evita contagem negativa quando um lead adicionado antes da sessão (em outra sessão do mesmo dia) é removido dentro dela.

**Arquivos Afetados:**
- `src/features/monitoring/MonitoringTab.jsx` — `handleEncerrarSessao`

**Status:** Ativa (substitui implementação incorreta de D-048)

---

### [D-050] — Monitor: status de atividade do vendedor nos cards

**Data:** 2026-06-18
**Tipo:** Feature

**Decisão:** Inferir status de atividade do vendedor a partir do `lastTs` (timestamp da última entrada no log) em vez de implementar presença WebSocket via Supabase Realtime Presence.

**Motivação:** O marketing precisa saber, em campo, quais vendedores estão ativos e quais pararam de usar o app. Os dados necessários já existem no log (timestamp da última ação por vendedor).

**Alternativas Avaliadas:**
- **Supabase Realtime Presence:** estado "online" real baseado na conexão WebSocket ativa. Rejeitado: celulares suspendem WebSockets em segundo plano (iOS/Android background limits) — geraria falsos negativos constantes (vendedor "offline" por ter minimizado o app para tirar uma foto).
- **Status inferido do log (escolhida):** usa `lastTs` já calculado no `vendedores` useMemo. 4 tiers por elapsed time. Sem novo dado, sem nova conexão, sem false alarms por background.

**Tiers de status:**

| Elapsed | Label | Cor |
|---|---|---|
| < 5 min | ativo agora | #22c55e (verde) |
| < 30 min | há Xmin | #eab308 (amarelo) |
| < 24h | há Xh | cinza |
| ≥ 24h | inativo | cinza |

**Impactos:**
- `VendedorCard` ganha tick de 30s via `setInterval` interno — cada card atualiza seu próprio status independentemente sem re-executar o `vendedores` useMemo.
- Sem novo estado no contexto, sem nova query ao Supabase.
- `timeAgo` removido (único uso era no card).

**Arquivos Afetados:**
- `src/features/monitoring/MonitoringTab.jsx` — `vendorStatus()`, VendedorCard com tick e ponto de status

**Status:** Ativa

---

### [D-049] — Monitor: sync_ok para removeLead e severidade dinâmica de perf_warn

**Data:** 2026-06-18
**Tipo:** Feature / Bugfix

**Decisão 1 — sync_ok para removeLead:** Estender `db.removeLead` com 3º param `onSuccess`, seguindo o padrão já estabelecido em `db.saveLead`. `leadApi.removeLead` passa callback que dispara `lead_sync_ok` após confirmação do Supabase.

**Decisão 2 — severidade dinâmica de perf_warn:** Substituir label/cor estáticos de `perf_warn` por função `getPerfCfg(ms)` que retorna tiers visuais distintos conforme a gravidade do atraso.

**Motivação:**
- `lead_remove` era o único dos 3 tipos de mutação sem confirmação do servidor — loop incompleto, a mensagem "aguardando confirmação" ficava sem resposta.
- `perf_warn` com 236160ms (4 min, provável timeout) aparecia idêntico a 1053ms (leve lentidão) — sem distinção de gravidade.

**Tiers de perf_warn:**

| ms | Label | Cor |
|---|---|---|
| ≥ 60 000 | timeout de rede (✗) | var(--red) |
| ≥ 30 000 | possível timeout (⚡) | var(--red) |
| ≥ 5 000 | req. muito lenta (⚡) | #f97316 |
| ≥ 1 000 | req. lenta (⚡) | var(--yellow) |

**Regras mantidas:**
- `onFail` de `removeLead` (rollback de estado) preservado sem alteração.
- Padrão `exec(promise, acao, onFail, onSuccess)` não foi alterado.
- Tiers de perf_warn são puramente visuais (MonitoringTab) — não afetam o dado gravado em `logActivity`.

**Arquivos Afetados:**
- `src/lib/dataService.js` — `db.removeLead` aceita 3º param `onSuccess`
- `src/api/leadApi.js` — `removeLead` passa `onSuccess` para `db.removeLead`
- `src/features/monitoring/MonitoringTab.jsx` — `getPerfCfg(ms)`, FeedEntry com cfg dinâmico

**Status:** Ativa

---

### [D-048] — Monitor: marcadores de sessão de evento e limpeza de log

**Data:** 2026-06-18
**Tipo:** Feature

**Decisão:** Adicionar marcadores visuais de início/fim de sessão de evento no feed do Monitor e botão de limpeza do log do dia corrente com confirmação em dois cliques.

**Motivação:** O log persiste 30 dias, mas sem delimitadores não é possível saber onde um evento começa e termina no histórico. O operador de marketing precisa: (1) demarcar o início do monitoramento para separá-lo de dados de teste, (2) encerrar o registro formalmente com resumo de leads, (3) limpar dados fictícios antes do evento real.

**Alternativas Avaliadas:**
- **Filtro por horário:** exigiria UI de seleção de intervalo — complexidade desproporcional.
- **Log por evento (eventoId como chave de storage):** quebraria o modelo de chave por data (D-045); misturaria com o Realtime que já usa a chave diária.
- **Marcadores de sessão como tipo de entrada no log (escolhida):** reutiliza toda a infraestrutura existente — `logActivity()`, buffer localStorage, Realtime broadcast, feed. Zero mudança de schema.

**Impactos:**
- Dois novos tipos no `TYPE_CFG` do MonitoringTab: `session_start` e `session_end`. São ignorados automaticamente pelos filtros Leads/Sync/Perf (não batem em nenhum padrão existente), pelos stats e pelos cards de vendedor.
- `clearActivityDay(null)` já existia e já disparava o `CustomEvent` — o botão de limpeza apenas chama essa função com confirmação de dois cliques.
- `hasActiveSession` é derivado do estado `logs` em memória — sem nova chamada ao localStorage.
- `activeEvento` detectado por `eventos.find(e => e.status === 'ativo')` — sem nova query ao Supabase; usa o contexto já carregado pelo AppProvider.
- Toolbar visível apenas em modo "Hoje" — histórico é somente leitura (invariante existente mantida).

**Regras mantidas:**
- Sem acesso direto ao `dataService` — `logActivity()` é a API pública de `activityLog.js`.
- Sem estado novo no `AppContext`.
- `confirmClear` reseta ao trocar de dia, evitando estado fantasma.

**Arquivos Afetados:**
- `src/features/monitoring/MonitoringTab.jsx` — toolbar, SessionMarker, novos tipos, handlers

**Status:** Ativa

---

### [D-047] — Monitor: canal Realtime único (fix do conflito de canais duplicados)

**Data:** 2026-06-18
**Tipo:** Bugfix Arquitetural (incremento sobre D-046)

**Decisão:** Consolidar em um único canal Supabase Realtime por cliente. `activityLog.js` é o dono exclusivo do canal `rjnet-monitor` — tanto para envio quanto para recepção. `MonitoringTab` não cria canal próprio; registra callbacks via `subscribeToRemoteLogs(callback)`.

**Motivação:** D-046 introduziu um bug sutil: tanto `activityLog.js` quanto `MonitoringTab.jsx` chamavam `supabase.channel('rjnet-monitor')`, criando dois objetos de canal distintos no mesmo cliente Supabase. Pelo design do Supabase JS v2, `.on('broadcast')` só recebe eventos se registrado **antes** de `.subscribe()` — em ambos os canais isso não estava sendo respeitado. Resultado observado: broadcasts chegavam ao servidor Supabase (a tela do marketing atualizava via DB Realtime) mas nunca eram entregues ao feed do Monitor.

**Causa Raiz Detalhada:**
1. `activityLog.js` channel: chamava `.subscribe()` sem `.on('broadcast')` — não recebia nada
2. `MonitoringTab.jsx` channel: chamava `.subscribe()` sem `.on('broadcast')` antes — não recebia nada  
3. Dois canais com mesmo nome no mesmo cliente = conflito interno no Supabase JS v2

**Solução:**
- `activityLog.js`: canal único com `.on('broadcast', { event: 'log' }, handler)` registrado ANTES de `.subscribe()`. Array `_listeners` para callbacks externos. `_queue` acumula envios até `SUBSCRIBED`.
- `MonitoringTab.jsx`: usa `subscribeToRemoteLogs(callback)` — zero canais, apenas register/unregister de callback.

**Regra Estabelecida:** Em Supabase JS v2, toda chamada `.on('broadcast')` DEVE preceder `.subscribe()`. Nunca criar dois canais com o mesmo nome no mesmo cliente.

**Arquivos Afetados:**
- `src/lib/activityLog.js` — canal único, novo export `subscribeToRemoteLogs(callback)`, `_listeners`, `_queue`
- `src/features/monitoring/MonitoringTab.jsx` — removido canal próprio, usa `subscribeToRemoteLogs()`; removidos imports `supabase` e `receiveActivityLog`

**Status:** Ativa (substitui implementação parcial de D-046)

---

### [D-046] — Monitor: Supabase Realtime Broadcast para cobertura entre dispositivos

**Data:** 2026-06-17
**Tipo:** Feature (incremento sobre D-045)

**Decisão:** Adicionar broadcast Supabase Realtime em cada `logActivity()` para transmitir eventos de atividade entre dispositivos diferentes, cobrindo o cenário principal de uso: marketing monitorando pelo celular enquanto vendedores cadastram nos próprios celulares em campo.

**Motivação:** `CustomEvent` e `storage` event são isolados por dispositivo/browser. Sem comunicação entre dispositivos, o Monitor só funcionava no cenário de duas abas no mesmo aparelho. O caso de uso real é um dispositivo por pessoa em campo.

**Alternativas Avaliadas:**
- **Tabela `activity_log` no Supabase + Realtime de DB:** rejeitada — requer migration, RLS, dados de sessão no banco, implicações de LGPD.
- **Polling periódico de uma tabela:** rejeitada — latência alta, overhead de queries, complexidade de schema.
- **WebSocket próprio / servidor intermediário:** rejeitada — infraestrutura extra desnecessária dado que o Supabase Realtime já está no projeto.
- **Supabase Realtime Broadcast (escolhida):** sem schema, sem banco, transiente (não persiste no servidor), multiplexa na WebSocket já existente — zero custo de infraestrutura adicional.

**Impactos:**
- `activityLog.js` agora importa `supabase` — quebra o princípio original de zero dependências do módulo (D-044). Aceito: `supabase.js` não cria dependência circular.
- Canal `rjnet-monitor` aberto no carregamento do módulo em qualquer perfil (inclusive VendedorApp). O vendedor transmite mas nunca recebe — WebSocket multiplexado, sem custo extra perceptível.
- `receiveActivityLog(record)` persiste evento externo no localStorage do marketing com dedup por ID — histórico acumulado mesmo de outros dispositivos.
- `MonitoringTab` assina `rjnet-monitor` apenas quando visualizando "Hoje" — subscription limpa no unmount.
- Cobertura completa: 3 camadas (CustomEvent → storage → Realtime) cobrem todos os cenários de acesso.

**Riscos e Limitações:**
- Canal público (anon key): sem controle de quem assina. Aceitável para equipe interna; revisar em escala multi-cliente.
- Sem garantia de entrega em queda de rede — broadcast não é retransmitido. `lead_sync_ok` cobre a confirmação posterior quando a fila offline processa.
- Limite Supabase Free: 200 conexões simultâneas — muito acima do uso esperado (5–15 vendedores).

**Arquivos Afetados:**
- `src/lib/activityLog.js` — broadcast em `logActivity()`, novo export `receiveActivityLog()`
- `src/features/monitoring/MonitoringTab.jsx` — terceiro listener Realtime, remoção do botão Limpar

**Status:** Ativa

---

### [D-045] — Monitor: persistência por dia via localStorage com chave por data

**Data:** 2026-06-17  
**Tipo:** Feature (incremento sobre D-044 e D-044b)

**Decisão:** Migrar o buffer de atividade de `sessionStorage` para `localStorage` usando chaves no formato `rjnet_activity_YYYY-MM-DD`. Cada dia de evento gera sua própria chave. O MonitoringTab exibe um seletor de dias anteriores e carrega o log correspondente sob demanda.

**Motivação:** O criador do sistema monitora eventos ao vivo e depois analisa o que aconteceu no dia seguinte (ou horas depois). Com `sessionStorage`, o histórico apagava ao fechar a aba. A necessidade é pontual — só dias de evento — mas o valor de ter o log preservado é alto (identificar padrões de falha, confirmar que todos os leads foram sincronizados, entender por que o app travou no horário de pico).

**Alternativas Avaliadas:**
- **Manter sessionStorage + botão de export JSON:** rejeitado — exige que o usuário lembre de exportar antes de fechar. Histórico depende de ação manual.
- **Tabela `activity_log` no Supabase:** rejeitado — requer migration, RLS, e levanta questões de LGPD (dados comportamentais de vendedores no servidor precisam de finalidade documentada). Overhead desproporcional para uso pontual.
- **IndexedDB:** rejeitado — API mais complexa, sem benefício sobre localStorage para volumes de 200 entradas/dia.

**Impactos:**
- `activityLog.js` agora escreve em `localStorage` com chave diária. Dados do dia corrente persistem entre reloads e fechamentos de aba.
- Auto-purge de dias > 30 dias na primeira chamada de `logActivity()` por sessão (guard `_pruned` evita execução repetida).
- `getActivityDays()` itera as chaves do `localStorage` e retorna apenas as que começam com `rjnet_activity_` — sem conflito com outras chaves do app.
- `MonitoringTab`: real-time listener (`rjnet:activity`) ativo apenas quando visualizando "Hoje". Ao trocar para dia passado, o feed é somente leitura.
- "Limpar" em dia passado: remove a chave do localStorage e retorna para Hoje. "Limpar" em Hoje: comportamento idêntico ao anterior.
- Espaço estimado: ~60 KB/dia (200 entradas × ~300 bytes). 30 dias = ~1,8 MB — bem dentro do limite de 5–10 MB do localStorage.

**Arquivos Afetados:**
- `src/lib/activityLog.js` — reescrito: `sessionStorage` → `localStorage`, novos exports `getActivityLogsForDay`, `getActivityDays`, `clearActivityDay`
- `src/features/monitoring/MonitoringTab.jsx` — seletor de dias, banner histórico, real-time condicional

**Riscos:** `localStorage.length` e `localStorage.key(i)` são síncronos e percorrem todas as chaves (não apenas as nossas). Em dispositivos com muitas extensões de browser que também usam localStorage, pode haver lentidão mínima. O try/catch em `getActivityDays()` e `pruneOldDays()` isola falhas em modo privado ou com storage bloqueado.

**Status:** Ativa

---

### [D-044] — Aba Monitor: diagnóstico ao vivo baseado em buffer de sessão

**Data:** 2026-06-17  
**Tipo:** Feature

**Decisão:** Implementar aba "Monitor" no perfil marketing usando um buffer circular em `sessionStorage` (`src/lib/activityLog.js`) em vez de persistência no banco ou integração com serviço de logging externo.

**Motivação:** O criador do sistema monitora eventos ao vivo pelo perfil marketing e precisava saber onde o app quebra para o vendedor (sync errors, leads offline, req. lentas) sem depender de DevTools ou logs de servidor.

**Alternativas Avaliadas:**
- **Banco de dados / tabela de audit_monitor:** rejeitada — LGPD concerns (dados de sessão não deveriam ir ao banco sem finalidade definida), latência de escrita, overhead de schema.
- **Serviço externo (Sentry, LogRocket):** rejeitada — dependência externa, custo, escopo de dados desproporcionalmente amplo para a necessidade.
- **localStorage permanente:** rejeitada — acumula dados entre sessões sem utilidade; `sessionStorage` é mais adequado (escopo da sessão = escopo do evento monitorado).
- **Melhorias pontuais no SyncBadge:** considerada primeiro, mas o criador do sistema tem necessidade de diagnóstico mais amplo (por vendedor, por operação) que um popover de erro não cobre.

**Impactos:**
- `logActivity()` é chamado em 6 pontos de instrumentação: `trackPerf` (perf_warn), `exec` (sync_error), `addToQueue` (offline_queue), `addLead`, `updateLead`, `removeLead` (lead_add/update/remove com vendedorNome).
- Correlação vendor → sync_error: heurística de janela temporal de 5 s (se houve sync_error dentro de 5 s da última ação de um vendedor, o card dele exibe `⚠ erro`). Imperfeita mas útil na prática.
- Dados somem ao fechar a aba — comportamento intencional, logs de sessão não devem ser permanentes.
- Funciona em ambos os modos (Supabase e local).

**Arquivos Afetados:**
- `src/lib/activityLog.js` (novo)
- `src/features/monitoring/MonitoringTab.jsx` (novo)
- `src/features/monitoring/index.js` (novo)
- `src/lib/dataService.js` — 3 chamadas adicionadas
- `src/api/leadApi.js` — 3 chamadas adicionadas
- `src/components/ui.jsx` — ícone `activity` adicionado
- `src/apps/MarketingApp.jsx` — tab Monitor adicionada

**Riscos:** Nenhum crítico. `sessionStorage.setItem` pode falhar silenciosamente em modo de navegação privada com storage cheio (tratado com try/catch). O overhead de serialização JSON para 200 entradas é negligenciável.

**Status:** Ativa — atualizado em D-044b com melhorias de campo

---

### [D-044b] — Monitor v2: sync confirmado, descrições legíveis e filtros separados

**Data:** 2026-06-17  
**Tipo:** Feature (incremento sobre D-044)

**Decisão:** Adicionar tipo `lead_sync_ok` via callback `onSuccess` em `exec()`, reescrever `MonitoringTab` com descrições em linguagem de campo e separar filtros `Sync` / `Perf`.

**Motivação:** Em produção, o botão "Erros (3)" mostrava 3 `perf_warn` (req. lentas), não falhas reais de sync — enganoso em campo. Além disso, o usuário não conseguia entender o impacto de cada evento sem abrir DevTools.

**Alternativas Avaliadas:**
- Manter `level === 'error'` como critério de filtro: rejeitado — `perf_warn` usa `level: 'info'` mas ainda aparecia no agrupamento "Erros" original, confundindo lentidão tolerável com dado perdido.
- Adicionar tooltips no hover: rejeitado — em campo (mobile, evento barulhento) hover não é viável.

**Impactos:**
- `exec(promise, acao, onFail, onSuccess)` — 4º param opcional, zero breaking change (todos os callsites existentes continuam funcionando sem ele).
- `db.saveLead` é o único método que recebe `onSuccess` — o único ponto de escrita onde a identidade do vendedor está disponível no callsite.
- Feed agora mostra linha `↳ descrição` para todos os 7 tipos de evento; vendedor consegue ler "confirmado no servidor — dado salvo com segurança" ou "lista de leads demorou — vendedor aguardou para ver seus registros" sem interpretação técnica.
- Card de vendedor mostra total real do contexto (leads carregados em memória filtrados por `vendedorNome`) quando maior que o total da sessão — resolve discrepância visual para leads cadastrados antes da sessão atual.

**Arquivos Afetados:**
- `src/lib/dataService.js` — `exec()` + `db.saveLead()` modificados
- `src/api/leadApi.js` — `addLead` e `updateLead` passam `onSuccess` callback
- `src/features/monitoring/MonitoringTab.jsx` — reescrita completa

**Riscos:** Nenhum novo. `onSuccess` nunca é chamado se `exec` não completa com sucesso, portanto `lead_sync_ok` nunca é um falso positivo.

**Status:** Ativa

---

### [D-043] — Suspensão temporária do campo de consentimento LGPD na UI

**Data:** 2026-06-17  
**Contexto:** O campo de consentimento LGPD (checkbox "Consentimento LGPD — o titular assinou a ficha...") foi implementado em PA-04/D-033. A validação bloqueava o envio do formulário caso não estivesse marcado. A decisão de qual processo externo adotar (ficha física, termo digital, fluxo de coleta) ainda não foi tomada pelos stakeholders.  
**Decisão:** Ocultar o campo da UI e suspender a validação de bloqueio enquanto as decisões externas não estiverem definidas.  
**O que NÃO mudou:**
- Colunas `consentimento_coletado`, `consentimento_em` e `versao_termo` permanecem no banco (sem rollback de schema)
- `leadFromDb` / `leadToDb` em `dataService.js` continuam mapeando os campos
- `FORM_VAZIO` mantém `consentimentoColetado: false` — ao reativar, basta descomentar o bloco e a validação
**Motivação:** Expor o campo sem que o processo externo esteja definido cria obrigações legais (LGPD art. 7°, I) que o sistema ainda não está preparado para cumprir completamente. Pior do que não coletar é coletar e não honrar o processo.  
**Como reativar:** Remover o comentário `{/* D-043 */}` em `VendedorApp.jsx` (linha ~339) e reintroduzir a validação `if (!f.consentimentoColetado)`. Registrar nova decisão com o processo definido.  
**Status:** Ativa

---

### [D-035] — PA-08: CPF endereçado — remoção do check-in por CPF + reintrodução como campo opcional com finalidade declarada

**Data:** 2026-06-16  
**Contexto:** PA-08 exige endereçar CPF em texto plano na tabela `leads`. O plano oferecia 3 opções: remover, criptografar (pgcrypto) ou hash (SHA-256). O check-in usava CPF como identificador.  
**Decisão em duas partes:**
1. **Check-in migrado** para busca por substring de **nome** dentro do evento — CPF removido do fluxo de identificação.
2. **CPF reintroduzido como campo opcional** no formulário de captura com finalidade declarada no label: *"opcional — para visita técnica e contrato"*. Ver D-042 para a decisão detalhada de reintrodução.

**Justificativa da remoção do check-in por CPF:** O evento filtra os leads; o nome é suficiente para identificar presença no contexto de check-in. Coletar CPF sem finalidade obrigatória violaria o princípio da minimização (art. 6°, III da LGPD).  
**Alternativas rejeitadas (para o check-in):**
- Hash SHA-256 — perde a busca por prefixo parcial; CPF ainda seria coletado (risco na transmissão)
- pgcrypto — chave precisa ser acessível ao app; não elimina risco de coleta  
**Consequências:** `CheckinTab` reescrito com busca por substring de nome (permanente). CPF como campo opcional no formulário de captura e edição inline — ver D-042. Risco residual (texto plano) aceito e documentado.

---

### [D-034] — PA-05: Derivação de chave PBKDF2 a partir do userId para criptografia da fila offline

**Data:** 2026-06-16  
**Contexto:** PA-05 exige criptografar o localStorage da fila offline de leads. A chave precisa ser acessível durante a sessão e descartada no logout, sem necessidade de senha extra do usuário.  
**Decisão:** Derivar a chave AES-GCM 256 bits do `userId` via PBKDF2-SHA256 (100.000 iterações, salt público fixo por versão). A chave fica cacheada em memória (Map) e é descartada ao fazer logout ou ao recarregar a página.  
**Alternativas consideradas:**
- Chave aleatória por sessão persistida no sessionStorage — descartada ao fechar a aba, mas sessionStorage também é acessível por JS local (mesma limitação)
- Prompt de senha adicional do usuário — rejeitado: UX inaceitável para vendedores em campo
- Sem criptografia — rejeitado: NC S-02 da auditoria LGPD  

**Limitação aceita:** Proteção derivada do `userId` (não de senha), portanto não protege contra quem conhece o `userId`. O objetivo é proteger contra acesso físico ao dispositivo por terceiro que não conhece o `userId`. Documentado em `src/lib/crypto.js`.  
**Consequências:** `getQueue()`/`saveQueue()` tornadas assíncronas; fallback silencioso para texto plano quando `crypto.subtle` não estiver disponível (ambientes SSR ou muito antigos).

---

### [D-033] — PA-04: Opção A (ficha física) para consentimento LGPD na captação de leads

**Data:** 2026-06-16  
**Contexto:** PA-04 do Plano de Ação LGPD (NC L-01, L-02, L-03) — dados pessoais coletados sem consentimento documentado do titular, sem informação sobre finalidade ou controlador.

**Decisão:** Implementar **Opção A — Ficha física de consentimento**, com registro digital no sistema.
- O vendedor apresenta ficha física ao titular no evento (a ser impressa pelo marketing)
- O titular assina a ficha; o vendedor marca o checkbox no app antes de registrar
- Os campos `consentimento_coletado`, `consentimento_em` e `versao_termo` são gravados no banco

**Alternativas consideradas:**
- **Opção B (QR Code / formulário digital):** mais robusto (IP, timestamp no próprio dispositivo do titular), mas requer desenvolvimento de rota pública, política de privacidade publicada e infraestrutura adicional — escopo da Fase 4 (PA-16). Não descartada para evolução futura.

**Motivação da escolha:** A Opção A é a mais rápida de implementar e válida juridicamente — o consentimento pode ser coletado em papel (art. 7º, I, LGPD não exige formato digital). A ficha física é prática no contexto de eventos de rua. O registro digital garante rastreabilidade no banco.

**Versão do termo:** `v1.0` — referencia `doc/lgpd/POLITICA_DE_PRIVACIDADE.md` (a ser criado em PA-16).

**Arquivos Afetados:**
- `supabase/migracao-consentimento.sql` (novo)
- `src/lib/dataService.js` — `leadFromDb` e `leadToDb`
- `src/apps/VendedorApp.jsx` — checkbox obrigatório + validação

**Status:** Ativa

---

### [D-032] — PA-01: Estratégia de proteção de credenciais legadas do bundle JavaScript

**Data:** 2026-06-16  
**Contexto:** PA-01 do Plano de Ação LGPD (NC S-01) — `VITE_MARKETING_PASS` era lida em escopo de módulo em `src/auth/Login.jsx` e incorporada literalmente no bundle JavaScript público pelo Vite (substituição estática em build time).

**Decisão:** Proteção em duas camadas:
1. **Guard de build** (`vite.config.js`): plugin `lgpdCredentialGuard` que aborta `npm run build` com `NODE_ENV=production` se `VITE_MARKETING_PASS` estiver definida — impede deploys acidentais com credenciais no bundle
2. **Guard de runtime** (`src/auth/Login.jsx`): `console.error` crítico quando `import.meta.env.PROD && import.meta.env.VITE_MARKETING_PASS` — camada secundária para detectar casos onde a variável passou pelo build

**Alternativas consideradas:**
- **Hash da senha no bundle** (SHA-256 de `VITE_MARKETING_PASS`): mitigaria exposição direta, mas continuaria vulnerável a rainbow tables para senhas fracas. Descartada — complexidade sem garantia de segurança adequada.
- **Edge Function de autenticação legada**: exige Supabase ativo — incompatível com o modo legado que existe justamente quando Supabase não está configurado. Descartada — contradição arquitetural.
- **Remoção total do modo legado**: eliminaria S-01 completamente, mas quebraria o fluxo de demo/desenvolvimento local. Descartada — impacto operacional sem benefício proporcional em ambientes onde a variável não é definida.

**Motivação da escolha:** A raiz do problema é operacional (alguém definir `VITE_MARKETING_PASS` nas variáveis de produção da Vercel), não apenas técnica. A solução mais eficaz é impedir que o build complete nessa condição — o código não chega ao deployment. O guard de runtime é defesa em profundidade.

**Restrição documentada:** O modo legado (`RootLegacy` → `Login`) é **estritamente para desenvolvimento local** e nunca deve ter `VITE_MARKETING_PASS` definida em ambientes com `NODE_ENV=production`.

**Arquivos Afetados:**
- `vite.config.js` — plugin `lgpdCredentialGuard` adicionado
- `src/auth/Login.jsx` — objeto `AUTH` removido; guard de runtime adicionado; credenciais lidas em handler `submit()`
- `src/auth/index.js` — re-export de `AUTH` removido
- `.env.example` — aviso de segurança adicionado

**Status:** Ativa

---

### [D-031] — Auditoria de LGPD, segurança e governança de dados

**Data:** 2026-06-16

**Tipo:** Segurança / Governança / Compliance

**Decisão:**
Realização de auditoria completa de LGPD, segurança da informação, governança de dados e arquitetura Supabase do sistema. Os resultados foram documentados em `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` como fonte oficial de conformidade. Um plano de ação executável com 21 itens foi criado em `doc/lgpd/PLANO_DE_ACAO_LGPD.md`.

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

**Plano de ação:** 21 ações organizadas em 4 fases (imediata, curto, médio e longo prazo). Ver `doc/lgpd/PLANO_DE_ACAO_LGPD.md` para o plano completo com responsáveis, prazos e evidências.

**Alternativas Avaliadas:**
Correção pontual de itens críticos sem auditoria formal — descartada pois não garante visão completa dos riscos nem conformidade sistêmica.

**Impactos:**
- Cria a base documental obrigatória para eventual fiscalização pela ANPD
- Define roteiro técnico claro para elevar a nota de conformidade de 4,2 para 8,7 (após Fase 4)
- Incorpora `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` e `doc/lgpd/PLANO_DE_ACAO_LGPD.md` como documentos obrigatórios de referência no `CLAUDE.md`

**Arquivos afetados:**
- `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` (criado)
- `doc/lgpd/PLANO_DE_ACAO_LGPD.md` (criado)
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
- Todos os arquivos criados ao longo das etapas (ver doc/architecture/historico/REFATORAÇÃO.md)

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

### [D-008] — Realtime via subscriptions Supabase com debounce

**Data:** Pré-15/06/2026

**Tipo:** Arquitetura / Performance

**Decisão:**
Mudanças no banco são recebidas via canais realtime do Supabase. As atualizações de estado React são debounced para evitar re-renders excessivos em bursts de eventos.

> **Atualização (D-038, 2026-06-17):** O valor de `REALTIME_DEBOUNCE_MS` foi aumentado de 400ms para **1500ms**. O valor atual vigente é 1500ms. Ver D-038 para a justificativa completa.

**Motivação:**
Sem debounce, múltiplas inserções em sequência (ex: vários vendedores registrando leads simultaneamente) causariam re-renders encadeados, degradando a performance do painel do marketing.

**Alternativas Avaliadas:**
- Polling periódico (descartada — latência maior, mais requisições)
- Realtime sem debounce (descartada — re-renders em cascata)
- WebSocket próprio (descartada — Supabase já fornece essa infraestrutura)

**Impactos:**
- Positivo: UI atualizada em tempo real com custo de re-render controlado
- Negativo: delay de até 1500ms para exibir mudanças externas (era 400ms — ver D-038)

**Arquivos Afetados:**
- `src/lib/dataService.js`
- `src/lib/constants.js` (`REALTIME_DEBOUNCE_MS` — valor atual: 1500, definido em D-038)

**Riscos:**
- Subscriptions não canceladas no unmount causam memory leak (mitigado por cleanup no `useEffect`)

**Status:** Ativa — valor do debounce atualizado por D-038

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
- `src/apps/VendedorApp.jsx` (dados migrados aqui na Etapa 13 — tab "Pacotes" hardcoded no JSX)
- `src/utils/mockData.js` (não alterado)

**Riscos:**
- Nenhum — decisão conservadora

**Status:** Ativa — dados movidos para `VendedorApp.jsx` na Etapa 13 (referência original a `main.jsx` é histórica)

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

### [D-028] — Organização dos docs em `doc/` com @import seletivo no CLAUDE.md

**Data:** 16/06/2026

**Tipo:** Infraestrutura / Documentação

**Decisão:**
Os arquivos de documentação (`CHANGELOG.md`, `DECISIONS.md`, `REFATORAÇÃO.md`, `SUPABASE.md`, `SYSTEM_MAP.md`) foram movidos da raiz do projeto para o diretório `doc/`. O `CLAUDE.md` permanece na raiz (convenção Claude Code). O `SYSTEM_MAP.md` é carregado automaticamente via `@doc/architecture/SYSTEM_MAP.md` no topo do `CLAUDE.md`. Os demais docs são consultados sob demanda com regras explícitas de quando ler cada um.

**Motivação:**
Raiz com 6 arquivos `.md` soltos dificultava a identificação de arquivos de código vs. documentação. Com o crescimento do projeto, novas docs especializadas (ex: `doc/WHATSAPP.md`, `doc/API.md`) entrariam no lugar natural sem poluir a raiz. Além disso, a convenção `@import` garante que a arquitetura viva seja sempre carregada, independente de o Claude decidir ou não ler `SYSTEM_MAP.md`.

**Alternativas Avaliadas:**
- Manter todos na raiz (descartada — escala mal; raiz fica ruidosa com novas docs)
- `@import` de todos os docs (descartada — consome contexto desnecessariamente; `REFATORAÇÃO.md` está concluída, `CHANGELOG.md` é histórico passivo)
- `@import` de `SYSTEM_MAP.md` + `DECISIONS.md` (avaliada — `DECISIONS.md` tem ~1000 linhas; custo de contexto alto; preferível regra explícita de quando ler)

**Impactos:**
- Positivo: raiz mais limpa; novos docs entram em `doc/` sem fricção; `SYSTEM_MAP.md` garantido em toda sessão
- Positivo: regras explícitas na tabela do `CLAUDE.md` guiam Claude sobre quando consultar cada doc
- Negativo: caminhos de referência nos docs precisam ser atualizados manualmente se houver mais movimentações

**Arquivos Afetados:**
- `doc/` (criado)
- `doc/CHANGELOG.md`, `doc/architecture/DECISIONS.md`, `doc/architecture/historico/REFATORAÇÃO.md`, `doc/architecture/SUPABASE.md`, `doc/architecture/SYSTEM_MAP.md` (movidos da raiz)
- `CLAUDE.md` (adicionado `@doc/architecture/SYSTEM_MAP.md`; tabela de referência atualizada com caminhos e coluna "Quando ler")
- `doc/architecture/SYSTEM_MAP.md` (nota de localização adicionada no cabeçalho)
- `doc/CHANGELOG.md` (entrada adicionada)

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
Execução integral do `doc/architecture/ARCHITECTURE_FIX_PLAN.md` — 6 correções aplicadas para eliminar desvios identificados na auditoria pós-refatoração de 18 etapas.

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
- `doc/architecture/SYSTEM_MAP.md` (C-6)
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

### [D-036] — QW-003: AbortSignal.timeout(15s) em fetchAll para evitar loading infinito

**Data:** 2026-06-17  
**Tipo:** Performance / UX

**Decisão:**
Adicionado `AbortSignal.timeout(15_000)` composto com o `AbortController` existente em `carregar()` do `AppProvider`, via `AbortSignal.any([controller.signal, timeoutSignal])`. A função `fetchAll()` recebia apenas o sinal do `AbortController` (sem timeout automático), podendo ficar pendente indefinidamente em conexão instável.

**Motivação:**
Vendedores usam o sistema em campo com conexão móvel instável (3G/4G em eventos). Sem timeout, o estado `isLoading=true` poderia perdurar por minutos em um timeout TCP silencioso, congelando a UI de captura de leads. O timeout de 15s garante que o usuário receba feedback de erro (via `syncStatus = ERROR`) dentro de um tempo razoável.

**Alternativas avaliadas:**
- Timeout dentro de `withRetry()` — descartado: alteraria o comportamento global do retry e não resolveria o caso de timeout TCP silencioso no Supabase client
- `Promise.race()` manual — descartado: `AbortSignal.any()` é mais elegante e suportado (Chrome 103+, Firefox 100+, Safari 15.4+)

**Impacto:**
- Positivo: elimina loading infinito; UX consistente em conexões instáveis
- Positivo: o `abortRef` existente (para cancelar na remontagem) continua funcionando independentemente
- Negativo: nenhum em condições normais (timeout de 15s não será atingido em conexão estável)

**Arquivos Afetados:**
- `src/context/AppProvider.jsx` (2 linhas adicionadas em `carregar()`)

**Riscos:**
- `AbortSignal.any()` requer browser moderno — verificado que está dentro do baseline de suporte do projeto

**Status:** Ativa

---

### [D-037] — QW-004: Column pruning no fetchAll (select explícito vs select *)

**Data:** 2026-06-17  
**Tipo:** Performance

**Decisão:**
Substituído `select('*')` por seleção explícita de colunas em todas as 4 queries do `fetchAll()` em `src/lib/dataService.js`. As colunas selecionadas correspondem exatamente ao que os mapeadores `*FromDb()` utilizam.

**Motivação:**
`select('*')` retorna todas as colunas, incluindo campos de auditoria (`criado_em` em perfis, timestamps internos) que não são mapeados pelo frontend. Com o crescimento do banco, cada `fetchAll` transfere dados desnecessários. Esta mudança reduz o payload em 10–30% sem impactar funcionalidade.

**Alternativas avaliadas:**
- Manter `select('*')` com compressão gzip (Supabase já aplica) — descartado: a compressão reduz o tamanho mas não a alocação de memória no cliente

**Impacto:**
- Positivo: redução de payload por `fetchAll`; menos memória alocada para parsing JSON
- Negativo: qualquer novo campo adicionado ao banco precisa ser explicitamente adicionado ao select

**Arquivos Afetados:**
- `src/lib/dataService.js` (query de `fetchAll` — 4 linhas)

**Riscos:**
- Baixo: se um novo campo for adicionado ao banco e esquecido no select, o mapeador retornará `undefined` para esse campo (comportamento já existente — os mapeadores já lidam com campos ausentes)

**Status:** Ativa

---

### [D-038] — QW-005: Aumento do REALTIME_DEBOUNCE_MS de 400ms para 1500ms

**Data:** 2026-06-17  
**Tipo:** Performance

**Decisão:**
`REALTIME_DEBOUNCE_MS` em `src/lib/constants.js` aumentado de `400` para `1500`. Esta constante controla o debounce do canal realtime Supabase que dispara `fetchAll()` após mutações no banco.

**Motivação:**
Com debounce de 400ms, um burst de leads inseridos com pausas > 400ms entre eles (ex: 5 leads em 2 segundos com pequenas variações de timing) ainda poderia gerar múltiplos `fetchAll()` consecutivos no dashboard do marketing. O valor de 1500ms coalesce bursts típicos de captura de leads em um único refetch.

**Trade-off aceito:**
O dashboard do marketing passa a refletir mudanças com até 1.5s de atraso em vez de 400ms. Para o caso de uso (dashboard de acompanhamento, não de controle em tempo real), 1.5s é imperceptível.

**Alternativas avaliadas:**
- Debounce de 2000ms — descartado: atraso perceptível em telas com animação de ranking
- Manter 400ms e resolver via delta realtime (TB-005) — a solução correta a longo prazo, mas de alta complexidade; o debounce é uma mitigação imediata de baixo risco

**Arquivos Afetados:**
- `src/lib/constants.js` (1 constante)

**Riscos:**
- Baixo: mudança de configuração centralizada; sem impacto em lógica de negócio

**Status:** Ativa

---

### [D-039] — TB-004: Carregamento de leads on-demand por evento

**Data:** 2026-06-17  
**Tipo:** Performance / Arquitetura

**Decisão:**
Removida a query de `leads` do `fetchAll()` de boot. Leads passam a ser carregados on-demand por evento via duas novas funções em `dataService.js`:
- `fetchLeadsEvento(eventoId, signal)` — para vendedor (evento ativo) e EventDetail (marketing)
- `fetchLeadsEventos(eventoIds[], signal)` — para exportação consolidada de múltiplos eventos

O `AppProvider` expõe `carregarLeadsEvento(eventoId)` no contexto. O realtime (`subscribeChanges`) continua funcionando: ao disparar `carregar()`, o AppProvider recarrega os leads do evento ativo se `eventoLeadsIdRef.current` estiver preenchido.

A `LeadsTab` foi redesenhada como "Central de Exportação": lista todos os eventos com checkboxes, botão "Exportar evento" (1 evento, CSV individual) e "Exportar consolidado" (N eventos, CSV único com coluna Evento agrupando os leads por bloco de evento).

**Motivação:**
O `fetchAll` carregava todos os leads históricos de todos os eventos sem `LIMIT`. Com o crescimento do banco (cada evento gera dezenas a centenas de leads), cada atualização realtime retransferiu o payload crescente. A separação por evento elimina o crescimento ilimitado: o payload por carregamento é sempre proporcional ao tamanho de um evento específico, não ao histórico total.

**Motivação da LeadsTab redesenhada:**
Marketing não precisa visualizar todos os leads simultaneamente — o fluxo real é exportar dados de eventos concluídos para o setor responsável. A exportação on-demand (busca apenas quando o botão é clicado) é mais eficiente e mais honesta sobre o custo da operação.

**Alternativas avaliadas:**
- `.limit(1000)` no fetchAll — descartado: resolve temporariamente mas não estruturalmente; silencia leads mais antigos sem feedback ao usuário
- Filtro temporal (últimos 90 dias) — descartado: marketing pode precisar exportar eventos de meses atrás sem saber o motivo; a seleção explícita por evento é mais precisa
- Manter leads no fetchAll com paginação lazy — descartado: aumenta complexidade do estado sem resolver o caso de uso do export consolidado

**Impacto:**
- `fetchAll` agora carrega apenas 3 tabelas (materiais, eventos, perfis/vendedores)
- Boot do app é ~30–60% mais rápido em volume alto (sem query de leads)
- Vendedor vê leads apenas do evento ativo (comportamento correto por requisito)
- Marketing exporta por evento ou consolidado sob demanda
- Realtime continua recarregando leads do evento ativo quando mutações ocorrem
- Fix secundário: `subscribeChanges` passa a usar `REALTIME_DEBOUNCE_MS` da constante (estava hardcoded em 400ms, ignorando o QW-005)

**Arquivos Afetados:**
- `src/lib/dataService.js` (fetchAll simplificado + 2 novas funções + fix debounce)
- `src/context/AppProvider.jsx` (carregarLeadsEvento + eventoLeadsIdRef + reload no realtime)
- `src/apps/VendedorApp.jsx` (useEffect para carregar leads do evento ativo)
- `src/features/events/EventDetail.jsx` (useEffect para carregar leads ao abrir evento)
- `src/features/leads/LeadsTab.jsx` (redesenho completo — central de exportação)
- `src/utils/csv.js` (nova função exportLeadsConsolidadoCSV)

**Riscos:**
- Médio: se `carregarLeadsEvento` não for chamado (ex: componente novo que usa `leads` do contexto), `leads` estará vazio. Mitigado pela documentação da restrição no SYSTEM_MAP.
- Baixo: em modo local (localStorage), o comportamento não muda — `leads` continua pré-carregado do MOCK_LEADS e `carregarLeadsEvento` é no-op.

**Status:** Ativa

---

### [D-040] — Painel de eventos: filtro padrão "Ativo" e reordenação dos chips

**Data:** 2026-06-17  
**Tipo:** UX

**Decisão:**
O filtro padrão da `EventosTab` foi alterado de `"todos"` para `"ativo"`. A ordem dos chips de filtro foi reordenada de `Todos / Ativo / Planejado / Encerrado` para `Ativo / Planejado / Encerrado / Todos`.

**Motivação:**
Com o acúmulo de eventos encerrados ao longo do tempo, a visão inicial do painel ficava poluída com histórico irrelevante para o dia a dia do marketing. O filtro `"Ativo"` como padrão exibe apenas o que está operacional. A reordenação dos chips segue a mesma lógica: o estado mais relevante operacionalmente aparece primeiro.

**Impacto:**
- Marketing abre o painel e vê apenas eventos ativos
- Eventos encerrados e histórico acessíveis via chips — nada foi removido
- Vendedor não é afetado (não tem acesso ao painel de eventos)

**Arquivos Afetados:**
- `src/features/events/EventosTab.jsx` (2 linhas)

**Riscos:**
- Nenhum — mudança de estado inicial de UI, sem impacto em dados

**Status:** Ativa

---

### [D-041] — Exclusão permanente de evento pelo marketing

**Data:** 2026-06-17  
**Tipo:** Feature / Segurança

**Decisão:**
Adicionado botão "Excluir Evento" na tela de detalhe do evento (`EventDetail`), disponível exclusivamente para o perfil marketing. O botão só aparece em eventos com `status !== "ativo"` — eventos ativos são protegidos contra exclusão acidental. A ação exige confirmação explícita via `confirm()` antes de executar.

**Motivação:**
O marketing precisava remover eventos de teste e entradas incorretas criadas durante a configuração do sistema. A operação `removeEvento` já existia na camada de API (`eventoApi.js`) e no `dataService`, mas não estava exposta na interface.

**Regra de segurança:**
Eventos com `status = "ativo"` não exibem o botão de exclusão. Isso impede que um evento seja apagado enquanto vendedores estão em campo capturando leads — situação que resultaria em perda de dados e inconsistência no ranking.

**Impacto:**
- Marketing pode excluir eventos planejados ou encerrados diretamente pelo detalhe do evento
- Exclusão é permanente e remove os leads associados (comportamento do `DELETE` em cascata no Supabase via RLS)
- Após confirmação, retorna automaticamente para a lista de eventos

**Arquivos Afetados:**
- `src/features/events/EventDetail.jsx` (botão + lógica de guarda)

**Riscos:**
- Médio: exclusão é irreversível. Mitigado pelo `confirm()` explícito e pela proteção de eventos ativos.
- Sem impacto no modo local (a operação `removeEvento` já funcionava nos dois modos)

**Status:** Ativa

---

### [D-042] — PA-08b: Reintrodução do CPF como campo opcional com finalidade declarada

**Data:** 2026-06-16  
**Tipo:** Feature / LGPD  

**Contexto:**
D-035 removeu o CPF do fluxo de check-in e do banco. Após implementação, identificou-se que o CPF é necessário para o fluxo de negócio de agendamento de visita técnica e assinatura de contrato — etapas que ocorrem após a conversão do lead.

**Decisão:**
Reintroduzir CPF como campo **opcional** no formulário de captura de leads, com label que declara a finalidade: *"opcional — para visita técnica e contrato"*. A coluna `cpf` foi readicionada ao banco como nullable.

**Justificativa:**
A não conformidade original (L-03 da auditoria LGPD) era sobre coleta sem finalidade declarada. Com a finalidade explicitada no label do campo e no formulário, a coleta passa a ter base legal no legítimo interesse do controlador (art. 7°, IX da LGPD) para execução do serviço contratado. O campo não é exibido no modo rápido de captura nem em check-in.

**Alternativas avaliadas:**
- Manter sem CPF — descartada: inviabiliza o fluxo pós-conversão (visita técnica e contrato exigem identificação)
- CPF obrigatório — descartada: viola minimização para leads que não chegam à fase de conversão

**Arquivos Afetados:**
- `supabase/migracao-readd-cpf.sql` (criado — `ADD COLUMN IF NOT EXISTS cpf text`)
- `src/lib/dataService.js` — `leadFromDb` e `leadToDb` com campo `cpf`
- `src/apps/VendedorApp.jsx` — campo CPF opcional no formulário e edição inline; exibido na lista apenas quando preenchido
- `src/utils/csv.js` — coluna CPF de volta na exportação para equipe técnica

**Risco residual aceito:**
CPF armazenado em texto plano (sem criptografia). O risco é menor do que na situação pré-PA-08 pois: (a) o campo agora é opcional, reduzindo o volume de CPFs armazenados; (b) a finalidade está declarada; (c) o check-in não utiliza mais CPF. A criptografia de CPF em repouso é registrada no backlog para avaliação futura.

**Status:** Ativa

---

### [D-055] — Exclusão de leads por vendedor: DELETE físico em vez de soft delete

> **Nota de renumeração (2026-06-30):** esta decisão foi registrada originalmente como "D-043", duplicando o ID já usado pela decisão de Suspensão do consentimento LGPD (linha ~365). Renumerada para D-055 (próximo ID livre após D-054) para eliminar a colisão. Conteúdo original preservado sem alteração de mérito.

**Data:** 2026-06-17
**Tipo:** Segurança / Bug Fix

**Contexto:**
PA-07 implementou rastreabilidade do soft delete via `UPDATE SET deletado=true, deletado_em=..., deletado_por=...`. No entanto, ao executar essa operação como vendedor, o PostgreSQL retornava "new row violates row-level security policy for table leads", mesmo com `vendedor_id = auth.uid()` correto e a policy `leads_update` com `WITH CHECK (papel_atual() = 'vendedor' AND vendedor_id = auth.uid())` aparentemente válida.

**Decisão:**
`db.removeLead` usa `supabase.from('leads').delete().eq('id', id)` em vez de UPDATE com soft delete. A rastreabilidade LGPD (BD-06, A-03) é preservada pelo trigger `audit_leads` (AFTER DELETE → `audit_log`).

**Motivação:**
A policy `leads_delete` usa apenas `USING` (sem `WITH CHECK`), contornando completamente o comportamento de RLS que bloqueava o UPDATE. O trigger `audit_leads` registra `tg_op = 'DELETE'`, `old.*` e `auth.uid()` na tabela `audit_log`, mantendo rastreabilidade equivalente à abordagem anterior.

**Alternativas Avaliadas:**
- Recriar `leads_update` com `WITH CHECK` mais permissivo — tentada e mantida falha; o comportamento parece ser específico da transição `deletado=false → true` no contexto do vendedor
- Manter soft delete com policy separada para soft delete — descartada: adiciona complexidade sem garantia de funcionar dado o comportamento observado
- Hard DELETE com trigger de auditoria — adotada: simples, confiável, auditada

**Impactos:**
- Leads excluídos por vendedor são removidos fisicamente do banco (não ficam com `deletado=true`)
- A política de retenção (PA-10) via cron job continua funcionando para leads soft-deleted pelo marketing
- Audit log registra a exclusão via trigger — rastreabilidade LGPD mantida
- Rollback automático de UI em caso de falha: `onFail` callback restaura o lead ao estado local

**Arquivos Afetados:**
- `src/lib/dataService.js` — `db.removeLead` usa `.delete()` e aceita `onFail`
- `src/api/leadApi.js` — `removeLead` passa rollback como `onFail`

**Riscos:**
- Leads excluídos por vendedor não são recuperáveis via `deletado=false` (hard delete); recuperação só via `audit_log`
- Colunas `deletado_em` e `deletado_por` não são preenchidas para exclusões de vendedor (preenchidas apenas quando marketing faz soft delete via UPDATE direto no banco)

**Status:** Ativa

---

### [D-057] — Área de Ofertas: imagem+copy prontas por serviço, envio manual via WhatsApp

**Data:** 2026-07-02
**Tipo:** Feature / Arquitetura

**Contexto:**
Vendedores em campo faziam follow-up de leads sem material padronizado. Foi avaliada primeiro uma ideia de "campanha em massa" (disparo automatizado, segmentação de leads, provedor externo de WhatsApp/e-mail, fila de processamento) e **descartada** por complexidade e risco desproporcionais ao porte do projeto (mantenedor único, sem infraestrutura de mensageria). A alternativa adotada reaproveita o link `wa.me` que já existia em `VendedorApp.jsx` ("Meus Leads"): em vez de disparo automatizado, o marketing prepara conteúdo (imagem 1080x1080 + copy) por serviço, e o vendedor dispara manualmente, 1:1, pelo próprio WhatsApp.

**Decisão:**
1. Tabela `public.ofertas` com **`servico` como chave primária** (um dos 5 valores do enum `servicoInteresse` já existente) — no máximo 5 linhas, sobrescritas quando o marketing edita. Sem histórico/versionamento.
2. Tabela `public.oferta_envios` — indicador de que o vendedor abriu o `wa.me` com a oferta pronta. **Não é confirmação de entrega ou leitura** (WhatsApp não expõe esse dado via `wa.me`); existe só para o vendedor ver "✓ Oferta enviada" ao lado do lead.
3. Primeiro uso de **Supabase Storage** no projeto — bucket `ofertas`, **público** (decisão consciente: são materiais promocionais sem dado pessoal de titular, o que evita toda a complexidade de signed URLs). Path determinístico por serviço (`<servico>.<ext>`), upload sempre com `upsert: true`.
4. `img-src` da CSP (`vercel.json`) ampliado para `https://*.supabase.co` — sem isso a imagem é bloqueada silenciosamente em produção/preview (CSP não existe em `npm run dev`, só na Vercel).
5. `db.saveOferta` é a única exceção ao padrão 100%-síncrono de `db.save*`: o upload no Storage precisa terminar antes do upsert na tabela (para saber o path final gerado).

**Motivação:**
Resolve a dor real (vendedor sem conteúdo padronizado) reaproveitando ~90% de padrões já existentes no projeto (`materialApi.js`, `MaterialModal.jsx`, `EstoqueTab.jsx`, o próprio `wa.me`), sem introduzir fila, provedor externo, credencial sensível ou segmentação em massa.

**Alternativas Avaliadas:**
- **Campanha em massa com segmentação e disparo automatizado** — descartada: exigiria backend próprio (Edge Function + fila + `pg_cron`), credencial de provedor de WhatsApp/e-mail (risco de vazamento equivalente ao já registrado para `VITE_MARKETING_PASS`), e brigaria com a decisão TB-004/D-039 de não carregar todos os leads de uma vez (segmentação cross-evento exigiria exatamente esse carregamento).
- **Histórico/versionamento de ofertas antigas** — descartada por escopo: não foi pedido, e `servico` como PK cobre o caso de uso real (1 oferta ativa por serviço) com schema mínimo.
- **Bucket privado com signed URLs** — descartada: adiciona complexidade sem ganho, já que as imagens não contêm dado pessoal de titular.

**Impactos:**
- `fetchAll()` passa a buscar também `ofertas` (tabela pequena e estática) no boot, no mesmo `Promise.all` de `materiais`/`eventos` — **não** reabre a decisão TB-004/D-039 de não carregar leads no boot, porque `ofertas` não é `leads`.
- `oferta_envios` é buscado sob demanda por evento (`fetchOfertasEnviadasEvento`), sempre em paralelo com `fetchLeadsEvento` — mesmo modelo on-demand dos leads.
- `oferta_envios.lead_id` tem `ON DELETE CASCADE` — o hard delete de leads pelo vendedor (D-055) já propaga corretamente, sem precisar de trigger de auditoria adicional (aqui não há dado pessoal novo, só um vínculo).
- Nova tab "Ofertas" no `MarketingApp` — proteção dupla UI+RLS, mesmo padrão do D-053 (tab só existe no shell do marketing; RLS restringe escrita em `ofertas` e no bucket a `papel_atual() = 'marketing'`).
- Modo local (sem Supabase): a tab existe mas fica sempre vazia (`ofertas`/`ofertasEnviadas` default `[]`), sem erro — decisão deliberada de não esconder a tab só nesse modo, por ser mais barato.

**Arquivos Afetados:**
- `supabase/migracao-ofertas.sql` (novo) — tabelas, RLS, bucket e policies de Storage
- `vercel.json` — CSP `img-src`
- `src/lib/dataService.js` — mappers `ofertaFromDb`/`ofertaToDb`, `fetchAll`, `fetchOfertasEnviadasEvento`, `db.saveOferta`/`removeOferta`/`registrarOfertaEnviada`
- `src/api/ofertaApi.js` (novo)
- `src/context/AppProvider.jsx` — estado `ofertas`/`ofertasEnviadas`, wiring da factory
- `src/components/modals/OfertaModal.jsx` (novo)
- `src/features/offers/OfertasTab.jsx` (novo)
- `src/apps/MarketingApp.jsx` — nova tab "Ofertas"
- `src/apps/VendedorApp.jsx` — botões "Enviar oferta: X" por lead, ao lado dos contatos existentes

**Riscos:**
- `oferta_envios` mede clique, não entrega — se for usado como métrica comercial de "quantas ofertas chegaram", vai superestimar (registrado explicitamente para não ser mal-interpretado no futuro).
- `wa.me` não anexa imagem automaticamente — o vendedor sempre tem um passo manual de salvar/anexar a foto; comportamento de "salvar imagem" varia entre iOS Safari e Android Chrome.
- Não resolve nem piora a pendência de consentimento LGPD (PA-04/D-043, suspensa) — por ser contato 1:1 iniciado pelo vendedor que já abordou o lead no evento, é o uso mais defensível dentro da finalidade "contato comercial" já redigida no termo suspenso, mas a base de consentimento em si continua pendente de decisão externa.

**Status:** Ativa

> **Atualização 2026-07-02 (pós-deploy):**
> - **Gotcha de deploy documentado**: tabelas criadas via SQL Editor não ficam imediatamente visíveis para o PostgREST (cache de schema) — `db.saveOferta`/`fetchAll` falhavam silenciosamente até rodar `NOTIFY pgrst, 'reload schema';` (ou Dashboard → Settings → API → Reload schema). Sintoma: escrita "funciona" na UI (otimista) mas some ao recarregar a página, e a lista de ofertas do vendedor fica sempre vazia. **Sempre rodar esse `NOTIFY` depois de aplicar `migracao-ofertas.sql`** (ou qualquer migração futura que crie tabela nova).
> - **UX consolidada**: em vez de 1 botão "Enviar oferta: `<serviço>`" por serviço do lead, agora é 1 botão "Enviar oferta" que abre `OfertaPickerModal` (novo componente local em `VendedorApp.jsx`) listando as ofertas disponíveis para aquele lead — mais limpo quando o lead tem vários serviços de interesse.
> - **Botão "Ligar" removido** de "Meus Leads" — contato passa a ser só via WhatsApp (genérico ou com oferta).
> - **Contraste corrigido**: `.lm-contact-whats` usava `#dcfce7`/`#16a34a` (par pensado pra tema claro, ilegível no tema escuro real do V3); trocado para `var(--green-bg)`/`var(--green)` com borda — mesmo par já usado em `.btn-check-devolucao`. `.lm-contact-call` removida (CSS morto após a remoção do botão).
> - **Erro de salvamento de oferta agora é visível**: `saveOferta` (`ofertaApi.js`) aceita um 3º parâmetro `onError`, propagado até `db.saveOferta` → `OfertaModal` exibe `alert()` com a mensagem real em caso de falha (upload no Storage ou upsert na tabela) — antes falhava 100% silenciosamente.
> - **Policy de SELECT faltando no bucket** (achada via o `alert` acima): `upload(..., { upsert: true })` faz `INSERT ... ON CONFLICT DO UPDATE` — resolver o conflito exige RLS de SELECT na linha existente, além de INSERT/UPDATE. As 3 policies de escrita (`ofertas_bucket_write/update/delete`) sozinhas não bastam; faltava `ofertas_bucket_read` (SELECT). Adicionada em `migracao-ofertas.sql`. Bucket ser público não substitui isso — o público só cobre a rota de leitura não-autenticada (`/storage/v1/object/public/...`), separada da RLS que protege a rota autenticada usada pelo upload.
> - **`OfertaPickerModal` centralizado mesmo em mobile**: os modais do app viram "bottom sheet" (ancorados embaixo) em telas ≤760px por regra global (`@media (max-width: 760px) { .modal-overlay { align-items: flex-end } }`). Nesse layout, o picker de ofertas ficava com a parte de baixo coberta pela barra de navegação do vendedor (`.vend-bottom-nav`, `z-index: 200` — maior que o `z-index: 100` do modal). Em vez de mexer no z-index global (afetaria todos os modais), o `OfertaPickerModal` ganhou classes extras (`oferta-picker-overlay`/`oferta-picker-box`) com override específico no mesmo media query, mantendo-o centralizado como no desktop. Os demais modais do sistema continuam bottom sheet normalmente.
> - **Download de imagem via blob**: o botão "Imagem" (abria em nova aba) virou "⬇️ Baixar". O atributo `download` do `<a>` é ignorado pelo navegador em links de outra origem (imagem fica no domínio do Supabase Storage) — `baixarOfertaImagem()` faz `fetch` + `Blob` + link temporário pra disparar o download de verdade, com fallback pra `window.open` se o `fetch` falhar. Limitação conhecida: em iOS Safari o comportamento pode variar por versão (algumas abrem prévia com "Salvar Imagem" em vez de salvar direto) — limitação da plataforma, não do código.
> - **Editar/excluir lead viram ícones discretos**: os botões grandes "Editar dados"/"Excluir lead" no rodapé do card saíram e viraram ícones ghost pequenos ao lado do nome/badge de temperatura, no topo — mesmo padrão visual do Estoque (`EstoqueTab.jsx`). CSS morto removido (`.lm-edit-btn`, `.lm-del-btn`).
> - **Picker deixou de filtrar só pelo interesse declarado do lead**: inicialmente `OfertaPickerModal` só listava ofertas cujo serviço estava em `l.servicoInteresse` (cadastrado na captação). Mudança: agora lista **todas** as ofertas configuradas (até 5), com as do interesse declarado ordenadas primeiro — o vendedor percebe interesse em outro serviço durante a conversa e envia na hora, sem precisar editar o lead antes só pra desbloquear o botão. Trade-off aceito conscientemente: perde-se o vínculo estrito "só oferece o que foi declarado", ganha-se agilidade operacional; não muda nada em `oferta_envios`/LGPD (mesmo contato 1:1 manual de sempre, decisão do vendedor, não do sistema).

---

### [D-058] — Captação de leads no dia a dia via "mês de referência" (fora de eventos)

**Data:** 2026-07-02
**Tipo:** Feature / Arquitetura

**Contexto:**
A diretoria aprovou expandir o uso do sistema: além dos eventos de campo criados pelo marketing, o vendedor deve poder registrar leads no dia a dia, associando cada lead a um mês (lista de 12, sem esse conceito ficar explícito como "evento" para o vendedor). Investigação prévia confirmou que `leads.evento_id` já é nullable e que nenhuma policy de RLS depende de evento — o acoplamento a evento estava inteiramente na camada de aplicação (seleção obrigatória de evento ativo em `VendedorApp.jsx`, RPC `ranking_evento`, carregamento on-demand por evento de D-039, e a rotina de retenção LGPD que só expurgava leads de eventos encerrados).

**Decisão:**
Adotado um campo próprio `leads.mes_referencia` (date, primeiro dia do mês) como contexto alternativo e mutuamente exclusivo ao `evento_id`, em vez de modelar os 12 meses como "eventos virtuais" na tabela `eventos`.
1. `check (num_nonnulls(evento_id, mes_referencia) = 1)` — todo lead pertence a exatamente um dos dois contextos.
2. RPC `ranking_mes(mref date)` espelhando `ranking_evento`; `fetchLeadsMes`/`fetchLeadsMeses`/`fetchOfertasEnviadasMes` espelhando as versões por evento (mesmo modelo on-demand do D-039).
3. `oferta_envios.mes_referencia` (nullable, espelha `evento_id`) — o fluxo "Enviar oferta" (D-057) funciona igual para leads de mês.
4. Extensão de `limpar_leads_expirados()` (PA-10/D-058) com um terceiro bloco simétrico ao de "evento encerrado há N dias": leads cujo mês de referência terminou há mais de `retencao_leads_mensais_dias` (365 por padrão) são expurgados fisicamente.
5. `VendedorApp.jsx` ganha um seletor "Evento" / "Atividade do Mês" sempre visível — o vendedor alterna livremente, não é um fallback só para quando não há evento ativo. O caminho "evento" permanece com exatamente o mesmo código/validações de antes (mudança aditiva, não reescrita).
6. `LeadsTab.jsx` (marketing) ganha uma segunda seção "Atividade Mensal" com o mesmo padrão de interação (checkbox de meses + exportar/consolidar) da seção de eventos — sem isso, leads de mês ficariam invisíveis para o marketing.

**Motivação:**
Atende ao pedido de negócio sem exigir evento algum para o vendedor produzir leads, e sem tocar em nenhum código já existente do fluxo de eventos.

**Alternativas Avaliadas:**
- **"Eventos virtuais"** — criar 12 linhas em `eventos` (uma por mês, sempre `status='ativo'`) e reaproveitar 100% do código de evento existente. Descartada: exigiria filtrar manualmente essas linhas em todos os pontos que hoje listam/contam `eventos` sem distinção (`Dashboard.jsx` — KPI "Eventos Ativos" e hero card, `EventosTab.jsx`, `getEventosAtivos()`, `getMateriaisDisponiveis()`), com risco real de vazar "meses" para telas do marketing que assumem que todo evento é um evento de campo real; e exigiria uma rotina de reseed anual (criar os 12 meses do próximo ano). O campo próprio elimina os dois problemas: zero mudança nas telas de evento, e a lista de meses é gerada no frontend a partir do ano corrente (`mesesDoAno`, sem manutenção).
- **Generalizar completamente `useRanking` num único hook data-driven por "tipo"** — descartada em favor de um parâmetro opcional (`obterFn`) simples: resolve a duplicação sem introduzir uma abstração nova.

**Impactos:**
- `leadFromDb`/`leadToDb` (`dataService.js`) mapeiam `mesReferencia` ↔ `mes_referencia`; `flushPendingQueue` não precisou de nenhuma mudança — o descarte de leads offline por evento encerrado só age quando `evento_id` é truthy, e leads de mês têm `evento_id: null`.
- `useRanking(id, leadsCount, obterFn)` ganhou um 3º parâmetro opcional (default = `obterRanking` do contexto) para ser reaproveitado com `obterRankingMes` sem duplicar toda a lógica de debounce/polling.
- Meta de leads (Bronze/Prata/Ouro, D-027) e o placar da equipe passam a ser calculados sobre `leadsDoContexto` (evento OU mês, conforme o modo ativo do vendedor) — mesmos limiares, sem mudança de regra de negócio.
- A coleta de dados pessoais deixa de ser exclusivamente "em eventos de campo" — refletido em `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md`, `doc/lgpd/ROPA.md` e `doc/lgpd/POLITICA_DE_PRIVACIDADE.md`.

**Arquivos Afetados:**
- `supabase/migracao-leads-mensais.sql` (novo) — coluna, constraint, índices, RPC `ranking_mes`, coluna em `oferta_envios`, extensão de `configuracoes_retencao`/`limpar_leads_expirados()`
- `src/lib/dataService.js` — mappers, `fetchLeadsMes`/`fetchLeadsMeses`/`fetchOfertasEnviadasMes`, `rankingMes`/`invalidarRankingMes`, `registrarOfertaEnviada`
- `src/api/leadApi.js` — `obterRankingMes`, invalidação de placar dual
- `src/hooks/useRanking.js` — parâmetro `obterFn` opcional
- `src/context/AppProvider.jsx` — `carregarLeadsMes`, `getLeadsMes`, ref de contexto de refetch dual (evento|mês)
- `src/utils/format.js` — `mesesDoAno`, `mesReferenciaLabel`
- `src/utils/csv.js` — `exportLeadsMesCSV`/`exportLeadsMesConsolidadoCSV`
- `src/apps/VendedorApp.jsx` — seletor de contexto, `leadsDoContexto`, submits condicionais
- `src/features/leads/LeadsTab.jsx` — seção "Atividade Mensal"

**Riscos:**
- Baixo/médio: vendedor pode esquecer de trocar o contexto e registrar no mês quando deveria ser no evento (ou vice-versa) — mitigado pelo seletor ficar sempre visível no topo da tela e pelo default inteligente (evento se houver um ativo, senão mês).
- Baixo: `oferta_envios`/consentimento (D-043, suspensa) seguem com a mesma pendência de antes — nada piora nem resolve aqui, é herdado do fluxo de evento.

**Status:** Ativa

---

### [D-059] — Terceiro perfil "comercial": mesmo nível de eventos/ofertas/relatórios do marketing, sem estoque nem gestão de equipe

**Data:** 2026-07-06
**Tipo:** Feature / Arquitetura / RBAC

**Contexto:**
O uso diário do sistema por vendedores em campo vai começar de fato, e a gerência comercial (que acompanha os vendedores, mas não é marketing) precisa de login próprio para acompanhar eventos, ofertas e relatórios de leads — hoje só existem os papéis `marketing` (acesso total) e `vendedor` (escopo próprio).

**Nota histórica:** já existiu um papel `comercial` no sistema, **antes** da arquitetura atual de Supabase Auth/RLS/factory (commits de 2026-06-09/12, era do protótipo local com `localStorage`). Era **somente leitura** (leads e eventos) e foi removido por decisão de simplificação ("sistema unificado em marketing e vendedor"), documentada apenas em `CLAUDE.md`/`SUPABASE.md` da época (pré-numeração D-NNN). Um bug relacionado — conflito de sessão entre abas de marketing e comercial — foi corrigido movendo a sessão para `sessionStorage`; essa correção já está presente na arquitetura atual (`src/lib/supabase.js`: `auth: { storage: sessionStorage }`), então não se repete aqui. O papel reintroduzido por este D-059 **não é o mesmo**: tem escrita em eventos/ofertas/leads (não só leitura), reaproveitando o RBAC via RLS que não existia na versão anterior.

**Decisão:**
1. `perfis.papel` passa a aceitar `'comercial'` além de `'marketing'`/`'vendedor'` (`perfis_papel_check`).
2. RLS: `comercial` ganha o **mesmo nível de escrita do marketing** em `eventos`, `ofertas` (+ bucket Storage `ofertas`) e `leads` (insert/update/delete de qualquer lead, não só os próprios — mesmo padrão de `marketing`, para permitir acompanhar/corrigir dados de qualquer vendedor).
3. `materiais` (estoque) e `perfis` (gestão de equipe — criar/ativar/desativar/excluir usuário, trocar papel) **permanecem exclusivos de `marketing`** — nem RLS nem a Edge Function `atualizar-email-usuario` mudam nessas duas áreas. Decisão explícita do responsável pelo sistema: comercial não deve mexer em estoque nem em contas de acesso, por ora.
4. Novo shell de frontend `ComercialApp.jsx` — mesma casca visual de `MarketingApp.jsx`, com só 4 tabs: Início (Dashboard, somente leitura), Eventos, Ofertas, Relatórios (Leads). Sem Estoque, sem Equipe, sem Check-in, sem Monitor.
5. `RootAuth.jsx` ganha um terceiro branch (`session.role === 'comercial'` → `ComercialApp`); `RootLegacy.jsx` (modo local sem Supabase) **não** ganha esse papel — é um modo de dev com credenciais fixas via env, sem gestão real de usuários, fora de escopo aqui.
6. `EquipeAuthTab.jsx` (painel de usuários, ainda marketing-only) ganha uma terceira seção "Comercial" e a opção no seletor de papel — é o próprio marketing quem cria/gerencia as contas comerciais, já que Equipe continua fora do alcance do papel comercial.

**Motivação:**
Resolve a necessidade de negócio (gerente comercial acompanhando vendedores em produção, com uso diário já em andamento) reaproveitando 100% do padrão RBAC já existente (RLS por `papel_atual()`, proteção dupla UI+RLS do D-053/D-057) — sem introduzir uma dimensão nova de permissão (ex: granularidade por evento) que não foi pedida.

**Alternativas Avaliadas:**
- **Reaproveitar o papel `marketing` e restringir só na UI** — descartada: sem RLS própria, um comercial mal-intencionado (ou uma sessão comprometida) teria acesso de escrita a `materiais`/`perfis` direto via API, quebrando a garantia de proteção dupla que o resto do projeto segue à risca.
- **Permissão granular por evento/vendedor** — não pedida; comercial enxerga/edita tudo em eventos/ofertas/leads, igual marketing, só sem estoque/equipe.
- **Reintroduzir o `comercial` antigo (somente leitura)** — descartada porque o pedido de negócio atual é explicitamente de edição ("poderá alterar... ofertas/relatórios/eventos"), não só observação.

**Impactos:**
- Mudança 100% aditiva: nenhuma policy de `marketing`/`vendedor` existente foi removida ou reescrita, só estendida com `OR papel_atual() = 'comercial'` onde fazia sentido. Vendedores e marketing em produção não têm nenhuma mudança de comportamento.
- `fetchAll()`/`carregarLeadsEvento`/`carregarLeadsMes` não mudam — já eram neutros a papel (dependem só de `papel_atual() is not null` para leitura).
- Dashboard (Início) do comercial reaproveita `Dashboard.jsx` tal qual — o KPI "Materiais Críticos" é só leitura (RLS de `materiais` não muda), então não expõe nenhuma ação de escrita indevida.

**Arquivos Afetados:**
- `supabase/migracao-comercial.sql` (novo) — constraint de papel, policies de `eventos`/`ofertas`/`leads`/bucket `ofertas`
- `src/apps/ComercialApp.jsx` (novo)
- `src/apps/Root.jsx` — wiring do `ComercialApp` no `RootAuth`
- `src/auth/RootAuth.jsx` — terceiro branch de roteamento por papel
- `src/features/team/EquipeAuthTab.jsx` — seção "Comercial", `PAPEL_LABEL`, selects de papel
- `src/index.css` — `.equipe-section--comercial`

**Riscos:**
- Baixo: como comercial tem escrita ampla em `leads` (igual marketing), um erro de digitação/edição por um comercial afeta dados de qualquer vendedor — mesmo risco que já existe para marketing hoje, não é uma superfície nova.
- Baixo: se no futuro o comercial precisar gerenciar equipe, será uma nova decisão (D-06x) — deliberadamente fora de escopo aqui a pedido do responsável pelo sistema.
- Nenhum: a migração não altera `RootLegacy.jsx` (modo local) nem exige mudança em ambiente de dev sem Supabase — o papel só existe em modo Supabase Auth.

**Status:** Ativa

> **Atualização 2026-07-06 (bug pós-deploy, achado ao validar D-060):**
> A migração original só estendeu as policies de **escrita** de `leads` (`leads_insert`/`update`/`delete`) para `comercial` — a policy de **leitura** (`leads_select`) não foi tocada e continuou restrita a `marketing`/`vendedor` (definida em `protecao-dados.sql`, antes de D-059 existir). Resultado observado em produção: o card "Mês/Dia a dia" (D-060) mostrava a contagem certa de leads/vendedores pro comercial (via `ranking_mes`, função `security definer` que ignora RLS), mas a tela de detalhe (`MesDetail`/`EventDetail`, que fazem SELECT direto na tabela) vinha sempre vazia — mesmo bug valeria pra aba Eventos do comercial. Corrigido em `migracao-comercial.sql`: `leads_select` e `oferta_envios_select` (mesma lacuna, mesma categoria) passam a aceitar `comercial` também. Arquivo é idempotente — basta rodar de novo no SQL Editor.

---

### [D-060] — Cards clicáveis "Evento" e "Mês/Dia a dia" no Início, com `MesDetail.jsx` espelhando `EventDetail.jsx`

**Data:** 2026-07-06
**Tipo:** Feature / UX

**Contexto:**
O responsável pelo sistema queria, para o mês de referência (D-058), a mesma visão que já existe por evento — gráfico "Leads por Vendedor" + tabela de leads (`EventDetail.jsx`). A ideia inicial (ícone de "visualizar" na tabela de exportação da aba Relatórios) foi substituída, a pedido do próprio responsável, por dois cards clicáveis no Início (Dashboard) — no mesmo estilo do hero card "Evento Ativo" que já existia — cada um levando ao detalhe do seu contexto.

**Decisão:**
1. Novo componente `src/features/leads/MesDetail.jsx` — mesma estrutura da seção "LEADS" de `EventDetail.jsx` (gráfico de barras "Leads por Vendedor" + busca + tabela), **sem** a parte de materiais (não existe estoque alocado a mês). Usa `carregarLeadsMes`/`getLeadsMes`, já existentes desde D-058.
2. `Dashboard.jsx` ganha um segundo hero card, "MÊS / DIA A DIA", ao lado do já existente "EVENTO ATIVO" (`grid-2`). Ambos os cards agora são clicáveis (`onOpenEvento`/`onOpenMes`, props novas do componente) e navegam para o detalhe do respectivo contexto.
3. Os dois cards passam a calcular "leads"/"vendedores" via `obterRanking(eventoId)`/`obterRankingMes(mes)` (RPC agregada, com cache de 30s) em vez de derivar do array `leads` do contexto — esse array só contém o contexto (evento ou mês) carregado por último em alguma outra tela (D-039/D-058), então o card do Início quase sempre mostraria 0 até o usuário abrir aquele evento/mês manualmente. Esse ajuste também corrige esse comportamento pro card "Evento Ativo", que já existia.
4. `mesAtualRef()` (novo util em `format.js`) gera o mês corrente no formato `mes_referencia` (`"2026-07-01"`), reaproveitando o mesmo formato de `mesesDoAno`/`mesReferenciaLabel` (D-058).
5. `MarketingApp.jsx`/`ComercialApp.jsx` ganham um estado `mesDetalhe` (espelhando `detailId`, já usado para o evento) e funções `abrirEvento`/`abrirMes` que trocam de aba **e** abrem o detalhe certo num só clique a partir do card do Início.
6. **Paleta:** a primeira versão usava uma cor azul para diferenciar visualmente os dois cards (e a seção "Comercial" do D-059). Corrigido a pedido do responsável pelo sistema: a marca RJNet é amarela, então ambos os cards e a seção "Comercial" usam o mesmo amarelo (`--yellow`) do resto do app — sem introduzir uma segunda cor de destaque.

**Motivação:**
Dá ao marketing/comercial (D-059, que também usa esse Dashboard) um "exemplo visual" imediato do que está sendo captado tanto em evento quanto no dia a dia, reaproveitando ~90% do código já existente (`EventDetail`, `carregarLeadsMes`/`getLeadsMes`, `obterRanking`/`obterRankingMes`, `ChartView`) — sem nenhuma migração de banco.

**Alternativas Avaliadas:**
- **Ícone "visualizar" por linha na tabela de exportação (`LeadsTab.jsx`)** — descartada a pedido do responsável em favor dos cards no Início, mais visíveis e consistentes com o hero card que já existia.
- **Card do mês carregando `carregarLeadsMes` direto no `Dashboard`** — descartada: substituiria o array `leads` do contexto compartilhado (`AppProvider`) só para exibir um número no card, conflitando com qualquer outra tela que dependa desse mesmo array (ex: se o usuário estivesse com um evento aberto). `obterRanking`/`obterRankingMes` (RPC própria, com cache, sem tocar o array principal) resolve sem esse efeito colateral.
- **Bug corrigido durante a implementação, achado por acidente**: `--rj-blue` (usada em D-059 para a seção "Comercial") na verdade vale `#ffcb00` — é o nome legado da cor de marca (amarelo), não azul. Confirmado com o responsável que a marca é mesmo amarela; a correção foi usar `var(--yellow)` (variável correta e já definida) em vez de introduzir uma cor nova. **Não foi mexido** o `--rj-yellow` usado em `.equipe-section--admin` (D-053/pré-D-059) — essa variável nunca foi definida em `:root`; é um bug pré-existente, fora do escopo desta sessão.

**Impactos:**
- `src/features/leads/index.js` — novo export `MesDetail`
- `src/features/events/Dashboard.jsx` — dois hero cards clicáveis, stats via ranking agregado em vez de `leads` local
- `src/apps/MarketingApp.jsx`/`ComercialApp.jsx` — estado `mesDetalhe`, funções `abrirEvento`/`abrirMes`
- `src/utils/format.js` — `mesAtualRef()`
- `src/index.css` — `.hero-card-clickable`, `.hero-card-mes` (estrutural, sem cor própria); `.equipe-section--comercial` corrigida para `var(--yellow)`
- Nenhuma mudança de banco/RLS — 100% frontend, reaproveitando dados/endpoints já existentes de D-058

**Riscos:**
- Nenhum: mudança aditiva de UI, sem migração. Pior caso é o card do mês mostrar "0 leads" quando de fato não há nenhum lead capturado no mês corrente ainda — comportamento correto, não um bug.

**Status:** Ativa

> **Atualização 2026-07-06 (ajuste de UX a pedido do responsável pelo sistema):**
> O item 5 da decisão original (`mesDetalhe` em `MarketingApp`/`ComercialApp`, trocando pra aba Relatórios) foi **revertido**. O responsável não queria ser levado para Relatórios ao clicar no card do mês — queria que o detalhe abrisse **no próprio Início**, sem trocar de aba. Mudança: `mesAberto` agora é estado **local do `Dashboard.jsx`** (não mais levantado para o shell); ao clicar no card "Mês/Dia a dia", o `Dashboard` troca sua própria renderização para `<MesDetail>` (o mesmo componente, só que não navega mais para lugar nenhum — a aba "Início" nunca deixa de estar ativa no menu). `mesDetalhe`/`abrirMes` foram removidos de `MarketingApp.jsx`/`ComercialApp.jsx` (ficaram mortos); `Dashboard` não recebe mais a prop `onOpenMes`. O botão de voltar do `MesDetail.jsx` mudou de "Voltar para Relatórios" para "Voltar para o Início", já que esse componente só é aberto a partir do Dashboard agora. **O card "Evento Ativo" não mudou** — continua levando para a aba Eventos e abrindo `EventDetail` lá, porque só o comportamento do card de mês foi pedido para mudar.

---

### [D-061] — QR Code como canal de captação: atributo de proveniência, não contexto operacional

**Data:** 2026-07-06
**Tipo:** Arquitetura / Feature

**Contexto:**
Evolução de produto discutida em profundidade antes de implementar: o Lead reafirmado como entidade central do sistema, com `addLead()`/pipeline único de Captação como porta de entrada obrigatória para qualquer canal (Evento, QR Code, e futuramente Landing Page/Meta Ads/Google Ads/API). Marketing passou a ser entendido como o domínio de negócio responsável por gerar demanda (não só um papel de acesso). Antes de implementar QR Code, foi definido um teste reutilizável pra classificar qualquer canal novo: **ele é uma sessão de trabalho ao vivo do vendedor (como Evento/Atividade do Mês — com ranking, meta, contexto), ou é só um atributo de proveniência (de onde o Lead veio)?** QR Code se encaixa na segunda categoria.

**Decisão:**
1. Colunas aditivas em `leads` (nunca substituindo `evento_id`/`mes_referencia`, que continuam sendo o único contexto operacional real): `origem`, `qr_code_id`, `qr_code_label`. Constraint `leads_evento_xor_mes` relaxada de `= 1` para `<= 1` — um lead de QR Code "avulso" não tem nem evento nem mês.
2. `supabase/functions/captar-lead-qrcode`: Edge Function pública (sem sessão), único ponto de escrita para leads de QR Code — valida e sanitiza no servidor (mesmas regras de `sanitizeText`/`validarTelefone` do frontend, duplicadas em Deno por não poder importar os módulos do bundle do app), exige consentimento LGPD, grava com `service_role`. `vendedor_id`/`vendedor_nome` nascem nulos.
3. RLS de `leads_select` ajustada: papel `vendedor` só enxerga leads com `vendedor_id is not null`; marketing/comercial continuam com leitura total (inclui leads sem responsável, necessário para a fila de distribuição). Sem impacto em nenhum lead existente — 100% deles já nascem com vendedor definido pelos fluxos de Evento/Mês.
4. Distribuição manual: seção "Leads sem vendedor" em `LeadsTab.jsx` (marketing/comercial) — dropdown de vendedor ativo por linha, reaproveitando a mesma operação de negócio de qualquer edição de lead.
5. `VendedorApp.jsx` ganha um terceiro item no seletor de contexto ("QR Code"), tratado explicitamente **diferente** de Evento/Mês: sem ranking, sem meta, sem opção de registro manual (mensagem informativa na aba Registrar) — só lista os leads de QR Code já distribuídos a esse vendedor (`origem === 'qrcode' && vendedorNome === próprio`).
6. `QrCodeGeradorTab.jsx` (aba marketing-only): gera URL (`/qr/:id`) + imagem do QR 100% client-side (biblioteca `qrcode`), sem persistir nada em tabela nova nesta fase — a identidade do QR (nome/local/serviço/campanha) viaja na própria URL como label.
7. Roteamento mínimo em `main.jsx` (checagem de `window.location.pathname` antes de `AppProvider`/`Root`, sem biblioteca de rotas) + rewrite em `vercel.json` para `/qr/:path*` (necessário porque a Vercel só serve arquivos estáticos existentes; sem o rewrite, acessar `/qr/:id` direto dá 404 antes do React carregar).
8. Alternativa disponível, não obrigatória: o QR pode apontar para um Google Forms em vez do formulário próprio — `supabase/functions/captar-lead-qrcode/google-forms-apps-script.js` é uma referência de instalação (não roda no build do app) de um gatilho `onFormSubmit` que reencaminha cada resposta do Forms pra essa mesma Edge Function, reaproveitando toda a validação/consentimento. Configurável via `GOOGLE_FORM_BASE_URL`/`GOOGLE_FORM_ENTRY_QRCODE` em `QrCodeGeradorTab.jsx` (vazio por padrão → usa o formulário próprio).

**Motivação:**
Preservar 100% do comportamento de Evento/Atividade do Mês (ranking, meta, fetch sob demanda) sem duplicar essa infraestrutura pra cada canal novo. O teste "é sessão de trabalho ou é atribuição?" fica documentado como critério reutilizável pra QR Code, Landing Page, Meta/Google Ads e qualquer canal futuro.

**Alternativas Avaliadas:**
- **Entidade `origens` polimórfica** cobrindo todos os canais de forma genérica — descartada: peso arquitetural sem necessidade concreta hoje. QR Code e futuros canais (ex: Form Builder, D-062) resolvem sozinhos com uma tabela satélite própria quando precisam de dado rico, sem precisar de um supertipo comum.
- **QR Code como terceira natureza operacional** (ranking/fetch/contexto próprio, espelhando Evento/Mês) — descartada: não existe "sessão de trabalho" de QR Code: ninguém "está trabalhando" um QR Code do jeito que trabalha um evento.
- **Formulário público próprio vs. Google Forms** — mantidos os dois como opções (item 8): próprio dá controle total de marca e mantém o consentimento como validação de código testada; Google Forms remove a superfície pública do próprio domínio, à custa de menos controle visual e do consentimento virar configuração do Form (não código).

**Impactos:**
Arquivos principais: `supabase/migracao-qrcode.sql`, `supabase/migracao-qrcode-retencao.sql`, `supabase/functions/captar-lead-qrcode/`, `src/features/qrcode/QrCodeGeradorTab.jsx`, `src/public/QrCapturaPublica.jsx`, `src/lib/localPublicSubmit.js`, `src/main.jsx`, `vercel.json`, `src/features/leads/LeadsTab.jsx` (fila de distribuição), `src/apps/VendedorApp.jsx` (bucket QR Code). PR #67, branch `claude/optimistic-einstein-jwz8q6`, mesclado em `main` (`c1368ab`).

**Riscos:**
- Superfície pública nova (Edge Function sem autenticação): mitigada por validação server-side completa e consentimento obrigatório; **sem rate-limiting/CAPTCHA implementado** — se o volume de spam crescer, é a próxima camada a adicionar.
- Retenção LGPD de leads sem contexto operacional não coberta inicialmente por `limpar_leads_expirados()` — corrigida em D-064 (item 4).

**Status:** Ativa

---

### [D-062] — Form Builder: catálogo fixo de campos (não motor de campo genérico)

**Data:** 2026-07-06
**Tipo:** Arquitetura / Feature

**Contexto:**
Pedido de um "Form Builder" dentro do sistema — marketing/comercial cria formulários escolhendo campos como nome, telefone, bairro, serviço de interesse. Antes de implementar, foi comparada uma análise de duas abordagens: **Opção A** — motor de campo genérico (JSON Schema livre, tipos de campo definidos em runtime pelo usuário, tabela de respostas própria desconectada do Lead); **Opção B** — catálogo fixo de campos conhecidos definidos em código, o formulário só escolhe/ordena/exige um subconjunto.

**Decisão:**
Adotada a Opção B. `CAMPOS_FORMULARIO` (catálogo fixo, `src/lib/constants.js`): `nome`, `telefone`, `endereco`, `bairro` (campo novo, adicionado a `leads` nesta decisão), `cpf`, `servicoInteresse` — cada um com o validador simples já existente no projeto (`sanitizeText`/`validarTelefone`/whitelist de serviço). Toda resposta de formulário é só mais um Lead (`origem='formulario'`, `formulario_id`), pelo mesmo pipeline único de Captação — nunca uma entidade de "resposta de formulário" separada, com schema próprio.

**Arquivos principais:**
- `supabase/migracao-form-builder.sql`: tabela `formularios` (`id`, `nome`, `slug` único, `campos`/`campos_obrigatorios` jsonb — só chaves do catálogo fixo, `ativo`). RLS: marketing/comercial gerenciam; leitura interna para qualquer papel autenticado; **primeira leitura anônima do projeto** (papel `anon`, restrita a `ativo = true`, sem dado sensível — só nome/lista de campos) — necessária porque a página pública do formulário não tem sessão nenhuma e precisa saber quais campos desenhar. Coluna `leads.bairro` e `leads.formulario_id`.
- `supabase/functions/submeter-formulario`: Edge Function pública, valida pelo catálogo fixo de tipos (`TIPO_POR_CAMPO`, espelha `CAMPOS_FORMULARIO`) — nunca aceita um `tipo` vindo do cliente, sempre a config gravada em `formularios` (só marketing/comercial autenticados escrevem essa tabela). Honeypot antispam (campo `website` que só um robô preenche).
- `src/features/formularios/FormBuilderTab.jsx`: criação de formulário (checklist de campos + obrigatório) e reaproveita a geração de QR/link do gerador de QR Code (D-061).
- `src/public/FormularioPublico.jsx`: renderização dinâmica só dos campos habilitados pelo formulário.
- `src/lib/localPublicSubmit.js`: fallback em modo local/preview (sem Supabase configurado) — grava direto em `localStorage['rjnet_leads']`, reaproveitado tanto pelo QR Code quanto pelo Form Builder, só para permitir testar o fluxo inteiro num preview sem backend real. **Nunca é o caminho de produção** (produção sempre passa pela Edge Function).
- `src/features/leads/LeadsTab.jsx`: fila de distribuição generalizada de `fetchLeadsQrCode` (só QR Code) para `fetchLeadsSemVendedor` (qualquer origem fria — QR Code e Form Builder juntos, com coluna "Origem" indicando qual).

**Motivação:**
Atender "gerar formulário de acordo com o que eu preciso, com QR/link próprio" sem abrir mão da estabilidade de schema do Lead — exportação CSV, cards do vendedor e filtros do marketing continuam podendo assumir um conjunto conhecido de campos.

**Alternativas Avaliadas:**
- **Motor de campo genérico (Opção A)** — descartada: exigiria um interpretador de validação genérico rodando num endpoint público sem autenticação (mais superfície de bug num lugar sensível), uma tabela de respostas desconectada do Lead (quebraria tudo que hoje espera campos fixos: CSV, cards, filtros), e nenhum tipo de campo além dos já usados no projeto foi realmente necessário.
- **Google Forms como única via de formulário** — não descartada, mantida como opção adicional específica de QR Code (D-061); o Form Builder próprio resolve o caso onde se quer um formulário configurável dentro do próprio sistema, com resposta já integrada à fila de distribuição.

**Impactos:** PR #67 (commit `c3a025d`), branch `claude/optimistic-einstein-jwz8q6`, mesclado em `main` (`c1368ab`).

**Riscos:**
Nenhum tipo de campo além de texto/telefone/cpf/serviço. Se um dia for necessário um tipo genuinamente diferente (data, número, múltipla escolha), isso é uma decisão de ampliar o catálogo (`CAMPOS_FORMULARIO` + coluna nova em `leads`, mesma receita de `bairro`), não algo que o motor deveria inferir sozinho.

**Status:** Ativa

---

### [D-063] — Campos personalizados: extensão controlada do catálogo do Form Builder pela própria equipe

**Data:** 2026-07-06
**Tipo:** Feature (incremento sobre D-062)

**Contexto:**
Depois de usar o Form Builder (D-062), o responsável pelo sistema pediu mais flexibilidade: poder adicionar ao formulário "itens que eu preciso e que a equipe precisa" — campos que serão "discutidos em equipe" e vão surgindo com o tempo — sem depender de um desenvolvedor a cada campo novo. Importante: isso não é o mesmo pedido de "motor de campo genérico" (Opção A, rejeitada em D-062) — é autonomia pra equipe **estender o catálogo**, mantendo o tipo sempre simples.

**Decisão:**
Nova tabela `campos_personalizados`, gerenciada por marketing/comercial: cada campo tem só uma legenda livre (`label`) e é **sempre texto livre** — nunca um tipo/validação novo escolhido pela equipe. Reutilizável em qualquer formulário (não é específico de um form). Respostas gravadas em `leads.campos_extras` (jsonb, chave = `key` do campo personalizado, gerada por slug), separado das colunas fixas do catálogo — evita colisão de chave entre um campo fixo e um personalizado, e deixa claro que essa lista é sempre texto simples, nunca precisa do validador por tipo do catálogo fixo.

**Arquivos principais:**
- `supabase/migracao-campos-personalizados.sql`: tabela `campos_personalizados` (mesmo padrão de RLS de `formularios` — marketing/comercial escrevem, authenticated lê tudo, anon lê só `ativo=true`); `formularios.campos_personalizados_ids`/`campos_personalizados_obrigatorios` (jsonb, lista separada de `campos`/`campos_obrigatorios` de propósito); `leads.campos_extras` (jsonb).
- `src/api/campoPersonalizadoApi.js` + wiring em `AppProvider.jsx` (mesmo padrão de factory já usado por Ofertas/Formulários).
- `FormBuilderTab.jsx`: seção "Campos personalizados" (criar/ativar/desativar/excluir) + seleção deles (incluir/obrigatório) ao montar um formulário, ao lado do catálogo fixo.
- `submeter-formulario`: busca as definições referenciadas pelo formulário, valida obrigatoriedade (mesma `sanitizeText`), grava `campos_extras` (chave = `key`, valor sanitizado).
- `FormularioPublico.jsx`: renderiza cada campo personalizado como um input de texto simples (Supabase ou fallback local).
- Exibição genérica (`rótulo: valor`) na fila de distribuição (`LeadsTab.jsx`) e no card de Meus Leads do vendedor (`VendedorApp.jsx`) — resolve "onde a equipe vê essa resposta" sem precisar redesenhar a tela a cada campo novo criado.

**Motivação:**
Dar autonomia real à equipe (self-service, sem deploy de código a cada campo) sem reabrir a decisão de D-062 de não ter motor de campo genérico — o "tipo" nunca é uma escolha da equipe, só a legenda.

**Alternativas Avaliadas:**
- **Ampliar só o catálogo fixo em código** (`CAMPOS_FORMULARIO`) a cada campo pedido — descartada como única via: o responsável explicitamente queria não depender de mim pra cada campo novo, dado que os campos "serão discutidos em equipe" continuamente.
- **Tipos variados pro campo personalizado** (número, data, múltipla escolha) — não implementado agora; se necessário no futuro, é uma ampliação pontual do "tipo" aceito, decidida caso a caso, não uma escolha livre da equipe na hora de criar o campo.

**Impactos:** PR aberto após o merge de D-061/D-062 (branch `claude/optimistic-einstein-jwz8q6` reiniciada a partir de `main` pós-merge do PR #67), commit `964e1fc`.

**Riscos:**
Campos personalizados ainda não aparecem em exportação CSV/relatórios estruturados — só na exibição genérica inline nas telas de lead. Se o volume de uso crescer, vale considerar expor como colunas dinâmicas no CSV.

**Status:** Ativa

---

### [D-064] — Correções pós-implementação: persistência da distribuição, retenção LGPD e CORS das Edge Functions públicas

**Data:** 2026-07-06
**Tipo:** Bugfix

**Decisão / Correções:**
1. **`updateLead()` do contexto silenciosamente não gravava no banco** quando o lead não estava no array `leads` compartilhado do `AppContext` — caso dos leads "frios" (QR Code/Form Builder), buscados à parte via `fetchLeadsSemVendedor()`/`fetchLeadsQrCode()`, nunca carregados no array principal (que só é populado por contexto evento/mês sob demanda, D-039). A tela de distribuição mostrava "atribuído com sucesso" mas o `vendedor_id` nunca era gravado. Corrigido: `FilaDistribuicao` (`LeadsTab.jsx`) usa `db.saveLead()` direto com o objeto completo quando em modo Supabase (onde o lead não está no array compartilhado), e `updateLead()` do contexto quando em modo local (onde o array `leads` já contém tudo, sem carregamento sob demanda nesse modo).
2. **Fila de distribuição não aparecia em modo local** — `fetchLeadsSemVendedor()` retornava `null` incondicionalmente fora do modo Supabase (função pensada só pra produção). Corrigido: `FilaDistribuicao` lê do array `leads` compartilhado do contexto (`.filter(l => l.origem)`) quando `!isSupabaseMode()`.
3. **Referência a estado já removido** (`atribuindo`/`setAtribuindo`) deixada por engano numa correção anterior à distribuição — quebraria em runtime (`ReferenceError`) ao tentar atribuir um lead. Removida junto com a correção do item 1.
4. **Retenção LGPD (PA-10) incompleta**: `limpar_leads_expirados()` (D-058) tinha 3 blocos (soft-delete expirado, evento encerrado, mês encerrado) — nenhum cobria um lead sem `evento_id` **nem** `mes_referencia` (QR Code, Form Builder). Esses leads ficariam retidos indefinidamente. Novo 4º bloco em `migracao-qrcode-retencao.sql`: expira por `criado_em` (não existe "fim de contexto" pra esses leads, ao contrário de evento/mês).
5. **CORS das Edge Functions públicas bloqueava a própria chamada do frontend**: `Access-Control-Allow-Headers` só liberava `content-type`, mas o frontend (`QrCapturaPublica.jsx`/`FormularioPublico.jsx`) também envia `apikey`/`authorization` (exigidos pela própria plataforma Supabase antes mesmo de chegar na função). O preflight do navegador bloqueava a chamada real, aparecendo como "Failed to fetch" sem detalhe. Corrigido para `authorization, apikey, content-type` (mesmo padrão já usado em `atualizar-email-usuario`).

**Motivação:** Todos os 5 itens foram encontrados durante teste real (local e depois em produção-Supabase) antes de considerar o QR Code/Form Builder prontos — nenhum foi hipotético.

**Arquivos Afetados:** `src/features/leads/LeadsTab.jsx`, `supabase/migracao-qrcode-retencao.sql`, `supabase/functions/captar-lead-qrcode/index.ts`, `supabase/functions/submeter-formulario/index.ts`.

**Riscos:** Nenhum novo — todas as 5 são correções de comportamento já quebrado, não mudanças de comportamento pretendido.

**Status:** Ativa

---

### [D-065] — Navegação do Marketing em 3 diretos + "Mais" agrupado; retirada do gerador de QR Code standalone (unificação com Form Builder)

**Data:** 2026-07-06
**Tipo:** Refatoração / UX

**Decisão / Duas partes:**

1. **Navegação do Marketing reestruturada:** `MarketingApp.jsx` passa de uma lista plana de 9 tabs (desktop) para **3 botões diretos** (Início, Eventos, Relatórios) + **1 botão "Mais"**, com dropdown no desktop (`.nav-more-dropdown`) e bottom sheet no mobile (`.more-sheet`, já existente), agrupado por categoria: **Captação** (Formulários), **Comercial** (Ofertas), **Operação** (Estoque, Check-in), **Sistema** (Equipe, Monitor). `ComercialApp.jsx` **não** ganhou esse padrão — mantém os 4 tabs diretos de sempre, por decisão explícita do responsável pelo sistema (com só 4 itens, agrupar não reduz cliques). `VendedorApp.jsx` não foi tocado.

2. **Retirada do gerador de QR Code standalone** (`QrCodeGeradorTab.jsx`, rota pública `/qr/:id`, página `QrCapturaPublica.jsx`, Edge Function `captar-lead-qrcode`, script `google-forms-apps-script.js`): o Form Builder (D-062) já é um superconjunto funcional — `CAMPOS_FORMULARIO` cobre todos os campos que a página do QR Code coletava (nome, telefone, endereço, cpf, serviço) e cada formulário criado já gera seu próprio QR Code + link (`QrDoFormulario`, dentro de `FormBuilderTab.jsx`). Manter os dois caminhos era a própria redundância que o responsável pelo sistema pediu para resolver. Confirmado que nenhum QR Code desse gerador standalone chegou a ser impresso/distribuído fisicamente — retirada sem plano de migração para QR já em campo.

**Motivação:** O sistema vinha acumulando abas no header do Marketing a cada feature nova (Estoque, Ofertas, QR Codes, Formulários, Relatórios, Equipe, Check-in, Monitor — 9 no total, sem hierarquia), dificultando a leitura visual e a navegação. Ao mesmo tempo, "QR Codes" e "Formulários" resolviam o mesmo problema de negócio (captação pública sem sessão) por dois caminhos de código paralelos.

**Alternativas Avaliadas:**
- **Manter as duas ferramentas de captação, só reorganizar o menu:** rejeitada — não resolve a duplicação de código/manutenção (duas Edge Functions, duas páginas públicas, dois conjuntos de colunas de proveniência para o mesmo conceito).
- **Migrar o modelo de dados do QR Code para dentro de `formularios` (ex: converter QRs existentes em formulários):** descartada por não haver QR em produção para migrar — sem necessidade de ponte de compatibilidade.
- **Dropdown "Mais" sem agrupamento (lista plana, como o antigo bottom sheet mobile):** considerada, mas com 6 itens sem categoria o problema original (leitura difícil) se repetiria dentro do próprio dropdown.
- **Aplicar o mesmo dropdown "Mais" ao Comercial:** rejeitada a pedido do responsável pelo sistema — Comercial só tem 4 tabs, abaixo do ponto onde agrupar compensa a fricção de mais um clique.

**O que foi mantido sem alteração (importante para não confundir sessões futuras):** as colunas `origem`/`qr_code_id`/`qr_code_label` em `leads` (compartilhadas com o pipeline de distribuição, que não distingue origem), `fetchLeadsQrCode`/`carregarLeadsQrCode` em `dataService.js`/`AppProvider.jsx`, o seletor "QR Code" em `VendedorApp.jsx` (contexto só-leitura) e as migrations `migracao-qrcode.sql`/`migracao-qrcode-retencao.sql`. Esse lado do código não foi tocado porque a interface do vendedor foi mantida deliberadamente inalterada — mas fica vestigial para leads *novos*: sem gerador, nenhum lead novo nasce com `origem='qrcode'` a partir desta decisão. Qualquer lead com essa origem que já exista no banco continua visível e funcional normalmente.

**Impactos:**
- `src/features/qrcode/` (diretório inteiro), `src/public/QrCapturaPublica.jsx` e `supabase/functions/captar-lead-qrcode/` removidos do repositório.
- `src/main.jsx` perde o desvio de rota `/qr/:id` — só resta `/f/:slug` antes do `AppProvider`/`Root`.
- `vercel.json` perde a rewrite `/qr/:path*`.
- `FormBuilderTab.jsx` ganha uma frase na descrição da aba deixando explícito que cada formulário já gera QR Code/link.
- Testes E2E (`tests/navegacao.test.js`, `tests/marketing.test.js`, `tests/estoque.test.js`, `tests/security.test.js`) atualizados para abrir "Mais" antes de clicar em Estoque/Equipe/Check-in, e a contagem de tabs diretas do header passa de 7 (já desatualizada antes desta sessão) para 4 (3 diretas + botão "Mais").

**Arquivos Afetados:** `src/apps/MarketingApp.jsx`, `src/index.css` (`.nav-more-*`), `src/main.jsx`, `src/features/formularios/FormBuilderTab.jsx`, `vercel.json`, `tests/navegacao.test.js`, `tests/marketing.test.js`, `tests/estoque.test.js`, `tests/security.test.js`. Removidos: `src/features/qrcode/QrCodeGeradorTab.jsx`, `src/features/qrcode/index.js`, `src/public/QrCapturaPublica.jsx`, `supabase/functions/captar-lead-qrcode/index.ts`, `supabase/functions/captar-lead-qrcode/google-forms-apps-script.js`.

**Riscos:** Nenhum de dados (nenhum QR em produção). Risco de UX: itens dentro de "Mais" exigem 1 clique a mais que antes — aceito, é exatamente a troca que o responsável pelo sistema pediu (menos itens visíveis, hierarquia por categoria).

**Status:** Ativa

---

### [D-066] — Leads da Atividade do Mês agrupados por dia (accordion)

**Data:** 2026-07-07
**Tipo:** UX

**Decisão:** `MesDetail.jsx` deixa de renderizar uma única tabela plana com todos os leads do mês e passa a agrupá-los por dia real de captação (`criadoEm`), num accordion — um cartão colapsável por dia (`"Hoje"`, `"Ontem"` ou `"DD/MM — dia da semana"`), com a contagem de leads no cabeçalho. Por padrão só o dia mais recente (`grupos[0]`, tipicamente "Hoje") vem aberto; os demais ficam colapsados até o usuário clicar. A busca por nome ignora o estado de aberto/fechado e expande automaticamente qualquer dia que tenha lead correspondente, ocultando os que não têm.

Os grupos são derivados inteiramente dos leads já carregados (`diaKey(l.criadoEm)`), sem gerar dias vazios: um dia sem lead nenhum simplesmente não aparece no accordion (nem os que ainda vão ocorrer, nem os que já passaram sem captação). Um dia novo aparece sozinho, automaticamente, assim que o primeiro lead daquele dia é gravado — sem qualquer job, cron ou manutenção manual.

**Motivação:** Com a captação por "Atividade do Mês" (D-058) rodando dia após dia, a lista de leads do mês crescia como uma tabela única e cada vez mais longa, misturando "hoje" com dias anteriores já revisados ("leads de ontem ficam em fila junto com os de hoje"). Separar por dia deixa o dia corrente em evidência e reduz o scroll para revisar/exportar um dia específico.

**Alternativas Avaliadas:**
- **Gerar um grupo vazio para cada dia do mês (1 a 31), incluindo dias futuros:** rejeitada explicitamente pelo responsável pelo sistema — dias sem lead (passados ou futuros) não devem aparecer; o grupo só nasce quando o primeiro lead do dia é capturado.
- **Coluna de banco dedicada para "dia" (`dia_referencia`) espelhando `mes_referencia`:** descartada — `criadoEm` já contém a granularidade de dia, uma coluna nova seria redundante e exigiria migração sem ganho.

**Arquivos Afetados:** `src/features/leads/MesDetail.jsx` (único arquivo alterado — mudança 100% frontend, sem migração de banco, sem alteração de RLS).

**Riscos:** Nenhum de dados. Risco de UX mitigado: dia mais recente aberto por padrão evita esconder os leads mais relevantes atrás de um clique extra.

**Status:** Ativa

---

### [D-067] — Moderação e mitigação de abuso no formulário público (link, IP, rate limit, exclusão, processo)

**Data:** 2026-07-07
**Tipo:** Segurança / LGPD

**Contexto:** O único ponto do sistema onde qualquer pessoa sem autenticação grava dado direto no banco é a captação pública do Form Builder (`FormularioPublico.jsx` → Edge Function `submeter-formulario`, D-062). Avaliada e descartada a ideia de terceirizar a captação para o Google Forms como forma de transferir responsabilidade legal por conteúdo impróprio submetido por terceiros (ver discussão de sessão) — o operador do formulário continua sendo quem tem acesso às respostas e o dever de agir, independentemente de quem hospeda a infraestrutura; e o Form Builder atual não tem upload de arquivo (o único ponto onde a varredura automática do Google teria efeito real). Decisão: reforçar o formulário próprio em vez de trocar de plataforma.

**Decisão / Cinco partes:**

1. **Bloqueio de link em texto livre:** `containsLink()` (nova, `src/lib/security.js`) rejeita valores contendo URL nos campos `nome`/`endereco`/`bairro` e nos campos personalizados — tanto no client (`FormularioPublico.jsx`, feedback imediato) quanto, de forma decisiva, na Edge Function (`submeter-formulario/index.ts`, duplicando a mesma regex em Deno — mesmo padrão dos outros validadores desse conector).
2. **IP de origem:** nova coluna `leads.origem_ip` (`migracao-moderacao-formulario.sql`), preenchida só pela Edge Function via `x-forwarded-for`, nunca pelo app autenticado. Fecha o gap "IP do aceite de consentimento: AUSENTE" documentado em `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` §3.3. Sem retenção própria — apagado junto do lead pela retenção já existente (`migracao-qrcode-retencao.sql`, por `criado_em`).
3. **Rate limit por IP:** a própria Edge Function conta, antes de cada insert, quantos leads aquele `origem_ip` já gerou nos últimos 10 minutos (`leads` mesmo, sem tabela nova); acima de 5, rejeita com 429. Depende da coluna do item 2.
4. **Exclusão na fila de distribuição:** `FilaDistribuicao` (`LeadsTab.jsx`) ganha um botão "Excluir" por linha, confirmação em dois passos (mesmo padrão de `EstoqueTab.jsx`), usando `db.removeLead` (Supabase) ou `removeLead` do contexto (modo local) — permite descartar um lead suspeito sem precisar atribuí-lo antes.
5. **Processo documentado:** novo `doc/SEGURANCA_MODERACAO.md` — passos de remoção/denúncia (SaferNet Brasil, Disque 100) para conteúdo ilegal, e o porquê da responsabilidade não ser transferível pra terceiro que hospeda a ferramenta.

**Motivação:** Formulário público sem sessão é vetor de abuso (spam, dado ofensivo, link malicioso). As proteções existentes (honeypot, sanitização de tag HTML, CORS restrito) não cobriam link em texto livre, não davam rastreabilidade por IP, não tinham rate limit, e não davam ao marketing uma forma de descartar um lead ruim sem primeiro atribuí-lo a um vendedor.

**Alternativas Avaliadas:**
- **Migrar a captação para Google Forms** (motivador original da discussão desta sessão) — descartada: não transfere responsabilidade legal (quem opera o formulário, não quem hospeda, responde por conteúdo submetido — Marco Civil da Internet art. 21, ECA); a proteção real do Google (varredura de upload) não se aplica porque o Form Builder não tem campo de arquivo; e a migração reintroduziria exatamente a duplicação de caminho de captação que D-065 acabou de eliminar.
- **Tabela dedicada para rate limit** (em vez de contar em `leads`) — descartada por ora: adiciona uma tabela e um índice a mais para o mesmo resultado; reavaliar se o volume de submissões justificar.
- **Bloqueio de conteúdo ofensivo em geral (não só link)** — fora de escopo: exigiria lista de bloqueio/moderação de linguagem natural, desproporcional para um formulário de captação comercial; a fila de distribuição (item 4) já dá um ponto de revisão humana antes do lead virar ativo.

**Impactos:** `src/lib/security.js`, `src/public/FormularioPublico.jsx`, `supabase/functions/submeter-formulario/index.ts`, `supabase/migracao-moderacao-formulario.sql` (novo), `src/lib/dataService.js` (`LEADS_COLS`, `leadFromDb`/`leadToDb`), `src/features/leads/LeadsTab.jsx`, `doc/SEGURANCA_MODERACAO.md` (novo).

**Riscos:** Rate limit por IP pode falsear positivo para várias pessoas atrás do mesmo IP (CGNAT, Wi-Fi compartilhado) enviando o formulário quase ao mesmo tempo — mitigado pelo limite generoso (5/10min). Regex de link é heurística (`http`, `www.`, TLDs comuns) — pode deixar passar ofuscação deliberada (ex: espaços no meio da URL); aceito como primeira camada, não solução completa.

**Status:** Ativa

---

### [D-068] — Correção pós-D-066: horário do lead na tabela por dia + bug de sombra preta (box-shadow + overflow:hidden)

**Data:** 2026-07-07
**Tipo:** Bugfix / UX

**Decisão / Duas partes:**

1. **Coluna "Horário" na tabela de leads de `MesDetail.jsx`:** cada linha ganha o horário de captação (`HH:MM`, extraído de `criadoEm`) como primeira coluna, e os leads dentro de cada grupo de dia passam a ser ordenados do mais recente para o mais antigo (antes seguiam a ordem de chegada do array `mesLeads`, sem ordenação explícita). Pedido do responsável pelo sistema para "acompanhamento milimétrico" da captação ao vivo.
2. **Correção de artefato visual "sombra preta sólida"** relatado em produção (mobile): o cartão de cada dia (`className="card"`, que carrega `box-shadow: var(--shadow-card)` via CSS) tinha `overflow: "hidden"` aplicado inline no **mesmo elemento** (introduzido em D-066). Combinar `box-shadow` e `overflow: hidden` no mesmo elemento é uma combinação problemática em navegadores mobile Chromium/Samsung Internet — o compositor de GPU falha ao recortar a própria sombra do elemento junto do conteúdo, e em vez da sombra suave pinta um retângulo preto sólido, sobretudo durante o scroll. Corrigido isolando o `overflow: hidden` num `<div>` wrapper interno (sem `box-shadow`), mantendo o `box-shadow` só no `.card` externo (sem `overflow: hidden`). Confirmado por grep que essa era a única ocorrência no repositório inteiro combinando as duas propriedades no mesmo elemento — explica por que o artefato aparecia repetido "em vários lugares": cada cartão de dia do próprio accordion reproduzia o mesmo bug.

**Motivação:** Ambos os itens surgiram de feedback do responsável pelo sistema testando D-066 em produção — o segundo por captura de tela mostrando o artefato visual.

**Arquivos Afetados:** `src/features/leads/MesDetail.jsx` (único arquivo alterado — mudança 100% frontend, sem migração de banco).

**Riscos:** Nenhum. Regra geral para sessões futuras: nunca combinar `box-shadow` e `overflow: hidden` no mesmo elemento — usar um wrapper interno para o `overflow: hidden` quando ambos forem necessários.

**Status:** Ativa

---

### [D-069] — Sombras globais do tema escuro suavizadas (`--shadow-card`/`--shadow-float`/`--shadow-glow`)

**Data:** 2026-07-07
**Tipo:** Bugfix / Design System

**Contexto:** Após corrigir o artefato pontual de D-068, o responsável pelo sistema reportou que a "sombra preta" continuava aparecendo — dessa vez em praticamente todos os componentes com elevação (`.card`, `.kpi`, `.event-card`, `.vendor-card`, dropdown, modal), tanto mobile quanto web. Investigação em `src/index.css` mostrou que não era mais um bug de renderização isolado: era o próprio valor das variáveis de sombra do tema escuro. `--bg: #090909` e `--surface: #111111` são quase pretos (decisão de design da V3, `doc/ui/UI_VERSIONS.md`: "fundos mais escuros — mais profundidade"), mas `--shadow-card`/`--shadow-float`/`--shadow-glow` usavam preto com alpha alto (até `.5`/`.7`). Sombra preta sobre fundo quase preto não degrada suavemente como aconteceria sobre uma superfície clara — o resultado visual é uma mancha escura sólida, mais evidente onde cards ficam próximos ou empilhados (ex: o accordion por dia de D-066/D-068). O tema claro (`.light .card`, linha ~522) já usava um valor proporcional (`rgba(0,0,0,.08)`) — só o tema escuro estava desproporcional.

**Decisão:** Reduzido o alpha das 3 variáveis de sombra em `:root` (`src/index.css`), mantendo a mesma estrutura (offset/blur) da V3 — a intenção de elevação por `box-shadow` real (em vez de borda `0 0 0 1px`) é mantida, só a intensidade muda:
- `--shadow-card`: `rgba(0,0,0,.5)`/`.3` → `.25`/`.15`
- `--shadow-float`: `.7`/`.4` → `.35`/`.2`
- `--shadow-glow`: `.4` → `.2`

Validado visualmente rodando o app em modo local (`npm run dev` + captura de tela) antes e depois da mudança — a sombra deixa de aparecer como bloco preto sólido nos cards do Dashboard.

**Alternativas Avaliadas:**
- **Remover `box-shadow` por completo, voltando ao padrão V2 (`box-shadow: 0 0 0 1px var(--border)`)** — rejeitada: reverteria uma decisão de design deliberada da V3 (elevação real substituindo borda simples); suavizar o alpha resolve o problema visual sem descartar a direção de design já em produção. Se o responsável pelo sistema preferir remover de vez após ver o resultado suavizado, é um ajuste de uma linha.
- **Ajustar só `--shadow-card` (mais usado) e deixar `--shadow-float`/`--shadow-glow` como estavam** — descartada: o mesmo desproporção bg-quase-preto vs. sombra-preta-alta se aplica às três, e são usadas em conjunto (ex: `.kpi:hover` troca `--shadow-card` por `--shadow-float`).

**Arquivos Afetados:** `src/index.css` (3 variáveis em `:root`, linhas ~23–25) — mudança global de CSS, sem tocar em nenhum componente individualmente; efeito automático em todo elemento que já usa essas variáveis.

**Riscos:** Nenhum funcional. Risco de UX: cards podem parecer com "menos profundidade" que antes para quem já estava acostumado ao visual anterior — aceito, já que o visual anterior era o próprio problema relatado.

**Status:** Ativa

---

### [D-070] — Removido o "TableScrollHint" (`.tbl-wrap::after`): era a real causa da sombra preta em tabelas roláveis

**Data:** 2026-07-07
**Tipo:** Bugfix

**Contexto:** Mesmo após D-069, o responsável pelo sistema reportou (com duas capturas de tela — `LeadsTab.jsx` "Exportar Leads" e `MesDetail.jsx`) que a sombra preta persistia, especificamente "em todos os locais que é possível movimentar/arrastar para o lado" — ou seja, tabelas com scroll horizontal no mobile. Isso apontava pra uma causa diferente de D-068/D-069: `.tbl-wrap::after` (regra de mobile em `src/index.css`, dentro do bloco de media query) desenhava um gradiente `linear-gradient(to right, transparent, var(--bg))` de 32px de largura, fixo na borda direita do container `.tbl-wrap` (`position: absolute; right: 0`), como um indicador visual de "tem mais conteúdo, arraste". Dois problemas: (1) por ser fixo na borda do **container visível**, não do conteúdo, ele cobria texto real de células sempre que a última coluna visível chegava perto da borda direita — nas capturas, cortava o início de "RJNET Móvel"/"Internet Residencial" na coluna Serviço e sobrepunha a data na coluna Início; (2) como `var(--bg)` é quase preto (`#090909`), o gradiente não lia como um "fade" sutil, e sim como uma sombra sólida colada no texto — presente permanentemente (não é removido depois de rolar até o fim, é CSS estático, sem lógica de scroll). Confirmado por grep que `.tbl-wrap` é usado em `LeadsTab.jsx`, `MesDetail.jsx` e `EventDetail.jsx` — batendo exatamente com os locais reportados.

**Decisão:** Removida a regra `.tbl-wrap::after` (e o `position: relative` que só existia para sustentá-la) do bloco de media query mobile em `src/index.css`. O scroll horizontal das tabelas continua funcionando normalmente por gesto de toque (`overflow-x: auto` em `.tbl-wrap` já existia antes e não foi tocado) — só o indicador visual de fade foi retirado, já que ele causava mais problema (obscurecer conteúdo real) do que benefício (affordance de scroll, que em touch devices já é razoavelmente descoberto por gesto).

**Motivação:** Terceira rodada de feedback do responsável pelo sistema sobre a mesma queixa visual ("sombra preta") — as duas correções anteriores (D-068, D-069) eram bugs reais, mas não a causa raiz deste padrão específico; esta é a causa raiz confirmada visualmente (captura de tela antes/depois, rodando localmente com `npm run dev`).

**Alternativas Avaliadas:**
- **Tornar o gradiente dinâmico via JS (esconder quando `scrollLeft + clientWidth >= scrollWidth`)** — descartada: adiciona listener de scroll a cada tabela do app pra recuperar um affordance de baixo valor (usuários já reconhecem tabelas com `overflow-x` roláveis pelo hábito de touch); a causa raiz do incômodo (cobrir texto real) continuaria existindo enquanto não estivesse totalmente rolado.
- **Reduzir a largura/opacidade do gradiente em vez de remover** — descartada: mesmo mais sutil, ainda cobriria texto real na borda; dado que já é a terceira reclamação da mesma natureza, preferiu-se eliminar de vez.

**Arquivos Afetados:** `src/index.css` (remoção de 3 linhas dentro do bloco `@media` mobile — `.tbl-wrap { position: relative }` e `.tbl-wrap::after { ... }`).

**Riscos:** Nenhum funcional — comportamento de scroll das tabelas não muda, só o indicador visual de fade desaparece. Se o responsável pelo sistema quiser recuperar algum tipo de affordance no futuro, reavaliar com uma abordagem que não sobreponha conteúdo real (ex: seta/ícone fora da área de texto).

**Status:** Ativa

---

### [D-071] — Fecha drift do PA-11 (RLS de leads) e adianta 3 quick wins de performance (TB-009/010/011)

**Data:** 2026-07-07
**Tipo:** Segurança / Performance

**Contexto:** Durante uma sessão de avaliação de "prontidão para venda" do sistema, uma auditoria cruzada entre `doc/lgpd/PENDENCIAS_POS_AUDITORIA.md` e o SQL real de produção revelou um caso de *drift* entre trabalho de conformidade e trabalho de feature: `supabase/migracao-rls-vendedor-leads.sql` (PA-11, escrita em 2026-06-16, restringia `leads_select` a `vendedor_id = auth.uid()`) nunca foi aplicada em produção. Nesse intervalo, `migracao-comercial.sql` (D-059) e `migracao-qrcode.sql` (D-061) — trabalho de feature não relacionado — reescreveram a mesma policy do zero, sem essa restrição; a versão que ficou vigente usava `vendedor_id is not null`, que permite a qualquer vendedor ler nome/CPF/telefone/endereço de leads de colegas. Separadamente, revisitando `doc/performance/TECHNICAL_BACKLOG.md`, três itens (TB-009, TB-010, TB-011) estavam sinalizados para depois do teste de carga (ainda não executado), mas são mudanças de baixo risco sem dependência de dado real de produção — não havia motivo pra esperar.

**Decisão:**
1. `supabase/migracao-rls-vendedor-leads-v2.sql`: reaplica `vendedor_id = auth.uid()` em `leads_select` por cima da versão vigente, preservando a leitura total de marketing/comercial adicionada por D-059. Aplicada e confirmada em produção em 2026-07-07 (verificação via `pg_policies` retornou a condição esperada).
2. TB-009: `getMateriaisDisponiveis()` memoizado via `useMemo([materiais, eventos])` em `AppProvider.jsx` — antes recalculava o `flatMap` de eventos/materiais a cada chamada (EstoqueTab/Dashboard/EventDetail chamam em todo render).
3. TB-011: `useRanking.js` trocou `setInterval` fixo de 60s por `setTimeout` recursivo com backoff — espaça para 120s (`RANKING_POLL_INATIVO_MS`) quando não há lead novo há mais de 2min (`RANKING_POLL_INATIVO_APOS_MS`), volta ao ritmo normal assim que a atividade retorna.
4. TB-010 (QW-006): confirmado que já estava implementado em `LeadsTab.jsx` (`carregando`/`carregandoMes` já desabilitavam os botões de export durante o fetch) — sem mudança de código, só correção do backlog, que estava desatualizado.

**Motivação:** O drift do PA-11 só foi descoberto porque a auditoria cruzou dois documentos que normalmente são lidos separadamente (plano de LGPD vs. SQL de feature) — é o tipo de gap que só aparece quando alguém lê os dois lados juntos, especialmente relevante num projeto mantido por uma única pessoa, sem segundo revisor. Os TBs foram adiantados porque a "ordem de execução recomendada" original (esperar o teste de carga) fazia sentido para mudanças estruturais de maior risco (TB-005, TB-008, TB-012), mas não para memoização/backoff de baixo risco.

**Alternativas Avaliadas:**
- **Aplicar só a v1 do PA-11** — descartada: a versão vigente da policy já não era mais a de `migracao-auth.sql`/`protecao-dados.sql` que a v1 assumia como ponto de partida; aplicar a v1 isoladamente, seguindo a ordem numérica original da tabela de migrações, seria imediatamente desfeita pelas migrações de comercial/qrcode que vêm depois na mesma ordem.
- **Esperar o teste de carga pra aplicar TB-009/010/011** — descartada: nenhum dos três depende de dado de carga real pra ser seguro; adiar não reduzia risco, só atrasava um ganho sem custo.

**Impactos:**
- Não conformidade SB-04 (LGPD, minimização de acesso) encerrada em produção.
- Redução de recomputação em `getMateriaisDisponiveis()` e de RPCs de ranking em períodos de baixa atividade — sem mudança de comportamento visível para o usuário.
- Três documentos de LGPD (`SUPABASE.md`, `PLANO_DE_ACAO_LGPD.md`, `PENDENCIAS_POS_AUDITORIA.md`) e dois de performance (`TECHNICAL_BACKLOG.md`, `QUICK_WINS.md`) atualizados para refletir o estado real, fechando a divergência que motivou a auditoria.

**Arquivos Afetados:** `supabase/migracao-rls-vendedor-leads-v2.sql` (novo), `src/context/AppProvider.jsx`, `src/hooks/useRanking.js`, `src/lib/constants.js`, `doc/lgpd/PLANO_DE_ACAO_LGPD.md`, `doc/lgpd/PENDENCIAS_POS_AUDITORIA.md`, `doc/architecture/SUPABASE.md`, `doc/performance/TECHNICAL_BACKLOG.md`, `doc/performance/QUICK_WINS.md`.

**Riscos:** Nenhum funcional identificado. RLS: `VendedorApp.jsx` já filtrava leads recebidos por `vendedorNome` antes de exibir, e o ranking usa RPC `security definer` (ignora RLS) — nenhuma tela depende de leitura ampla. Performance: build (`npm run build`) e os 55 testes unitários passaram sem falha após as três mudanças.

**Status:** Ativa

---

### [D-072] — Simulador de Perfil de Consumo: captação gamificada via link (tráfego pago) + QR Code, com scoring de intenção no servidor

**Data:** 2026-07-08
**Tipo:** Feature / Arquitetura de Captação

**Contexto:** O responsável pelo sistema pediu uma terceira porta de entrada pública de captação (ao lado do Form Builder): um quiz gamificado de perfil de consumo de internet, acessado por link (campanhas de tráfego pago — Meta/Google Ads, inclusive geolocalizadas) e por QR Code em material impresso. A pessoa responde 4–6 perguntas, recebe uma recomendação personalizada ("valor antes do dado") e só então deixa contato — o lead nasce qualificado: perfil declarado, pontuação de intenção, temperatura calculada e oferta recomendada. Plano completo em `doc/simulador/SIMULADOR_IMPLEMENTATION_PLAN.md` (fases F0–F4 implementadas; F5 territorial planejada — mesma entrada, questionário reduzido).

**Decisão:**
- **Mesmo pipeline público do Form Builder, nunca um paralelo:** página sem sessão (`/s/:slug`, `SimuladorPublico.jsx`) → Edge Function `submeter-simulador` (service_role) → insert em `leads` com `vendedor_id` nulo → fila "Leads sem vendedor" → distribuição manual. `origem='simulador'` é só mais um valor no eixo de proveniência (D-061).
- **Catálogo de perguntas FIXO e versionado em código** (`src/lib/simulador.js` — `PERGUNTAS_SIMULADOR`, mesmo princípio do `CAMPOS_FORMULARIO`/D-062): a tabela `simuladores` guarda só a identidade da campanha (nome/slug/agrupador). Nunca um motor de quiz genérico em runtime.
- **Scoring no servidor:** a Edge Function RECALCULA pontuação/temperatura/oferta a partir das respostas brutas (espelho Deno de `calcularPerfil`) — o cliente nunca envia score pronto. Score exibido na página é só UX. Respostas gravadas em `leads.perfil_consumo` (jsonb, `{versao, respostas}`) — na linha do lead de propósito: a retenção LGPD D-064 expurga tudo junto.
- **Temperatura como ponte com o fluxo existente:** o score mapeia para o enum `temperatura` (≥60 quente, 30–59 morno, <30 frio) que vendedor/relatórios já entendem — nenhuma tela precisou aprender um conceito novo pra priorizar.
- **Um link por campanha, dois canais via UTM:** a página captura `utm_*` da URL (whitelist de 5 chaves, sanitizadas no servidor) e grava em `leads.utm`; o QR gerado pela `SimuladorTab` embute `utm_source=qrcode&utm_medium=impresso` — a MESMA campanha distingue scan físico de clique em anúncio, e cada anúncio/conjunto é atribuível pelos próprios UTMs.
- **`_shared/captacao.ts`:** CORS/sanitização/validadores/rate-limit extraídos de `submeter-formulario` para módulo compartilhado entre as Edge Functions públicas (elimina a duplicação admitida em D-067). `submeter-formulario` refatorada para importar de lá — comportamento idêntico, requer redeploy.
- **Contexto "QR Code" do vendedor generalizado para "Captação":** `fetchLeadsQrCode` passa a filtrar `origem in ('qrcode','formulario','simulador')` — corrige de quebra a lacuna em que leads de formulário distribuídos não apareciam no seletor do vendedor. Card do lead exibe o perfil (`resumoPerfil`, labels sempre derivados do catálogo).
- **Fila de distribuição ordenada por pontuação** (desc, sem score por último) com coluna "Perfil" (pts + temperatura + resumo) e origem detalhada (campanha + utm_campaign) — o marketing distribui os quentes primeiro.

**Alternativas Avaliadas:**
- **Estender `formularios` com `tipo='simulador'`** — rejeitada: a forma da config é diferente (identidade de campanha vs. lista de campos); tabela irmã `simuladores` mantém cada domínio com escopo próprio (sem "god table").
- **Perguntas configuráveis no banco (motor de quiz)** — rejeitada pelo mesmo racional do D-062: custo de validação arbitrária no servidor + UI genérica sem necessidade atual. Mudar pergunta = commit + bump de `PERGUNTAS_SIMULADOR_VERSAO`.
- **Exibir a oferta real (imagem+copy da tabela `ofertas`) na tela de resultado** — adiada: exigiria abrir leitura `anon` em `ofertas` (a copy é redigida pro contexto WhatsApp do vendedor, não pra página pública). v1 usa headlines por nível de demanda em código (`RECOMENDACAO_POR_NIVEL`); reavaliar com policy `anon` explícita se o marketing quiser a arte real na página.
- **Pixel de conversão (Meta/GA) na página** — rejeitada na v1: exigiria afrouxar CSP + banner de cookies + entrada LGPD. Atribuição por UTM + leads/cliques da plataforma cobre a leitura de performance.

**Arquivos Afetados:** `supabase/migracao-simulador.sql` (novo), `supabase/functions/_shared/captacao.ts` (novo), `supabase/functions/submeter-simulador/index.ts` (novo), `supabase/functions/submeter-formulario/index.ts` (refatorada), `src/lib/simulador.js` (novo), `src/lib/dataService.js`, `src/public/SimuladorPublico.jsx` (novo), `src/api/simuladorApi.js` (novo), `src/context/AppProvider.jsx`, `src/features/simulador/SimuladorTab.jsx` (novo), `src/apps/MarketingApp.jsx`, `src/apps/VendedorApp.jsx`, `src/features/leads/LeadsTab.jsx`, `src/main.jsx`, `vercel.json`, `src/index.css`, `tests/simulador.unit.test.js` (novo, 40 asserts), `tests/simulador.test.js` (novo, 6 E2E).

**Riscos:** (1) **Ordem de deploy**: `migracao-simulador.sql` + `NOTIFY pgrst` DEVEM rodar antes do merge do frontend — `LEADS_COLS`/`leadToDb` referenciam as colunas novas e quebrariam leitura/escrita de leads sem elas (mesmo requisito de D-062/D-063). (2) Redeploy de `submeter-formulario` (refatoração `_shared/`): comportamento idêntico, mas exige smoke test do formulário público após o deploy. (3) LGPD: novo tratamento (perfil comportamental + UTM) — RIPD/ROPA precisam de linha nova e a Política deve citar a finalidade antes do primeiro go-live de campanha (`versao_termo: 'simulador-v1'` já gravada); retenção já coberta pelo bloco D-064 (lead sem evento/mês expira por `criado_em`). (4) `submeter-simulador` vira a segunda escrita não autenticada do sistema — herda todas as camadas do D-067 (honeypot, containsLink, rate limit 5/10min por IP, origem_ip) via `_shared/`.

**Status:** Ativa

---

### [D-073] — Campanha territorial do Simulador + relatório interno de demanda por região

**Data:** 2026-07-08
**Tipo:** Feature (fase F5 do plano do Simulador)

**Contexto:** Segunda estratégia prevista desde a concepção do Simulador (D-072): anúncios geolocalizados para cidades/bairros onde há rede sem assinantes (ou assinantes em potencial), captando demanda reprimida. A pessoa informa só cidade, bairro e interesse — sem quiz — e a diretoria enxerga um mapa interno de demanda ("Itaguaí: Bairro A → 80 interessados"). Requisito explícito: nunca expor mapa de cobertura ou informação interna de rede.

**Decisão:**
- **Mesma entrada, questionário reduzido:** `tipo='territorial'` na tabela `simuladores` (coluna já prevista na migração D-072). `SimuladorPublico.jsx` troca o fluxo pela fase `territorial` (cidade* + bairro* + interesse* em uma tela → contato sem repetir localização); `SimuladorTab.jsx` ganha seletor de tipo na criação. Zero migração nova de colunas.
- **Sem scoring:** lead territorial nasce `temperatura='morno'` fixa (interesse declarado espontaneamente), `pontuacao`/`perfil_consumo`/`oferta_recomendada` nulos. A Edge Function `submeter-simulador` ramifica pelo `tipo` gravado no banco (nunca pelo payload do cliente): territorial exige cidade+bairro e valida `servicoInteresse` contra o enum; perfil_consumo exige quiz e recalcula score.
- **Relatório de demanda = RPC agregada, não feature de captação:** `demanda_por_regiao()` (`migracao-demanda.sql`, security definer + grant `authenticated`, mesmo padrão de `ranking_mes`) retorna só `cidade/bairro/count(*)` de leads de captação digital não deletados — nenhum dado pessoal sai da função. Renderizada como seção "Demanda por região" em Relatórios (`LeadsTab.jsx`, tela que só marketing/comercial enxergam); modo local agrega do próprio array `leads`. Nada de mapa visual/tile server externo (CSP intacta).

**Alternativas Avaliadas:**
- **Tabela agregada anônima persistente** (sobrevive ao expurgo LGPD) — adiada, continua como sugestão S3 do plano: só quando a diretoria pedir série histórica além da janela de retenção.
- **Exigir contato antes de cidade/bairro** — rejeitada: inverteria o princípio "valor/leveza antes do dado" e derrubaria conversão de anúncio frio; localização+interesse primeiro, contato por último.

**Arquivos Afetados:** `supabase/migracao-demanda.sql` (novo), `supabase/functions/submeter-simulador/index.ts`, `src/public/SimuladorPublico.jsx`, `src/features/simulador/SimuladorTab.jsx`, `src/lib/dataService.js` (`demandaPorRegiao`), `src/features/leads/LeadsTab.jsx` (`DemandaPorRegiao`), `tests/simulador.test.js` (7º cenário E2E).

**Riscos:** `migracao-demanda.sql` deve rodar APÓS `migracao-simulador.sql` (depende das colunas `cidade`/`origem`). Retenção LGPD D-064 expurga leads territoriais como qualquer lead sem contexto — o agregado histórico encolhe junto (limitação conhecida e aceita; ver S3). Sem impacto em telas existentes: a seção de demanda só renderiza quando há dado.

**Status:** Ativa

---

### [D-074] — Pacote de internet fixo por perfil de uso + combo de upsell (apps/upgrade) na tela de resultado do Simulador

**Data:** 2026-07-08
**Tipo:** Feature (evolução do Simulador, tipo `perfil_consumo`)

**Contexto:** O responsável pelo sistema pediu duas mudanças na tela de resultado do quiz `perfil_consumo`: (1) a recomendação de pacote deixa de ser calculada por soma de sinais (`nivel` derivado de `usos`/`moradores`) e passa a vir de uma **pergunta explícita de perfil** — a pessoa escolhe entre categorias (ex: "Gamer") que já têm um pacote fixo associado e uma descrição curta ("usa muita internet e navega bastante"); (2) abaixo do pacote recomendado, um combo de checkboxes de upsell usando os preços reais já existentes no sistema (aba Pacotes do vendedor): +R$ 15 Apps Yellow, +R$ 30 Apps Black, +R$ 20 (variável) upgrade pro próximo pacote — com total atualizado ao vivo.

**Decisão:**
- **Novo catálogo `PERFIS_SIMULADOR`** (`src/lib/simulador.js`): 4 categorias (Básico→120 Mega, Streaming→240, Home Office→240, Gamer/Casa Conectada→420⭐), cada uma com `label`+`descricao`+`pacoteMega` fixo — vira a **primeira pergunta** do wizard (`fase='perfil'`), antes das perguntas existentes. Mesmo princípio de catálogo fixo em código do resto do Simulador (D-072): editar textos/pacote de um perfil é uma mudança nesse array só. O responsável pelo sistema sinalizou que vai querer ajustar esses textos com frequência ("conforme demanda") — por ora fica em código (deploy rápido, poucas linhas); se a cadência de edição justificar, uma evolução futura natural é um catálogo editável pela UI (mesmo padrão de `ofertas`), tratada como decisão própria quando for pedida.
- **Separação de papéis mantida**: as perguntas antigas (moradores/usos/equipamentos/tem_internet/dificuldade) continuam existindo e alimentando **só** `pontuacao`/`temperatura` (prioridade da fila) — nunca mais decidem o pacote. O campo `nivel`/`RECOMENDACAO_POR_NIVEL` (redundante com o novo perfil fixo) foi removido de `calcularPerfil`.
- **Catálogo único de preços** (`PACOTES_INTERNET`, `APPS_ADICIONAIS` em `src/lib/simulador.js`): extraídos da tabela hardcoded que já existia na aba "Pacotes" do vendedor (`VendedorApp.jsx`) — essa aba passou a renderizar via `.map()` sobre o mesmo array, eliminando a duplicação de preço entre as duas telas (editar um preço agora é uma mudança só).
- **Combo calculado sempre a partir do catálogo, nunca de um total pronto**: `montarCombo(perfilKey, {yellow, black, upgrade})` — mesmo princípio de `calcularPerfil`. Cliente usa pra UX (total ao vivo); a Edge Function `submeter-simulador` recebe só `perfil` (chave) + os 3 booleans e recalcula o combo (catálogo espelhado em Deno), gravando a versão dela em `leads.perfil_consumo.combo`.
- **Upsell contextual sem dark pattern**: quando `usos` inclui `streaming`, o checkbox do Apps Black ganha destaque visual (borda + selo "combina com seu perfil") — nunca vem pré-marcado, só evidenciado.
- **Dado gravado no lead**: `perfil_consumo.perfil` (chave da categoria) e `perfil_consumo.combo` (`{pacoteMega, pacotePreco, yellow, black, upgrade, pacoteFinalMega, valorTotal}`) — cabe no jsonb já existente (D-072), sem migração nova. `resumoPerfil()` estendido pra imprimir perfil/pacote/add-ons/total nas telas que já leem esse resumo (fila de distribuição, card do vendedor) — sem mudar essas telas.

**Alternativas Avaliadas:**
- **Manter a recomendação por soma de sinais e só adicionar os checkboxes por cima** — rejeitada: o pedido explícito foi trocar o *mecanismo* de recomendação (pergunta direta, não inferência), então manter os dois em paralelo criaria uma segunda fonte de verdade pro pacote.
- **Combo configurável no banco (tabela de add-ons)** — rejeitada por ora, mesmo racional do catálogo de perfis: sem demanda de edição frequente hoje, adicionar tabela+RLS+UI é custo maior que o benefício atual.

**Arquivos Afetados:** `src/lib/simulador.js` (catálogos `PACOTES_INTERNET`/`APPS_ADICIONAIS`/`PERFIS_SIMULADOR` + `montarCombo`/`pacotePorMega`/`pacoteUpgrade`/`fmtMoeda`; remoção de `nivel`/`RECOMENDACAO_POR_NIVEL`), `supabase/functions/submeter-simulador/index.ts` (espelho do combo + validação de `perfil`), `src/public/SimuladorPublico.jsx` (fase `perfil`, tela de resultado reescrita com o combo), `src/apps/VendedorApp.jsx` (aba Pacotes passa a consumir o catálogo compartilhado), `src/index.css` (`.sim-opcao-perfil`, `.sim-combo*`), `tests/simulador.unit.test.js` (+19 asserts), `tests/simulador.test.js` (2 cenários novos + ajuste dos existentes pra incluir a etapa de perfil).

**Riscos:** Nenhuma migração de banco (campo `perfil_consumo` já é jsonb livre). Leads do Simulador criados **antes** desta mudança não têm `perfil`/`combo` no `perfil_consumo` — `resumoPerfil()` já trata isso graciosamente (`perfilPorKey(undefined)` retorna `null`, linhas de perfil/combo simplesmente não aparecem). Redeploy da Edge Function `submeter-simulador` necessário antes do go-live desta versão da página pública (payload novo: `perfil`+`combo` no lugar do `nivel` implícito).

**Status:** Ativa

---

### [D-075] — Perguntas de intenção do Simulador viram um questionário PRÓPRIO por campanha, com peso editável por opção; popup mostra os apps de cada bundle de upsell

**Data:** 2026-07-09
**Tipo:** Feature / Mudança de arquitetura (evolução do Simulador, tipo `perfil_consumo`)

**Contexto:** Depois de colocar o Simulador em produção, o responsável pelo sistema pediu duas mudanças: (1) poder ver e editar as perguntas de intenção do quiz, com controle sobre "nível"/peso de cada resposta pra pontuação; (2) no combo de upsell (D-074), mostrar quais apps entram em cada bundle (Yellow/Black), já que hoje só aparecia o nome do bundle sem contexto. Na conversa, ficou definido que cada CAMPANHA passaria a ter seu PRÓPRIO questionário (não um catálogo global editado uma vez) — descrito pelo responsável como "quase uma evolução do formulário, só que vamos usar a ferramenta pra moldar o tipo de pesquisa que estaremos fazendo".

**Decisão:**
- **Escopo do que ficou editável:** só as perguntas de INTENÇÃO (as que valem ponto pra fila). A pergunta de "perfil de uso" (D-074, Básico/Streaming/Home Office/Gamer → pacote fixo) continua separada e fora deste mecanismo — decisão explícita do responsável ("deixa separada, pois se precisar mudar algo eu mudo nela mesmo"), evitando que edição de peso acabe recomendando pacote/preço errado sem querer.
- **Nova coluna `simuladores.perguntas`** (jsonb, `migracao-simulador-perguntas.sql`): cada campanha `perfil_consumo` guarda seu próprio array de perguntas — `{ id, texto, tipo: 'single'|'multi', opcoes: [{ id, texto, peso }] }`. Campanha nova já nasce com um molde padrão pré-preenchido (`perguntasPadrao()`, mesmos textos/pesos que existiam fixos em código antes) — editável à vontade, não em branco.
- **Pontuação por PERCENTUAL, não número fixo:** `calcularPerfilDinamico()` soma os pesos das opções escolhidas e divide pela pontuação MÁXIMA possível daquela campanha específica (soma do maior peso de cada single + soma de todos os pesos positivos de cada multi) — necessário porque campanhas diferentes podem ter quantidade/peso de perguntas totalmente diferentes; um número fixo tipo "60 pontos = quente" não faria sentido pra todas. Faixas: ≥60% quente, 30–59% morno, <30% frio (mesmos cortes de antes, agora relativos).
- **Score sempre recalculado no servidor, igual antes** — só que a partir da própria config gravada em `simuladores.perguntas`, nunca aceitando peso/pontuação vindo do cliente. A Edge Function busca sua PRÓPRIA cópia da campanha no banco (nunca confia num array de perguntas que o cliente mandasse).
- **Perguntas condicionais (`exibirSe`) foram removidas** — simplificação deliberada de v1: o construtor vira uma lista linear (sem regras de "mostrar X se Y"), mais simples de construir e editar. Efeito colateral aceito: a pergunta "dificuldade" agora aparece sempre, mesmo pra quem respondeu "ainda não tenho internet" — o responsável pode reescrever/remover essa pergunta na campanha se achar estranho.
- **Snapshot no lead, não só o id da campanha:** `leads.perfil_consumo` grava `{ versao: 2, perguntas, respostas, perfil, combo }` — as PRÓPRIAS perguntas usadas na submissão, não uma referência à campanha. Motivo: a campanha pode ser editada ou até apagada depois, e o lead precisa preservar o que a pessoa realmente viu e respondeu (auditoria + renderização correta do card do lead a qualquer momento). `resumoPerfil()` passa a detectar dois formatos: leads novos (`perguntas` no jsonb) e leads legados D-072 (sem esse snapshot, catálogo fixo em código) — sem migração de dado, sem quebrar histórico.
- **`servicoInteresse` do Lead passou a derivar do PERFIL de uso (D-074)**, não mais das perguntas de intenção — antes dependia da chave fixa `usos`/`streaming` existir; como as perguntas agora são livres, essa chave pode nem existir na campanha. `perfil === 'streaming' → inclui 'streamings'`, senão só `'internet_residencial'`. Pelo mesmo motivo, o destaque visual do Apps Black no combo (D-074, "combina com seu perfil") passou a se basear no PERFIL escolhido em vez de tentar detectar uma resposta de quiz específica.
- **Construtor de perguntas** (`PerguntasBuilder` em `SimuladorTab.jsx`, botão "Perguntas" por campanha, ao lado de "QR / Link"): adicionar/remover/reordenar pergunta e opção, texto único ou múltipla escolha, peso numérico por opção, validação antes de salvar (mínimo 1 pergunta, mínimo 2 opções, texto obrigatório, peso ≥ 0).
- **Popup de apps no combo:** botão "ⓘ" ao lado de cada checkbox (Yellow/Black) abre um popup listando os apps reais daquele bundle (mesma lista já usada na aba Pacotes do vendedor, `APPS_ADICIONAIS[].itens`) — sem ícones/logos de marca (não há esses assets no projeto; se o responsável fornecer arquivos de logo depois, dá pra trocar os chips de texto por imagem).

**Alternativas Avaliadas:**
- **Só selecionar/reordenar perguntas de um catálogo fixo (sem reescrever texto)** — rejeitada: não atendia o pedido de definir peso/pontuação por resposta, que foi o ponto central do pedido.
- **Perguntas 100% livres SEM conceito de peso** (só registro, sem entrar na pontuação) — rejeitada: o responsável pediu explicitamente a capacidade de atribuir peso/nível de intenção por resposta.
- **Catálogo global editável (uma vez, valendo pra todas as campanhas)** — rejeitada a pedido explícito do responsável: "cada campanha com suas próprias perguntas".
- **Threshold fixo de pontuação (ex: sempre 60 pontos = quente)** — rejeitada: só funcionaria bem pra campanhas com o mesmo número/peso de perguntas do molde padrão; percentual da pontuação máxima generaliza pra qualquer configuração.

**Arquivos Afetados:** `supabase/migracao-simulador-perguntas.sql` (novo), `src/lib/simulador.js` (`perguntasPadrao`, `normalizarRespostasDinamico`, `calcularPerfilDinamico`; `resumoPerfil` dual-formato; remoção de `calcularPerfil`/`normalizarRespostas`/`perguntasVisiveis`/`USOS_ALTA_DEMANDA`; bump `PERGUNTAS_SIMULADOR_VERSAO` para 2), `supabase/functions/submeter-simulador/index.ts` (motor de scoring dinâmico espelhado + fallback pro molde padrão), `src/api/simuladorApi.js` (`addSimulador` semeia `perguntasPadrao()` em campanhas `perfil_consumo`), `src/lib/dataService.js` (coluna `perguntas` em `simuladorFromDb`/`simuladorToDb`/selects), `src/public/SimuladorPublico.jsx` (quiz renderiza de `simulador.perguntas`; popup de apps), `src/features/simulador/SimuladorTab.jsx` (`PerguntasBuilder`), `src/index.css` (`.sim-app-info-btn`, `.sim-app-popup*`), `tests/simulador.unit.test.js` (reescrito: +61 asserts no motor dinâmico), `tests/simulador.test.js` (+2 cenários — questionário próprio por campanha, popup de apps — e ajuste dos existentes pra perguntas não-condicionais).

**Riscos:** **Ordem de deploy** — `migracao-simulador-perguntas.sql` + `NOTIFY pgrst` antes do redeploy da Edge Function (que agora seleciona a coluna `perguntas`). Redeploy da `submeter-simulador` obrigatório (motor de scoring mudou de catálogo fixo pra dinâmico — payload antigo do cliente, se algum ficar em cache, ainda funciona, pois o formato de entrada `respostas`/`perfil`/`combo` não mudou, só a validação interna). Campanhas criadas antes desta migração (sem `perguntas`) continuam funcionando via fallback (`perguntasPadraoFallback()` no servidor, `perguntasPadrao()` no cliente) — mesmo conteúdo, sem quebra. Leads antigos sem snapshot de `perguntas` continuam sendo exibidos corretamente pelo branch legado de `resumoPerfil()`.

**Status:** Ativa

---

### [D-076] — Simulador vira 2 fluxos públicos independentes (Oferta / Demanda), nunca mais encadeados; tipo Territorial removido

**Data:** 2026-07-09
**Tipo:** Feature / Mudança de arquitetura (correção de desenho pós-D-075)

**Contexto:** Ao testar o construtor de perguntas do D-075 em produção, o responsável reportou confusão: editava a "Pergunta 1" no construtor, mas ao abrir o link público ela aparecia como a 2ª tela do quiz — porque toda campanha `perfil_consumo` encadeava DUAS coisas na mesma sessão (a etapa fixa de "perfil de uso", D-074, sempre na frente; depois as perguntas configuráveis, D-075). Investigado e descartada a hipótese de bug de persistência (confirmado via teste manual: F5 + reabrir o construtor preservava a edição) — o comportamento estava correto, só contraintuitivo. Na conversa, o responsável propôs separar em 2 funcionalidades: "o gerador de oferta com base no perfil" (o que já funcionava) e "o gerador de perguntas com base nas demandas" (o construtor do D-075, mas sozinho, sem a etapa de perfil na frente) — e que o QR/Link desse tipo só devia ficar disponível depois de as perguntas estarem configuradas, já que antes disso não tem o que perguntar. Também foi decidido remover o tipo `territorial` (D-073) nesse mesmo movimento — o responsável avaliou que não usaria esse formato específico.

**Decisão:**
- **2 tipos de campanha, mutuamente exclusivos, nunca mais chained:**
  - `oferta` (renomeado de `perfil_consumo`): só a etapa fixa de perfil de uso (D-074) → pacote fixo + combo de upsell → contato. Sem perguntas configuráveis, sem construtor — nada a configurar além da imagem/copy já cobertos por Ofertas (aba separada, sem relação). Lead sempre nasce `temperatura='quente'`, `pontuacao=null` (não há quiz de intenção nesse fluxo pra gerar score).
  - `demanda` (novo): só as perguntas configuráveis por campanha (D-075, texto + peso por opção) → mensagem de resultado PERSONALIZADA pela campanha (novo campo `mensagem_resultado`, editável no mesmo construtor de perguntas) → contato. Sem etapa de perfil/pacote. Lead nasce com `pontuacao`/`temperatura` calculados a partir das perguntas (mesmo `calcularPerfilDinamico()` do D-075, sem mudança na fórmula).
- **Mensagem de resultado personalizável:** como o tipo `demanda` não tem pacote pra recomendar, o "valor antes do dado" (princípio de produto do Simulador desde o D-072) passou a ser um texto livre configurado pelo marketing por campanha, com um valor padrão editável (`mensagemResultadoPadrao()`) — mesmo princípio de "nasce com molde, edita à vontade" já usado pra `perguntasPadrao()`.
- **QR/Link gated até ter pergunta configurada:** `SimuladorTab.jsx` só mostra o botão "QR / Link" de uma campanha `demanda` quando `perguntas.length > 0` — antes disso mostra um aviso textual. Campanha `demanda` nova já abre direto no construtor de perguntas ao ser criada (UX guiada: primeiro configura, depois divulga). `oferta` nunca teve essa gate (não depende de configuração nenhuma pra estar pronta).
- **Tipo `territorial` (D-073) removido:** não dá mais pra criar campanha desse tipo — retirado do seletor de criação e dos 2 fluxos públicos. Campanhas territoriais existentes (nenhuma em uso real até esta decisão) são desativadas por uma migração, não apagadas — lead histórico já capturado continua intacto. O relatório interno "Demanda por região" (`LeadsTab.jsx`, RPC `demanda_por_regiao()`) **não foi removido**: ele agrega qualquer lead com `cidade`/`bairro` preenchido, não só os de origem territorial (Form Builder e o próprio tipo `demanda` também alimentam cidade/bairro via contato) — continua funcionando, só deixa de receber uma fonte específica de dado.
- **Migração de dados:** campanha de teste existente (`perfil_consumo`, sem uso real) excluída pelo responsável antes do deploy — não houve necessidade de decidir como migrar um caso real. A migração (`migracao-simulador-tipos.sql`) trata o caso genérico mesmo assim: `perfil_consumo` → `oferta` (preserva o pacote, perde perguntas porventura configuradas — que ficam órfãs no banco, não apagadas); `territorial` → desativado.

**Alternativas Avaliadas:**
- **Manter um único tipo, só reordenar as etapas (perguntas antes do perfil)** — rejeitada: não resolve a confusão de fundo (ainda seriam 2 conceitos encadeados numa sessão só) e não atende ao pedido explícito de "2 formas separadas de mandar a solicitação".
- **Manter Territorial como 3º tipo** — era a recomendação inicial (resolve um problema diferente: mapa de demanda geolocalizada sem quiz), mas o responsável optou por remover deliberadamente ("Remover Territorial") por não ver uso prático pra esse formato específico.
- **Tela de resultado do tipo `demanda` mostrar a pontuação/temperatura calculada** (em vez de mensagem livre) — rejeitada a favor de mensagem personalizável, que dá mais controle de copy ao marketing e evita expor um número de "score" pouco autoexplicativo pro titular do dado.

**Arquivos Afetados:** `supabase/migracao-simulador-tipos.sql` (novo — migra `tipo`, troca constraint, adiciona `mensagem_resultado`), `src/lib/simulador.js` (`mensagemResultadoPadrao()`), `src/api/simuladorApi.js` (`addSimulador` semeia `perguntas`/`mensagemResultado` só pra tipo `demanda`), `src/lib/dataService.js` (coluna `mensagem_resultado` em `simuladorFromDb`/`simuladorToDb`/selects), `src/public/SimuladorPublico.jsx` (reescrito: 2 fluxos independentes, sem `territorial`), `src/features/simulador/SimuladorTab.jsx` (tipos renomeados, gate de QR/Link, textarea de mensagem no `PerguntasBuilder`), `supabase/functions/submeter-simulador/index.ts` (reescrito: branch por tipo `oferta`/`demanda`, sem `territorial`), `tests/simulador.test.js` (reescrito: suites separadas por tipo), `tests/simulador.unit.test.js` (+1 teste `mensagemResultadoPadrao`).

**Riscos:** **Ordem de deploy** — `migracao-simulador-tipos.sql` + `NOTIFY pgrst` antes do redeploy da Edge Function (que agora rejeita `tipo='territorial'` implicitamente, tratando qualquer coisa que não seja `'demanda'` como `'oferta'`). Campanhas `territorial` pré-existentes (se houver, fora do ambiente de teste do responsável) são desativadas pela migração — deixam de aceitar novo lead, mas o histórico não é afetado. `resumoPerfil()` não precisou de mudança: já tratava `perfil`/`combo` e `perguntas`/`respostas` como blocos independentes desde o D-075, então um lead `oferta` (só perfil/combo) ou `demanda` (só perguntas/respostas) renderiza corretamente sem branch novo.

**Status:** Ativa

---

### [D-077] — Simulador de Oferta: perfil DEDUZIDO por quiz fixo de qualificação (não mais escolha direta); upsell de plano Móvel no combo

**Data:** 2026-07-09
**Tipo:** Feature / Reversão parcial de decisão anterior (D-074, dentro do tipo `oferta`)

**Contexto:** Ao validar o D-076 (2 fluxos separados) em produção, o responsável testou o Simulador de Oferta isolado e achou o fluxo raso demais: uma única tela com 4 botões (Básico/Streaming/Home Office/Gamer) e clique direto no pacote — "não só um wizard com 4 perguntas e já cair para a oferta, pois a oferta é gerada a partir de uma análise prévia do perfil". Pediu explicitamente para reintroduzir as perguntas de qualificação que existiam antes do D-074 (moradores/usos/equipamentos/tem_internet/dificuldade), mas com a primeira pergunta trocada de "quantas pessoas moram com você" para "quantos dispositivos estão conectados na sua rede atual" — e que o sistema deduza o perfil das respostas, em vez da pessoa escolher. Pediu também que o combo de upsell (hoje Apps Yellow/Black + upgrade de pacote) ganhe uma opção de plano de Internet Móvel, usando a mesma tabela de preços já usada na aba "Pacotes" do vendedor. Confirmado explicitamente que isso NÃO reabre a fusão dos dois fluxos do D-076 — `oferta` e `demanda` continuam campanhas de tipo totalmente separado, sem interferência entre si; a mudança é só *dentro* do fluxo `oferta`.

**Decisão:**
- **Quiz FIXO de qualificação para 'oferta'** (`PERGUNTAS_OFERTA`, 5 perguntas, catálogo fixo em código — sem construtor/edição pelo marketing, ao contrário das perguntas de `demanda`): dispositivos conectados → usos → equipamentos → já tem internet → maior dificuldade. Reaproveita `normalizarRespostasDinamico()` (mesma validação hostil-safe do D-075) só pra sanitizar as respostas — sem soma de pesos (opções têm `peso: 0`, não usado).
- **`perfilPorRespostasOferta()` — dedução por REGRA de prioridade, não soma de pontos**: jogos declarado OU muitos dispositivos → Gamer; senão home office declarado → Home Office; senão streaming declarado → Streaming; senão → Básico (fallback). Decisão deliberada de manter regra simples e explicável em vez de score com threshold arbitrário (que exigiria inventar cortes sem dado real pra calibrar) — e principalmente **não reabre o princípio do D-074** ("pacote nunca calculado por soma de sinais"): a saída continua sendo sempre uma das 4 categorias fixas com pacote associado, só a ENTRADA (perfil escolhido → perfil deduzido) mudou.
- **Servidor deduz, nunca aceita perfil pronto do cliente**: a Edge Function `submeter-simulador` passou a receber só `respostas` no payload de `oferta` (campo `perfil` removido do contrato) — mesmo princípio de segurança já aplicado ao score de `demanda` desde o D-072/D-075, agora estendido à dedução de perfil.
- **Tela pública "oferta" perde a etapa única de escolha e ganha 5 telas sequenciais** (mesmo "esqueleto" de wizard de `demanda` — pergunta → calculando → resultado — reaproveitado por código, não por conteúdo: cada tipo carrega e mostra só o SEU próprio questionário, nunca mistura). O perfil deduzido continua aparecendo como texto informativo na tela de resultado (label + descrição), só deixou de ser clicável.
- **Upsell de plano Móvel**: novo catálogo `PLANOS_MOVEL` (Pré 2GB R$29,90, Controle 10/24/35GB R$39,90/54,90/69,90) — mesma fonte única de preço reaproveitada pela aba "Pacotes" do vendedor (`VendedorApp.jsx`, tabela antes hardcoded inline, agora lê do catálogo). `montarCombo()` ganha `opcoes.movel` (a `key` do plano, nunca o preço — mesmo princípio anti-cliente-hostil dos outros itens do combo). Seleção única (não checkbox — a pessoa não contrata 2 planos móveis ao mesmo tempo), UI em chips.
- **`leads.perfil_consumo` de leads `oferta` passa a incluir `perguntas`/`respostas`** (snapshot do quiz de qualificação) além de `perfil`/`combo` — mesmo shape usado por `demanda` desde o D-075, então `resumoPerfil()` não precisou de nenhuma mudança (já tratava os dois blocos como independentes).

**Alternativas Avaliadas:**
- **Score numérico com threshold (ex: ≥50 pontos → Gamer)** — rejeitada: exigiria calibrar cortes arbitrários sem dado real de uso; a regra de prioridade por sinal declarado é mais direta de explicar e ajustar.
- **Deixar a pessoa CONFIRMAR/ajustar o perfil deduzido antes do resultado** — não pedida pelo responsável; descartada por ora para manter o fluxo curto (pode virar um ajuste futuro se o texto informativo se mostrar insuficiente).
- **Checkbox (múltipla escolha) pro plano Móvel, igual Apps Yellow/Black** — rejeitada: são 4 tiers de plano, não um add-on binário; contratar mais de um simultaneamente não faz sentido, por isso virou seleção única (chip).

**Arquivos Afetados:** `src/lib/simulador.js` (`PERGUNTAS_OFERTA`, `perfilPorRespostasOferta()`, `PLANOS_MOVEL`, `planoMovelPorKey()`, `montarCombo()` com `opcoes.movel`, `resumoPerfil()` com linha de Móvel), `src/public/SimuladorPublico.jsx` (reescrito: fluxo `oferta` vira wizard sequencial de 5 perguntas, perfil deduzido via `useMemo`, tela de combo com seletor de plano Móvel), `supabase/functions/submeter-simulador/index.ts` (espelha `PERGUNTAS_OFERTA`/`perfilPorRespostasOferta`/`PLANOS_MOVEL`; branch `oferta` não aceita mais `body.perfil`), `src/apps/VendedorApp.jsx` (tabela Móvel da aba Pacotes passa a ler de `PLANOS_MOVEL`, elimina duplicação de preço), `src/features/simulador/SimuladorTab.jsx` (texto de descrição do tipo `oferta` atualizado), `src/index.css` (`.sim-combo-movel*`, `.sim-movel-chip*`), `tests/simulador.unit.test.js` (+19 asserts: `PERGUNTAS_OFERTA`, `perfilPorRespostasOferta`, combo com Móvel), `tests/simulador.test.js` (suite `tipo Oferta` reescrita: quiz sequencial em vez de escolha direta, cenários por perfil deduzido, upsell Móvel no fluxo completo).

**Riscos:** **Redeploy obrigatório** da Edge Function `submeter-simulador` (contrato mudou: `body.perfil` não é mais aceito no tipo `oferta`, `body.respostas` passa a ser sempre enviado). Sem migração de banco nova (`perfil_consumo`/`combo` continuam jsonb livre, `movel` é só mais uma chave opcional dentro do combo já existente). Leads `oferta` gravados ANTES desta mudança não têm `perguntas`/`respostas`/`combo.movel` — `resumoPerfil()` já tolera campos ausentes (`if (combo.movel)`), não quebra histórico. Regra de dedução é opinativa (prioriza jogos/dispositivos > home office > streaming > básico) — se o responsável achar a classificação errada em algum caso real, é um ajuste pontual em `perfilPorRespostasOferta()` (client + servidor, mesma função espelhada).

**Status:** Ativa

---

### [D-078] — Hardening de segurança pós-auditoria (RLS, RPC destrutivo, rate limit, CSP, painel)

**Data:** 2026-07-17
**Tipo:** Segurança

**Contexto:** O responsável solicitou uma auditoria de segurança completa (Pentest + Code Review) do projeto — autenticação, Supabase Auth, RLS de todas as tabelas, Edge Functions, Storage, funções SQL, LGPD e OWASP Top 10 — com a exigência explícita de preservar 100% o comportamento funcional. A auditoria classificou o risco geral como **ALTO**, não por falhas isoladas, mas por **fragilidade sistêmica**: a postura de segurança depende de configuração externa (ordem manual de aplicação de migrações, settings do painel Supabase, secrets) que o repositório não garante. Sete achados foram identificados (V-01 a V-07) e corrigidos neste registro, todos sem alterar fluxos legítimos.

**Decisão (correções aplicadas — nova migração `supabase/migracao-hardening-seguranca.sql`, idempotente, roda por último + `NOTIFY pgrst`):**
- **V-01 (Alta) — `leads_select` consolidado com condição estrita:** a policy de SELECT de `leads` era redefinida por 6 migrações aplicadas manualmente, sem runner que garantisse ordem; versões de D-059 (`migracao-comercial.sql`) e D-061 (`migracao-qrcode.sql`) deixaram o branch do vendedor permissivo (`papel_atual() in (...,'vendedor')` ou `vendedor_id is not null`), permitindo a um vendedor autenticado ler leads de colegas (nome/CPF/telefone/endereço) via REST/PostgREST direto — a UI já filtrava por `vendedorNome`, mas a query crua não. Consolidada numa única fonte com a condição estrita do PA-11 (`vendedor_id = auth.uid()`). marketing/comercial mantêm leitura total (fila de distribuição). Sem regressão: todo lead com `auth.uid()` já nasce com `vendedor_id`, e o ranking é `security definer` (ignora RLS). Reforça e substitui a intenção de `migracao-rls-vendedor-leads-v2.sql`.
- **V-02 (Média-Alta) — `REVOKE` da função de retenção:** `limpar_leads_expirados()` (SECURITY DEFINER, faz `DELETE` físico em `leads`) não tinha `revoke` — por padrão o Postgres concede `EXECUTE` a `PUBLIC`, tornando-a chamável por `anon`/`authenticated` via `/rest/v1/rpc/`. Revogada de `public, anon, authenticated`; só o job `pg_cron` (owner) a executa. Mesmo padrão já usado em `ranking_evento`/`ranking_mes`/`demanda_por_regiao`. O app nunca a chama.
- **V-05 (Baixa-Média) — leituras internas restritas a papel ativo:** `formularios_select_interno`/`campos_personalizados_select_interno`/`simuladores_select_interno` usavam `to authenticated using (true)` — qualquer sessão autenticada (inclusive conta inativa recém-criada) lia todas as linhas, inclusive itens inativos e a lógica de pontuação. Trocado por `papel_atual() is not null`. A leitura pública `anon` (`ativo=true`) das páginas `/f` e `/s` **não** foi tocada.
- **V-06 (Baixa) — `audit_log` não aceita mais INSERT direto:** a policy de insert usava `with check (true)` (forja de trilha por qualquer autenticado). Removida; a escrita legítima continua pelo trigger `log_lead_change` (SECURITY DEFINER, owner com BYPASSRLS). O app nunca insere em `audit_log` diretamente.
- **V-03 (Média) — rate limit por IP não-forjável (`supabase/functions/_shared/captacao.ts`):** `getClientIp` usava a **primeira** entrada de `X-Forwarded-For`, que o cliente pode forjar por prepend, dando uma chave nova a cada request e zerando o rate limit das portas públicas. Passou a percorrer a cadeia de trás pra frente e usar a **última** entrada com formato de IP válido (a anexada pelo gateway confiável do Supabase). Caso normal de IP único: comportamento idêntico. Requer redeploy de `submeter-formulario` e `submeter-simulador` (as duas importam o `_shared`).
- **V-07 (Baixa) — CSP endurecida (`vercel.json`):** adicionados `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` à Content-Security-Policy já existente. Nada carregado hoje é afetado.
- **V-04 (Média) — auto-cadastro desativado (config de painel, não código):** o app nunca chama `signUp` (usuários são criados só pela Edge Function `atualizar-email-usuario` via Admin API, que ignora esse setting), mas o painel permitia auto-registro público por qualquer um com a anon key. Desativado "Permitir que novos usuários se cadastrem" no Supabase. Documentado em `doc/SEGURANCA_HARDENING.md` (novo checklist versionado de hardening de painel/deploy: signups off, confirmar e-mail, secret `CORS_ALLOWED_ORIGINS`, ordem de migrações, padrão `revoke` em SECURITY DEFINER, bucket público).

**Alternativas Avaliadas:**
- **Rate limit global (teto por janela) em vez de por IP** — descartada por ora: throttla picos legítimos (ex.: evento com muitas submissões simultâneas) e permite um atacante bloquear submissões legítimas ao saturar o teto. A correção do IP não-forjável resolve a raiz sem esse efeito colateral.
- **CAPTCHA invisível nas portas públicas** — não implementado agora; anotado em `doc/SEGURANCA_HARDENING.md` como reforço futuro se o abuso persistir.
- **Deixar V-03/V-04 para depois** — descartada: aplicados junto com o resto por serem baratos e de alto valor; V-04 é só um toggle de painel.

**Arquivos Afetados:** `supabase/migracao-hardening-seguranca.sql` (nova migração idempotente — V-01/V-02/V-05/V-06), `supabase/functions/_shared/captacao.ts` (`getClientIp` — V-03; exige redeploy das 2 Edge Functions públicas), `vercel.json` (CSP — V-07), `doc/SEGURANCA_HARDENING.md` (novo — checklist de painel/deploy, V-04 e recomendações operacionais).

**Riscos:** As correções de RLS/RPC/policies **não** se aplicam sozinhas — a migração precisa ser rodada no SQL Editor **como última** (a ambiguidade de ordem foi justamente a causa do V-01); as queries de verificação no rodapé do arquivo confirmam o estado final. As Edge Functions no painel estavam **inline** (cópia achatada do `_shared/captacao.ts`), divergentes do repositório — o `getClientIp` novo teve que ser colado manualmente em cada uma e redeployado; enquanto o deploy for pelo painel (e não via Supabase CLI), essa divergência painel↔repositório pode voltar. **Recomendação de médio prazo (não urgente, acordada com o responsável):** adotar migração versionada via Supabase CLI para eliminar tanto a ambiguidade de ordem (V-01) quanto o drift das Edge Functions. Relatório completo da auditoria e detalhamento de cada achado (severidade/exploração/impacto/probabilidade) foi entregue na sessão; o processo operacional de aplicação está em `doc/SEGURANCA_HARDENING.md`.

**Status:** Ativa — aplicada em produção (migração SQL executada e verificada, 2 Edge Functions redeployadas, auto-cadastro desativado no painel, CSP mesclada na `main` via PR #83). **Verificação final em 2026-07-17:** durante a janela de aplicação o projeto Supabase (Free Tier) estava pausado por inatividade e derrubou os deploys de produção na Vercel; após a reativação, a migração foi executada no SQL Editor e as 4 queries de verificação do rodapé passaram (V-01: `leads_select` com `vendedor_id = auth.uid()`; V-02: `EXECUTE` apenas para `service_role`/`postgres`; V-05: 3 policies com `papel_atual() IS NOT NULL`; V-06: sem policy de INSERT em `audit_log`), e conferiu-se que as duas Edge Functions no painel já continham o `getClientIp` do V-03 — sem drift painel↔repositório nesta data. Redeploy de produção da Vercel re-disparado via commit `ecf2ba2` na `main` (o redeploy manual anterior havia reconstruído apenas uma preview, que não assume o domínio).

---

### [D-079] — Login social (Google OAuth) avaliado e NÃO adotado; cadastro permanece exclusivo do marketing

**Data:** 2026-07-17
**Tipo:** Segurança / Autenticação

**Contexto:** Ao revisar o painel do Supabase (Authentication → Sign In / Providers), o responsável avaliou habilitar o provedor Google para que usuários pudessem se registrar/logar com conta Google. A objeção imediata, levantada pelo próprio responsável: um usuário auto-registrado não teria como se classificar entre os papéis (marketing/comercial/vendedor).

**Decisão:** Não habilitar nenhum provedor social — todos permanecem desabilitados. Fundamentos:
- O papel **nunca** pode ser escolha do próprio usuário no registro (seria escalada de privilégio trivial — qualquer um se marcaria `marketing`). Classificação é decisão administrativa, feita pelo marketing na aba Equipe.
- O sistema até toleraria o auto-registro com segurança formal: o trigger `on_auth_user_created` (`migracao-auth.sql`) cria todo usuário novo como `vendedor` + `ativo=false`, e `getSessao()`/`signIn` (`dataService.js`) bloqueiam contas inativas. Mas isso reabriria o **auto-cadastro público que o D-078/V-04 acabou de fechar** — poluição de `auth.users`/`perfis` e vetor de flood, sem nenhum ganho real (quem usa o sistema é a equipe interna, já cadastrada pelo marketing).

**Alternativas Avaliadas:**
- **Google como método de LOGIN apenas (sem registro)** — viável no futuro, sem contrariar o V-04: com "Enable Signups" OFF, `signInWithOAuth` falha para e-mail desconhecido, mas o Supabase vincula a identidade Google a uma conta **pré-criada** cujo e-mail verificado coincida. Exigiria: botão em `LoginAuth.jsx`, provedor Google configurado no painel (client ID/secret do Google Cloud), e replicar no retorno OAuth o tratamento de `ativo=false` que `signIn` já faz (signOut + mensagem). Adiado por falta de demanda — equipe pequena, login por senha não é atrito hoje. Validar o vínculo automático de identidade num usuário de homologação antes de anunciar, se um dia for implementado.
- **Auto-registro com aprovação manual (gate por `ativo=false`)** — tecnicamente já funcionaria hoje, mas contraria frontalmente o V-04; descartada.

**Arquivos Afetados:** Nenhum — decisão de configuração/postura de painel; nenhum código alterado.

**Status:** Ativa

---

### [D-080] — Simulador ganha 3º tipo de campanha: Quiz de Acertos + Sorteador entre participantes

**Data:** 2026-07-20
**Tipo:** Feature

**Contexto:** O responsável pediu um novo formato de captação para o Simulador, com um cenário concreto: um evento MotoFest (público de motoclube), onde um quiz de conhecimento com resposta certa/errada por pergunta classifica a pessoa numa faixa de resultado (ex: "0–3 acertos: 🛵 Piloto de Primeira Viagem" ... "10 acertos: 👑 Mestre das Duas Rodas") — diferente das perguntas de intenção ponderadas de 'demanda' (D-075) e da dedução de perfil de 'oferta' (D-077), nenhuma das duas modela "resposta certa". Pediu também um sorteador entre quem participou do quiz, já que esse tipo de campanha costuma ser usado em eventos ao vivo.

**Decisão:**
- **3º tipo de campanha, `quiz`**, ao lado de `oferta`/`demanda` — nunca encadeado com os outros dois na mesma sessão pública (mesmo princípio do D-076). Cada pergunta é sempre de escolha única e tem uma `respostaCorretaId`; pontuação = **contagem de acertos** (nunca soma de peso, ao contrário de 'demanda'). O marketing define **faixas de classificação totalmente editáveis** (quantidade de faixas, min/max de acertos, emoji, título) — não um número fixo de 4 faixas nem de perguntas, para servir a qualquer quiz futuro além do exemplo do MotoFest.
- **Reaproveita colunas já existentes em `leads`** (`perfil_consumo`, `pontuacao`, `temperatura`, `simulador_id`, todas de D-072) — sem coluna nova na tabela de leads. `pontuacao` passa a guardar a contagem de acertos quando a campanha é `quiz`; `perfil_consumo.tipo = 'quiz'` é o discriminador que `resumoPerfil()` usa para saber renderizar "Acertou X de N · 🤘 Lenda do Asfalto" em vez do snapshot de perguntas/respostas de 'oferta'/'demanda'. Nova migração `migracao-simulador-quiz.sql` adiciona só duas colunas em `simuladores` (`quiz_perguntas`, `quiz_faixas`, ambas jsonb) e amplia a constraint de `tipo`.
- **Molde de exemplo pronto pra usar, não um catálogo fixo**: `quizPerguntasPadrao()`/`quizFaixasPadrao()` (`src/lib/simulador.js`) semeiam uma campanha `quiz` nova com as 10 perguntas de trivia sobre universo motociclista e as 4 faixas do exemplo do MotoFest — o marketing edita tudo livremente depois (mesmo princípio de `perguntasPadrao()` em 'demanda', D-075).
- **Scoring recalculado no servidor** (`submeter-simulador`, branch novo `if (simulador.tipo === 'quiz')`) — mesmo princípio anti-cliente-hostil do resto do arquivo: o cliente manda só as respostas brutas, o servidor busca `quiz_perguntas`/`quiz_faixas` da própria campanha e recalcula acertos/faixa/temperatura. Sem faixa configurada que cubra a pontuação, cai num fallback genérico (`🎯 Participante`) em vez de quebrar a submissão.
- **Sorteador** (`Sorteador`, dentro de `SimuladorTab.jsx`) — sorteia N ganhadores aleatoriamente entre **todos** os leads com aquele `simulador_id`, independente de já terem sido distribuídos a um vendedor (por isso uma função de busca nova, `fetchLeadsPorSimulador`, diferente de `fetchLeadsSemVendedor`/`fetchLeadsQrCode` que só mostram os sem dono). Sem coluna nova nem persistência do resultado do sorteio — é um sorteio ao vivo (a marketing anuncia o nome na hora), não um registro de auditoria.
- Serviço de interesse do lead de `quiz` é `['outro']` (fixo) — o quiz não qualifica intenção de compra de um serviço específico, é uma ação de engajamento/captação de contato num evento.

**Alternativas Avaliadas:**
- **Estender o tipo 'demanda' com um "modo certo/errado"** — descartada: misturaria dois modelos de pontuação (percentual ponderado por peso vs. contagem de acertos) na mesma tela de gestão e no mesmo construtor, contrariando o próprio motivo do D-076 (separar os fluxos porque misturar confundia o marketing).
- **Faixas fixas em número (sempre 4, só texto editável)** — descartada: amarraria toda campanha futura ao formato de exemplo do MotoFest (10 perguntas, 4 faixas); faixas totalmente configuráveis (min/max arbitrários, quantidade livre) servem qualquer quiz com qualquer número de perguntas.
- **Sorteio persistido (marcar lead como "ganhador" no banco)** — não implementado agora, por não ter sido pedido; o sorteio é só uma dinâmica ao vivo. Se um dia precisar de auditoria de quem ganhou, um campo `sorteado_em`/`sorteio_id` em `leads` resolveria sem mudar o resto do desenho.

**Arquivos Afetados:** `supabase/migracao-simulador-quiz.sql` (nova migração — constraint de tipo + `quiz_perguntas`/`quiz_faixas`), `src/lib/simulador.js` (`quizPerguntasPadrao`, `quizFaixasPadrao`, `faixaPorAcertos`, `corrigirQuiz`, branch de `resumoPerfil`, bump de `PERGUNTAS_SIMULADOR_VERSAO` pra 3), `supabase/functions/submeter-simulador/index.ts` (branch `quiz`, espelho de `corrigirQuiz`/`faixaPorAcertos` em Deno — requer redeploy), `src/api/simuladorApi.js` (semeia `quizPerguntas`/`quizFaixas` na criação), `src/lib/dataService.js` (`simuladorFromDb`/`ToDb`, colunas no `fetchAll`/`fetchSimuladorPublico`, nova `fetchLeadsPorSimulador`), `src/features/simulador/SimuladorTab.jsx` (`QuizBuilder`, `Sorteador`, 3ª opção no seletor de tipo), `src/public/SimuladorPublico.jsx` (3º fluxo público: quiz sequencial → contagem de acertos → faixa → contato), `src/features/leads/LeadsTab.jsx` (label "acertos" em vez de "pts" na fila de distribuição pra leads de quiz), `tests/simulador.unit.test.js` e `tests/simulador.test.js` (cobertura unitária + E2E do novo tipo).

**Riscos:** Precisa da migração `migracao-simulador-quiz.sql` rodada (+ `NOTIFY pgrst`) e das duas Edge Functions redeployadas (só `submeter-simulador` muda de fato, mas o padrão do projeto é sempre conferir as duas por causa do `_shared/captacao.ts`) antes do deploy do frontend — mesma ordem de dependência dos D-072/D-075/D-076. Desenvolvido em branch isolada (`claude/interactive-quiz-lead-capture-thqh7g`) para validação antes do merge na `main`.

**Correções aplicadas antes do merge (mesmo PR #85):**
- **Radio de resposta certa sem tamanho travava o input de opção do `QuizBuilder`** — o `<input type="radio">` não tinha `width`/`flex` próprios, então herdava a regra global `input { width: 100% }` e disputava espaço com o campo de texto da opção no mesmo flex row, impedindo digitação visível (reportado em teste manual no preview). Corrigido fixando `width: 18px`/`flex: '0 0 auto'` no radio — mesmo padrão de bug já resolvido em outros checkboxes do app (`.campo-main`, `.sim-combo-check`), só não tinha sido aplicado aqui.
- **CTA de sorteio na tela de resultado do quiz**: banner "🎁 Deixe seu contato e concorra a um brinde RJNET!" + botão "Quero concorrer ao brinde →" na tela de resultado (antes só mostrava a faixa, sem reforçar que dava pra concorrer a um brinde via Sorteador); texto do formulário de contato e da tela final ajustados pra reforçar a mesma chamada.

**Status:** Ativa — mergeado na `main` via PR #85 em 2026-07-20, com validação manual do responsável em produção (preview não conseguia validar o envio real por CORS — `CORS_ALLOWED_ORIGINS` só libera o domínio de produção, decisão consciente de testar direto em produção já que a mudança não toca o fluxo de captação presencial dos vendedores). Ver D-081 para correções de responsividade mobile encontradas depois do merge.

---

### [D-081] — Simulador/Form Builder: correções de responsividade mobile pós-D-080 (checkbox LGPD e logo)

**Data:** 2026-07-20
**Tipo:** Correção

**Contexto:** Testando o Quiz de Acertos (D-080) num iPhone real, o responsável reportou dois problemas visuais nas páginas públicas (Simulador e Form Builder): (1) na tela de consentimento LGPD, o checkbox e o texto ficavam mal diagramados — "a letra foge da tela" — e algumas telas do fluxo ficavam arrastáveis para os lados (scroll horizontal indesejado); (2) a logo da RJNet aparecia alinhada à esquerda em vez de centralizada nas etapas de pergunta e na tela de contato.

**Decisão:**
- **Causa raiz do overflow horizontal**: o `<input type="checkbox">` do consentimento LGPD (`SimuladorPublico.jsx` e `FormularioPublico.jsx`, ambos com o mesmo trecho copiado) não tinha `width`/`flex` próprios, herdando a regra global `input { width: 100% }` e disputando espaço com o `<span>` de texto no mesmo flex row — o mesmo padrão de bug do radio do `QuizBuilder` (ver correção em D-080), só que dessa vez do lado do CLIENTE final, não da gestão. Em alguns motores mobile isso estourava a largura do card (que tem `max-width: 420px`) e deixava a página arrastável horizontalmente, apesar de `overflow-x: hidden` já estar em `html`/`body`/`#root`.
- **Correção**: nova classe `.consentimento-check` (`src/index.css`) fixa o checkbox em `17x17px`/`flex: 0 0 auto` e dá `flex: 1; min-width: 0` ao `<span>`, garantindo que o texto sempre quebre linha em vez de forçar overflow — removendo a dependência do comportamento de flex-shrink de controles nativos, que varia entre motores de navegador (não reproduzido no Chromium usado para testes automatizados neste ambiente; a evidência real veio de teste manual num iPhone).
- **Logo sempre centralizada**: `<img>` é inline por padrão — nas telas de pergunta (`SimuladorPublico.jsx`, wizard de quiz/oferta/demanda) e de contato (Simulador e Form Builder), o card não tinha `text-align: center` (diferente das telas de resultado/carregando/enviado, que já centralizavam), deixando a logo alinhada à esquerda junto com o resto do conteúdo (que intencionalmente é alinhado à esquerda). Corrigido com `display: 'block', margin: '0 auto ...'` direto na tag da logo, sem alterar o alinhamento do resto do conteúdo de cada tela.

**Alternativas Avaliadas:**
- **Só confiar em `overflow-x: hidden` no `html`/`body`** — já estava em vigor e não foi suficiente; a causa raiz (elemento realmente mais largo que o viewport) precisava ser corrigida na origem, não mascarada por clipping.
- **Envolver o card inteiro em `text-align: center`** para resolver a logo — descartada: mudaria o alinhamento do texto da pergunta/opções/campos do formulário, que é intencionalmente à esquerda; a correção pontual na tag da logo evita esse efeito colateral.

**Arquivos Afetados:** `src/index.css` (nova classe `.consentimento-check`), `src/public/SimuladorPublico.jsx` (checkbox LGPD + logo centralizada nas telas de pergunta e contato), `src/public/FormularioPublico.jsx` (mesmo checkbox LGPD + logo centralizada).

**Riscos:** Nenhum — mudança puramente visual/CSS, sem alteração de fluxo de dados, schema ou Edge Function. Validado com build de produção, suíte `tests/simulador.test.js` (21 testes) e verificação programática de `scrollWidth`/`clientWidth` num viewport de iPhone (390px) — o bug original em si não foi reproduzido em Chromium headless (motor de teste disponível neste ambiente), já que é um comportamento específico de motores WebKit/Safari mobile; a confirmação definitiva depende do teste manual do responsável no dispositivo real.

**Status:** Ativa — mergeado na `main` via PR #86 em 2026-07-20.

---

### [D-082] — Quiz de Acertos ganha resumo compartilhável (imagem) na tela final

**Data:** 2026-07-21
**Tipo:** Feature

**Contexto:** O responsável pediu, pro tipo `quiz` (D-080), um resumo do que a pessoa conquistou pra ela poder compartilhar — exemplo dado: quem chega em "Mestre das Duas Rodas" ver "acertou 9 de 9 perguntas", o tempo que levou e o nome do evento, e uma imagem simples pra compartilhar isso. Motivação: mecânica viral pra eventos ao vivo (MotoFest e futuros) — a pessoa divulga o próprio resultado em redes sociais/WhatsApp, promovendo a campanha (e a marca) organicamente.

**Decisão:**
- **Card gerado 100% no cliente via `<canvas>`** (`desenharResumoQuiz()`, `SimuladorPublico.jsx`) — mesma técnica já usada pro QR Code (`qrcode` + canvas em `SimuladorTab.jsx`), sem biblioteca nova. Formato 1080x1080 (mesmo padrão das imagens de Oferta, D-057). Conteúdo: logo RJNet, nome da campanha, faixa (emoji grande + título), "{primeiro nome} acertou X de Y perguntas!", tempo de resposta e o link da campanha (`/s/:slug`) no rodapé — o link no card é o próprio gancho viral (quem vê a imagem compartilhada consegue chegar no quiz).
- **Onde aparece:** só na tela final ("Recebemos seus dados!"), depois do contato já enviado — nunca antes, pra não misturar com a lógica de "mostrar resultado antes de pedir dado" que já rege o resto do wizard. Só renderizado para tipo `quiz` (é o único tipo com faixa/acertos pra resumir).
- **Tempo de resposta**: cronômetro só de UX (`inicioQuizRef`/`tempoQuizMs`) — conta da primeira pergunta até a última respondida, não inclui o tempo preenchendo nome/WhatsApp depois (esse tempo varia demais e não reflete desempenho no quiz). Nunca enviado ao servidor — puramente decorativo no card, sem gravação em `leads` nem em `simuladores`.
- **Compartilhamento**: botão único que usa a **Web Share API com arquivo** (`navigator.share({ files: [...] })`) quando o navegador suporta — abre o menu nativo do celular (WhatsApp, Instagram Stories, etc.), testado no iOS Safari; nos navegadores sem suporte a compartilhar arquivo (a maioria dos desktops), o mesmo botão vira "Baixar imagem do resultado" (mesmo padrão de download por `<a download>` já usado no QR Code).
- **Nome da pessoa aparece no card** (ex: "Carlos acertou 9 de 9 perguntas!") — decisão consciente: é a própria pessoa compartilhando o próprio resultado (como Duolingo/Wordle), maior engajamento; usa só o primeiro nome (não o nome completo) do campo que ela mesma preencheu no formulário de contato.

**Alternativas Avaliadas:**
- **Gerar a imagem no servidor** (Edge Function) — descartada: adicionaria complexidade (renderização de imagem em Deno, biblioteca extra) sem necessidade real; canvas no cliente já resolve com zero dependência nova e resposta instantânea.
- **Mostrar o resumo ANTES do contato** (na tela de resultado do quiz) — descartada: quebraria o princípio "valor antes do dado, mas só depois de um compromisso mínimo" que rege esse fluxo desde D-072; a pessoa poderia compartilhar e fechar a página sem nunca virar lead.
- **Tempo = sessão inteira (até o envio do contato)** — descartada: o tempo preenchendo o formulário de contato varia por motivo (rede, distração) e não mede desempenho no quiz.
- **Card sem nome (genérico)** — considerada, mas o ganho de engajamento de um card personalizado (primeira pessoa, "eu fiz isso") supera o risco mínimo de erro de digitação do nome, que a própria pessoa já revisou ao preencher o formulário.

**Arquivos Afetados:** `src/public/SimuladorPublico.jsx` (`formatarDuracao`, `desenharTextoComQuebra`, `desenharResumoQuiz`, componente `ResumoCompartilhavel`, cronômetro `inicioQuizRef`/`tempoQuizMs`, renderização na tela `enviado`), `tests/simulador.test.js` (cobertura E2E: canvas renderizado, fallback de download, e Web Share API mockada).

**Riscos:** Baixo — mudança puramente client-side, sem coluna nova, sem Edge Function tocada, sem persistência adicional. `navigator.share`/`canShare` com arquivos não são reproduzíveis no motor Chromium headless usado nos testes automatizados deste ambiente (comportamento verificado via mock de `navigator.share`); a confirmação do menu nativo real (WhatsApp/Instagram no iOS) depende de teste manual do responsável.

**Status:** Ativa — mergeado na `main` via PR #87 em 2026-07-21.

---

## Processo Obrigatório

Sempre que uma etapa da refatoração for concluída:

1. Atualizar `doc/architecture/historico/REFATORAÇÃO.md` (marcar etapa como concluída, registrar observações)
2. Atualizar `CLAUDE.md` (ajustar estrutura de diretórios se necessário)
3. Verificar se houve decisão arquitetural relevante
4. Caso sim, registrar no `DECISIONS.md` seguindo o template acima

Nenhuma etapa deve ser considerada concluída sem essa verificação.

---

## Recuperação de Contexto

Antes de executar qualquer alteração no projeto, uma nova sessão de IA deve:

1. Ler `SYSTEM_MAP.md` — arquitetura viva: estrutura, fluxo de dados, regras técnicas e restrições
2. Ler `CLAUDE.md` — stack, scripts, variáveis de ambiente, banco de dados
3. Ler `doc/architecture/historico/REFATORAÇÃO.md` — estado atual da refatoração, próxima etapa pendente
4. Ler `DECISIONS.md` (este arquivo) — decisões anteriores que devem ser respeitadas
5. Respeitar decisões previamente registradas
6. Não substituir decisões existentes sem criar um novo registro (`[D-NNN]`) justificando a mudança

Ao iniciar uma sessão, verificar:
- Qual é a próxima etapa da refatoração pendente?
- O estado atual do código corresponde ao que o plano indica como concluído?
- Existe alguma decisão neste documento que restringe a abordagem planejada?
