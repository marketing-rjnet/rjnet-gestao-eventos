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
- `doc/CHANGELOG.md`, `doc/architecture/DECISIONS.md`, `doc/architecture/REFATORAÇÃO.md`, `doc/architecture/SUPABASE.md`, `doc/architecture/SYSTEM_MAP.md` (movidos da raiz)
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
