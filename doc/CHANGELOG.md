# CHANGELOG — RJNet Gestão de Eventos

Histórico de mudanças relevantes. Mais recente no topo.

---

## [v3.9] — Correção do Check-in por Nome (leads não encontrados)
**Data:** 2026-06-17

**O que mudou**
- **`src/features/checkin/CheckinTab.jsx`**: ao selecionar um evento no dropdown, o componente agora chama `carregarLeadsEvento(eventoId)` antes de permitir a busca. Enquanto os leads são carregados, o select fica desabilitado e o botão exibe "Carregando leads…".

**Por que mudou**
- O `CheckinTab` pesquisava no array `leads` do contexto, que é vazio no boot — leads são carregados sob demanda por evento (D-039). A busca por nome nunca encontrava nenhum resultado, mesmo para leads confirmadamente cadastrados.

**Ações manuais necessárias**
- Nenhuma — mudança apenas em `CheckinTab.jsx`; sem alteração de schema ou migrations.

---

## [v3.8] — Envio automático de email de redefinição de senha ao trocar email de usuário
**Data:** 2026-06-17

**O que mudou**
- **`src/lib/dataService.js` (`atualizarPerfil`)**: após atualizar o email via Edge Function `atualizar-email-usuario`, dispara automaticamente `supabase.auth.resetPasswordForEmail()` para o novo endereço. O usuário recebe um link para definir sua senha antes do primeiro login com o novo email.

**Por que mudou**
- Ao substituir o email de login de um usuário pela aba Equipe, o endereço era atualizado no banco mas nenhum email era enviado, deixando o usuário sem como acessar o sistema com as novas credenciais. O caso mais comum: reutilizar um perfil genérico (`teste.vendedor`) associando-o a um usuário real.

**Ações manuais necessárias**
- Nenhuma — mudança apenas em `dataService.js`; sem alteração de schema ou migrations.

---

## [v3.7] — Separação visual de administradores e equipe de vendas na tela Equipe
**Data:** 2026-06-17

**O que mudou**
- **`src/features/team/EquipeAuthTab.jsx`**: lista única substituída por dois blocos distintos — "Administradores" (papel `marketing`) e "Equipe de Vendas" (demais papéis). A divisão é dinâmica: mudar o papel de um usuário via dropdown move o card para o bloco correto imediatamente.
- **`src/index.css`**: estilos `.equipe-section`, `.equipe-section--admin` (borda amarela) e `.equipe-section--vendas` adicionados.

**Por que mudou**
- Clareza de hierarquia de acesso: usuários com papel `marketing` têm acesso total ao sistema, enquanto vendedores têm escopo restrito à captura de leads. A distinção visual reduz risco de mudança acidental de papel.

**Ações manuais necessárias**
- Nenhuma — mudança apenas na UI; sem alteração de schema ou migrations.

---

## [v3.6] — Suspensão temporária do campo de consentimento LGPD
**Data:** 2026-06-17

**O que mudou**
- **D-043 — Campo de consentimento LGPD oculto da UI** (`src/apps/VendedorApp.jsx`): checkbox "Consentimento LGPD" removido do formulário de captura de lead e validação de bloqueio suspensa — aguardando decisão externa sobre processo/ficha de consentimento

**Por que mudou**
- As decisões externas sobre o processo de coleta de consentimento (ficha física vs. digital, fluxo de coleta) ainda não foram tomadas; expor o campo sem processo definido cria obrigações LGPD que o sistema não consegue honrar completamente

**O que NÃO mudou**
- Schema do banco intacto: `consentimento_coletado`, `consentimento_em`, `versao_termo` preservados
- Lógica de `dataService.js` preservada — reativação é só UI

**Ações manuais necessárias**
- Nenhuma — mudança apenas na UI; sem alteração de schema ou migrations

---

## [v3.5] — Correção de bug: exclusão de leads por vendedor
**Data:** 2026-06-17

**O que mudou**
- **Fix: rollback de estado local em falha de exclusão** (`src/api/leadApi.js`, `src/lib/dataService.js`): `removeLead` agora aceita callback `onFail`; se o banco rejeitar a operação, o lead é restaurado ao estado local automaticamente — evita inconsistência onde o lead sumia da UI mas permanecia no banco
- **Fix: exclusão via DELETE direto** (`src/lib/dataService.js`): `db.removeLead` migrado de `UPDATE SET deletado=true` (soft delete) para `DELETE` físico; o soft delete via UPDATE gerava "new row violates row-level security policy" no `WITH CHECK` do `leads_update` mesmo com `vendedor_id = auth.uid()` correto. A auditoria LGPD é preservada pelo trigger `audit_leads` (AFTER DELETE → `audit_log`)
- **Migration aplicada em produção:** `supabase/migracao-soft-delete-audit.sql` — colunas `deletado_em` (timestamptz) e `deletado_por` (uuid) adicionadas à tabela `leads`; cache PostgREST recarregado via `NOTIFY pgrst, 'reload schema'`
- **RLS policy recriada:** `leads_update` recriada sem condições extras para garantir estado limpo

**Por que mudou**
- Vendedores não conseguiam excluir seus próprios leads: soft delete retornava erro RLS mesmo com dados corretos
- Investigação revelou que o `WITH CHECK` do `leads_update` rejeita a transição `deletado=false → true` em contexto de vendedor, comportamento não documentado do PostgreSQL RLS

**Ações manuais necessárias**
- Migration `migracao-soft-delete-audit.sql` já aplicada em produção em 2026-06-17

---

## [v3.4] — Quick wins de performance + carregamento on-demand + melhorias de UX
**Data:** 2026-06-17

**O que mudou**
- **D-036 — QW-003: AbortSignal.timeout(15s) em `fetchAll`** (`src/context/AppProvider.jsx`): timeout automático de 15s via `AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])` — elimina loading infinito em conexões instáveis; estado `syncStatus = ERROR` exibido ao invés de spinner eterno
- **D-037 — QW-004: Column pruning no `fetchAll`** (`src/lib/dataService.js`): substituído `select('*')` por seleção explícita de colunas nas 4 queries do `fetchAll` — redução de 10–30% no payload transferido por carregamento
- **D-038 — QW-005: REALTIME_DEBOUNCE_MS 400ms → 1500ms** (`src/lib/constants.js`): debounce do canal realtime aumentado para coalescimento de bursts de captura de leads; fix secundário: `subscribeChanges` em `dataService.js` passou a usar a constante (estava hardcoded em 400ms)
- **D-039 — TB-004: Carregamento de leads on-demand por evento** (`src/lib/dataService.js`, `src/context/AppProvider.jsx`, `src/api/leadApi.js`, `src/features/events/EventDetail.jsx`, `src/apps/VendedorApp.jsx`): `fetchAll` não carrega mais leads no boot; leads carregados via `carregarLeadsEvento(eventoId)` ao abrir detalhe do evento (marketing) ou ao selecionar evento ativo (vendedor); novas funções `fetchLeadsEvento` e `fetchLeadsEventos` para exportação
- **D-040 — Filtro padrão "Ativo" no painel de eventos** (`src/features/events/EventosTab.jsx`): painel inicia com chip "Ativo" selecionado em vez de "Todos" — reduz scroll e foco imediato nos eventos em andamento
- **D-041 — Exclusão permanente de evento pelo marketing** (`src/features/events/EventDetail.jsx`): botão "Excluir Evento" adicionado no detalhe do evento, disponível apenas para marketing e apenas em eventos não-ativos; confirmação explícita obrigatória

**Por que mudou**
- Série de quick wins de performance identificados na auditoria estática (`QUICK_WINS.md`) e no backlog técnico (`TECHNICAL_BACKLOG.md`), implementados como melhorias de baixo risco e zero downtime
- Carregamento on-demand resolve o principal gargalo de escalabilidade: `fetchAll` buscava todos os leads de todos os eventos no boot, impactando tempo de carga proporcional ao histórico total

**Ações manuais necessárias**
- Nenhuma — todas as mudanças são no frontend; sem alteração de schema ou migrations

---

## [v3.3] — Encerramento da implementação técnica LGPD
**Data:** 2026-06-16

**O que mudou**
- Plano de Ação LGPD atualizado com tabela de pendências administrativas — implementação técnica declarada encerrada
- `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md`: Fase 4 atualizada com status de cada PA, artefatos criados e tabela de pendências
- 4 pendências restantes são exclusivamente administrativas/jurídicas (ver `doc/lgpd/PLANO_DE_ACAO_LGPD.md`)

**Situação final:** 16/21 ações 🟢, 3/21 🟡 (pendentes aprovação DPO), 2/21 🔴 (decisão externa)

---

## [v3.2] — Fase 4 LGPD: PA-17, PA-18, PA-20 (RIPD, ROPA, Plano de Incidentes)
**Data:** 2026-06-16

**O que mudou**
- **PA-17 — RIPD (`doc/lgpd/RIPD.md`):** Relatório de Impacto v1.0 com descrição do tratamento, avaliação de necessidade/proporcionalidade por campo, matriz de 8 riscos identificados e medidas de mitigação; pendente aprovação pelo DPO
- **PA-18 — ROPA (`doc/lgpd/ROPA.md`):** Registro de 4 operações de tratamento (captação de leads, exportação CSV, autenticação interna, auditoria); bases legais, destinatários, transferências internacionais e retenção documentados; pendente validação pelo DPO
- **PA-20 — Plano de Incidentes (`doc/lgpd/PLANO_INCIDENTES.md`):** 6 fases de resposta, classificação por severidade, queries SQL de investigação, prazos ANPD (72h), modelo de registro; pendente aprovação pelo DPO e tabletop exercise
- **PA-19 e PA-21:** mantidos como 🔴 Em aberto — dependem de decisão da diretoria/negócio

**Conformidade:** L-09, L-10, G-03 parcialmente sanados (documentos criados; aprovação DPO pendente)

---

## [v3.1] — Fase 4 LGPD: PA-16 (Política de Privacidade)
**Data:** 2026-06-16

**O que mudou**
- **PA-16 — Política de Privacidade (`doc/lgpd/POLITICA_DE_PRIVACIDADE.md`):** documento v1.0 cobrindo controlador, dados coletados, finalidades, bases legais (consentimento e legítimo interesse), compartilhamento com Supabase/Vercel, retenção, direitos dos titulares (art. 18 LGPD), medidas de segurança, transferência internacional e canal de contato
- **PA-15 — DSAR:** canal privacidade@rjnet.com.br marcado como pendente criação pela TI

**Conformidade:** G-01, L-02 sanados

---

## [v3.0] — Fase 3 LGPD: PA-10 a PA-15 (retenção, RLS, MFA, auditoria, DPA, DSAR)
**Data:** 2026-06-16

**O que mudou**
- **PA-11 — RLS vendedor (`supabase/migracao-rls-vendedor-leads.sql`):** policy `leads_select` recriada — vendedor recebe do banco apenas seus próprios leads (`vendedor_id = auth.uid()`); antes todos os leads chegavam ao dispositivo e o frontend filtrava
- **PA-10 — Retenção automática (`supabase/migracao-retencao.sql`):** pg_cron + `configuracoes_retencao` + função `limpar_leads_expirados()` com hard delete diário às 02:00 BRT; padrões: 90 dias soft delete, 365 dias evento encerrado
- **PA-13 — Audit log (`supabase/migracao-audit-log.sql`):** tabela `audit_log` + trigger `audit_leads` registra INSERT/UPDATE/DELETE em leads com dados antes/depois em JSONB
- **PA-12 — MFA TOTP (`src/auth/LoginAuth.jsx` + `src/lib/dataService.js`):** tela de código TOTP exibida automaticamente quando usuário tem MFA configurado; `auth.verifyMfa()` verifica código e estabelece sessão
- **PA-14 — DPA fornecedores (`doc/lgpd/DPA_FORNECEDORES.md`):** novo documento com Supabase Inc. e Vercel; assinatura DPA com Supabase pendente (ação jurídica)
- **PA-15 — DSAR (`doc/lgpd/ROTEIRO_DSAR.md`):** roteiro completo com queries SQL para todos os direitos do art. 18 LGPD; prazo 15 dias; canal privacidade@rjnet.com.br (a criar)

**Ações manuais necessárias**
- Executar no Supabase SQL Editor (nesta ordem): `migracao-rls-vendedor-leads.sql`, `migracao-audit-log.sql`, `migracao-retencao.sql`
- Habilitar pg_cron: Dashboard → Database → Extensions → pg_cron
- Habilitar MFA TOTP: Dashboard → Authentication → Multi-Factor Auth
- Assinar DPA Supabase: https://supabase.com/privacy
- Criar canal privacidade@rjnet.com.br

**Conformidade**
- Fase 3 em progresso (5/6): PA-14 pendente assinatura DPA (ação jurídica)

---

## [v2.5] — PA-08b: Reintrodução do CPF opcional com finalidade declarada
**Data:** 2026-06-16

**O que mudou**
- **Banco (`supabase/migracao-readd-cpf.sql`):** `ADD COLUMN IF NOT EXISTS cpf text` — coluna reintroduzida como opcional (nullable)
- **Camada de dados (`src/lib/dataService.js`):** `leadFromDb` e `leadToDb` com campo `cpf` de volta
- **Formulário vendedor (`src/apps/VendedorApp.jsx`):** campo CPF opcional reintroduzido no formulário de captura (modo normal) e edição inline, com label explicando a finalidade: *"opcional — para visita técnica e contrato"*; exibido na lista de leads apenas quando preenchido
- **Exportação CSV (`src/utils/csv.js`):** coluna CPF de volta no arquivo exportado para a equipe técnica

**Por que mudou**
- CPF é necessário para o fluxo de negócio (agendamento de visita técnica e assinatura de contrato). A NC original (L-03) era sobre coleta sem finalidade declarada — resolvida com a label de finalidade no campo. Check-in permanece por nome (sem uso de CPF), eliminando o conflito original.

**Aplicado em produção**
- `supabase/migracao-readd-cpf.sql` executado em 2026-06-16 — "Success. No rows returned" ✅

---

## [v2.4] — PA-08: Remoção do CPF + check-in por nome (BD-02, L-03)
**Data:** 2026-06-16

**O que mudou**
- **Banco (`supabase/migracao-remove-cpf.sql`):** `DROP COLUMN IF EXISTS cpf` — CPF removido definitivamente da tabela `leads`
- **Camada de dados (`src/lib/dataService.js`):** `leadFromDb` e `leadToDb` sem campo `cpf`
- **Check-in (`src/features/checkin/CheckinTab.jsx`):** reescrito — busca por **nome** (substring, case-insensitive) dentro do evento selecionado; mostra lista de múltiplos resultados quando necessário; título atualizado para "Check-in por Nome"
- **Formulário vendedor (`src/apps/VendedorApp.jsx`):** campo CPF removido do formulário de captura, edição inline e lista de leads; `FORM_VAZIO` sem `cpf`; import `maskCpf` removido
- **Exportação CSV (`src/utils/csv.js`):** coluna CPF removida do arquivo exportado

**Por que mudou**
- PA-08 do Plano de Ação LGPD (NC BD-02, L-03): CPF em texto plano com alto potencial de dano em caso de vazamento — solução escolhida: minimização de dados (Opção A), CPF não coletado nem armazenado; check-in migrado para nome, que é suficiente com o filtro por evento

**Ação manual necessária**
- Executar `supabase/migracao-remove-cpf.sql` no Supabase Dashboard → SQL Editor

**Conformidade**
- NC BD-02 e L-03 sanadas pela raiz — dado não coletado elimina risco de vazamento
- Decisão D-035 registrada em `doc/architecture/DECISIONS.md`
- **Fase 2 completa** (6/6 ações: PA-04, PA-05, PA-06, PA-07, PA-08, PA-09)

---

## [v2.3] — PA-07: Rastreabilidade do soft delete de leads (BD-06, A-03)
**Data:** 2026-06-16

**O que mudou**
- **Banco (`supabase/migracao-soft-delete-audit.sql`):** 2 novas colunas em `leads`:
  - `deletado_em timestamptz` — timestamp da exclusão lógica
  - `deletado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL` — quem excluiu
  - Índices parciais (`WHERE deletado = true`) para eficiência em consultas de auditoria
- **Camada de dados (`src/lib/dataService.js`):** `db.removeLead()` atualizado para gravar `deletado_em` e `deletado_por` automaticamente — reutiliza `_queueUserId` já presente em memória (PA-05), sem mudança na assinatura pública da função

**Por que mudou**
- PA-07 do Plano de Ação LGPD (NC BD-06, A-03): exclusões de dados pessoais sem rastreabilidade — impossibilidade de auditar quem excluiu e quando, violando o princípio de responsabilização LGPD

**Aplicado em produção**
- `supabase/migracao-soft-delete-audit.sql` executado em 2026-06-16 — "Success. No rows returned" ✅

**Conformidade**
- NC BD-06 e A-03 sanadas — toda exclusão de lead passa a registrar responsável e timestamp no banco

---

## [v2.2] — PA-06: Log de exportações CSV (A-01, L-08)
**Data:** 2026-06-16

**O que mudou**
- **Banco (`supabase/migracao-audit-exportacoes.sql`):** nova tabela `audit_exportacoes` com RLS — colunas: `usuario_id`, `usuario_nome`, `usuario_email`, `acao`, `filtros` (jsonb), `total_registros`, `exportado_em`; policies `INSERT`/`SELECT` restritas a papel `marketing`; índices por usuário e data
- **Camada de dados (`src/lib/dataService.js`):** `db.registrarExportacao()` — fire-and-forget, nunca bloqueia o download; falha com `console.warn` sem propagar ao usuário
- **Exportação (`src/utils/csv.js`):** parâmetro `onAudit` opcional adicionado; callback invocado após download com `{ totalRegistros }`
- **Aba Leads (`src/features/leads/LeadsTab.jsx`):** recebe `session` via prop; passa callback de auditoria com usuário e filtros ativos para `exportLeadsCSV`
- **Shell marketing (`src/apps/MarketingApp.jsx`):** `<LeadsTab session={session} />` — prop `session` propagada

**Por que mudou**
- PA-06 do Plano de Ação LGPD (NC A-01, L-08): exportações de dados pessoais sem rastreabilidade — impossibilidade de auditar quem baixou o quê e quando

**Aplicado em produção**
- `supabase/migracao-audit-exportacoes.sql` executado em 2026-06-16 — "Success. No rows returned" ✅

**Conformidade**
- NC A-01 e L-08 sanadas — todas as exportações CSV passam a ser registradas com usuário, filtros e total de registros

---

## [v2.1] — PA-05: Criptografia da fila offline no localStorage (S-02)
**Data:** 2026-06-16

**O que mudou**
- **Novo módulo (`src/lib/crypto.js`):** utilitário de criptografia usando Web Crypto API nativa do browser (sem dependências externas)
  - Derivação de chave via PBKDF2-SHA256 (100.000 iterações, salt fixo por versão `rjnet-lgpd-queue-v1`)
  - Algoritmo AES-GCM 256 bits (autenticado — detecta adulteração/corrupção)
  - Chave cacheada em memória (Map); nunca escrita em disco; descartada no logout
  - Fallback gracioso: se `crypto.subtle` não disponível, fila volta a texto plano sem quebrar o app
- **Camada de dados (`src/lib/dataService.js`):**
  - `getQueue()` e `saveQueue()` tornadas assíncronas; criptografam/descriptografam usando `_queueUserId`
  - `addToQueue()` e `flushPendingQueue()` atualizados para `await` nas novas funções assíncronas
  - Exporta `setQueueUserId(userId)` e `clearQueueSession(userId)` para gerenciamento do ciclo de vida da chave
- **Auth (`src/auth/RootAuth.jsx`):** integrado ao ciclo de login/logout — `setQueueUserId` ao iniciar sessão, `clearQueueSession` ao sair

**Por que mudou**
- PA-05 do Plano de Ação LGPD (NC S-02): dados pessoais (CPF, telefone) em texto plano no localStorage expõem titulares em caso de acesso físico ao dispositivo do vendedor

**Conformidade**
- NC S-02 sanada — fila offline criptografada com AES-GCM 256; chave inacessível após logout
- Decisão D-034 registrada em `doc/architecture/DECISIONS.md`

---

## [v2.0] — PA-04: Consentimento LGPD no formulário de captação de leads (L-01, L-02, L-03)
**Data:** 2026-06-16

**O que mudou**
- **Banco (`supabase/migracao-consentimento.sql`):** 3 novas colunas em `leads`:
  - `consentimento_coletado boolean NOT NULL DEFAULT false`
  - `consentimento_em timestamptz`
  - `versao_termo text`
  - Índice `idx_leads_consentimento` para consultas de auditoria
- **Camada de dados (`src/lib/dataService.js`):** `leadFromDb` expõe `consentimentoColetado`, `consentimentoEm`, `versaoTermo`; `leadToDb` persiste os campos automaticamente com `versao_termo = 'v1.0'` quando consentimento marcado
- **Formulário vendedor (`src/apps/VendedorApp.jsx`):** checkbox obrigatório "Consentimento LGPD" adicionado antes do botão de submit; validação bloqueia envio se não marcado; `FORM_VAZIO` inicializa com `consentimentoColetado: false`

**Por que mudou**
- PA-04 do Plano de Ação LGPD (NC L-01, L-02, L-03): dados pessoais coletados em eventos sem consentimento documentado do titular — base legal exigida pelo art. 7º, I da LGPD

**Ação manual necessária**
- Executar `supabase/migracao-consentimento.sql` no Supabase Dashboard → SQL Editor

**Conformidade**
- NC L-01 e L-02 sanadas — consentimento coletado e registrado digitalmente
- Decisão D-033 registrada em `doc/architecture/DECISIONS.md`
- Fase 2 iniciada

---

## [v1.9] — PA-03 + PA-09: CORS restrito e stack trace removido da Edge Function (S-04, S-05)
**Data:** 2026-06-16

**O que mudou**
- **Segurança (`supabase/functions/atualizar-email-usuario/index.ts`):**
  - Removido `corsHeaders` global constante com `Access-Control-Allow-Origin: *`
  - Adicionada função `getCorsHeaders(req)` que lê origens permitidas do secret `CORS_ALLOWED_ORIGINS` e reflete a origem do solicitante somente se estiver na lista; nunca retorna `*`
  - Fallback em desenvolvimento: `http://localhost:3000`
  - Catch final corrigido: `console.error('[rjnet:edge] ...')` internamente; resposta 500 retorna mensagem genérica sem detalhes do erro (S-05 corrigido)
  - `json()` refatorado para receber `headers` como parâmetro explícito

**Por que mudou**
- PA-03 do Plano de Ação LGPD (NC S-04): CORS aberto permite que qualquer origem invoque operações administrativas de usuários
- PA-09/S-05 resolvido junto: `String(err)` no bloco catch expunha detalhes internos ao cliente

**Ação manual necessária**
- Configurar secret `CORS_ALLOWED_ORIGINS` no Supabase Dashboard (Settings → Edge Functions → Secrets) com o domínio de produção: `https://SEU_DOMINIO.vercel.app,http://localhost:3000`
- Fazer deploy: `supabase functions deploy atualizar-email-usuario`

**Conformidade**
- NC S-04 sanada; NC S-05 antecipada e sanada — ver `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` seção 12.2 e 12.6
- **Fase 1 do Plano LGPD completa (PA-01, PA-02, PA-03 ✅)**

---

## [v1.8] — PA-02: Script de verificação de migrações de Auth
**Data:** 2026-06-16

**O que mudou**
- **Novo arquivo (`supabase/verificar-migracao-auth.sql`):** script SQL com 8 blocos de verificação idempotentes para confirmar o estado das migrações `migracao-auth.sql` e `protecao-dados.sql` em produção; inclui resultado esperado anotado e instruções de remediação
- **Documentação (`doc/architecture/SUPABASE.md`):** nova seção "Verificação de estado das migrações (PA-02)" com tabela de resultados esperados; tabela de migrações atualizada com o script de verificação; checklist de segurança pré-produção atualizado

**Por que mudou**
- PA-02 do Plano de Ação LGPD (NC BD-01, SB-01): policies anônimas do `schema.sql` expõem todos os dados se `migracao-auth.sql` não estiver aplicada em produção; a ação requer verificação operacional documentada

**Impacto**
- Nenhuma alteração de código de produção — apenas artefatos de verificação e documentação
- Operador deve executar `supabase/verificar-migracao-auth.sql` no Supabase Dashboard e confirmar 0 policies anônimas

**Conformidade**
- NC BD-01 e SB-01 documentadas e com procedimento de verificação — ver `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` seção 12.2 e 12.6

---

## [v1.7] — PA-01: Remoção de credenciais legadas do bundle JS (D-032)
**Data:** 2026-06-16

**O que mudou**
- **Segurança (`vite.config.js`):** adicionado plugin `lgpdCredentialGuard` — aborta o build com `NODE_ENV=production` se `VITE_MARKETING_PASS` estiver definida; emite `console.warn` em desenvolvimento
- **Segurança (`src/auth/Login.jsx`):** removido objeto `AUTH` exportado com credenciais em escopo de módulo; adicionado guard de runtime com `import.meta.env.PROD`; comparação de credenciais movida para dentro do handler `submit()` sem criar variáveis de módulo exportadas
- **Segurança (`src/auth/index.js`):** removido re-export de `AUTH` — elimina superfície de exposição desnecessária
- **Documentação (`.env.example`):** adicionado aviso explícito de que `VITE_MARKETING_PASS` é exclusivamente para desenvolvimento local; nunca deve ser definida em Vercel ou CI

**Por que mudou**
- PA-01 do Plano de Ação LGPD (NC S-01): `VITE_MARKETING_PASS` era lida em escopo de módulo em `Login.jsx`, sendo incorporada literalmente no bundle JavaScript público pelo Vite em tempo de build — exposição de credencial crítica

**Impacto**
- Builds de produção com `VITE_MARKETING_PASS` definida são bloqueados automaticamente
- Modo legado (local/demo) continua funcional em desenvolvimento — sem regressão
- `AUTH` não é mais exportado; nenhum código interno o usava fora do próprio `Login.jsx`

**Conformidade**
- NC S-01 sanada — ver `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` seção 12.2 e 12.6
- Decisão D-032 registrada em `doc/architecture/DECISIONS.md`

---

## [v1.6] — Auditoria e plano de conformidade LGPD (D-031)
**Data:** 2026-06-16

**O que mudou**
- **Docs:** criado `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` — auditoria completa de LGPD, segurança, governança e Supabase (1.200+ linhas, 11 seções + seção de fases de implementação)
- **Docs:** criado `doc/lgpd/PLANO_DE_ACAO_LGPD.md` — plano de ação executável com 21 ações organizadas em 4 fases, com responsáveis, prazos, queries SQL prontas e checklists de evidência
- **Docs:** `CLAUDE.md` atualizado — tabela de referência agora inclui os dois novos documentos de conformidade
- **Docs:** `doc/architecture/DECISIONS.md` atualizado — registrada decisão D-031 sobre a auditoria

**Principais não conformidades documentadas**
- Ausência total de consentimento LGPD para leads captados em eventos (CRÍTICO)
- Senha de marketing exposta no bundle JavaScript público (CRÍTICO)
- Policies anônimas no `schema.sql` sem garantia de migração aplicada (CRÍTICO)
- CORS aberto na Edge Function administrativa (ALTO)
- Sem log de exportações CSV com dados pessoais (ALTO)
- CPF em texto plano sem criptografia (ALTO)
- Sem política de retenção de dados (ALTO)

**Nota de conformidade obtida:** 4,2 / 10 (meta: 8,7 após Fase 4)

**Impacto**
- Nenhum código de produção alterado nesta versão — apenas documentação
- Base documental criada para execução do plano de conformidade

---

## [v1.5] — Correções arquiteturais pós-auditoria (D-030)
**Data:** 2026-06-16

**O que mudou**
- **C-1 (segurança):** `salvarEdicao` em `VendedorApp.jsx` agora sanitiza `nome`, `cpf`, `endereco` e `observacao` via `sanitizeText()` antes de chamar `updateLead` — eliminando vetor de XSS armazenado no fluxo de edição de lead
- **C-6 (documentação):** `doc/architecture/SYSTEM_MAP.md` corrigido — seção "Detecção de Modo" agora descreve corretamente que `src/lib/mode.js` existe e que `isSupabaseMode()` é a abstração obrigatória
- **C-5 (refatoração):** `genId` extraído do `AppProvider` para `src/utils/ids.js`; as 4 factories de API importam diretamente de `utils/ids` e deixam de receber `genId` como parâmetro
- **C-3 (refatoração):** `obterRanking` movida do `AppProvider` para `createLeadApi` em `src/api/leadApi.js`; o Provider apenas desestrutura e expõe via contexto
- **C-4 (refatoração):** `createLeadApi.addLead` retorna o objeto criado com o ID canônico; `VendedorApp.submit` removeu a pré-geração local de ID e usa o retorno da factory
- **C-2 (arquitetural):** novo `src/api/equipeApi.js` com `createEquipeApi` expondo `criarUsuario`, `atualizarPerfil` e `excluirUsuario`; `EquipeAuthTab` removeu import direto de `dataService` e consome via `useApp()`

**Por que mudou**
- Auditoria pós-refatoração identificou 6 desvios remanescentes, documentados em `doc/architecture/ARCHITECTURE_FIX_PLAN.md`

**Impacto**
- Nenhum componente de feature (`src/features/`) ou app (`src/apps/`) acessa `src/lib/dataService` diretamente
- Todos os caminhos de escrita de lead (criação e edição) aplicam sanitização
- `AppProvider` é orquestrador puro sem lógica de domínio

---

## [v1.4] — Sim/Não para "já é cliente" e exclusão de lead pelo vendedor
**Data:** 2026-06-16

**O que mudou**
- Campo "Já é cliente RJNet?" migrado de checkbox para controle segmentado **Não / Sim** em `VendedorApp.jsx` — tanto no formulário de novo lead quanto no `LeadEditInline`
- Botão **"Excluir lead"** adicionado em cada card na aba "Meus Leads", com confirmação inline em dois passos para evitar exclusões acidentais
- Novos estilos `.lm-del-btn`, `.lm-del-confirm`, `.lm-del-confirm-yes`, `.lm-del-confirm-no` adicionados a `index.css`

**Por que mudou**
- Checkbox binário não deixava claro qual era o estado padrão ("desmarcado" pode ser confundido com "não respondido")
- Vendedores precisavam de uma forma de corrigir leads cadastrados por engano sem depender do marketing

**Impacto**
- UX mais clara para o campo "já é cliente": o estado sempre é explícito (Não ou Sim)
- Vendedor pode excluir próprios leads; a exclusão usa o soft delete já existente (`deletado = true` no banco)

---

## [v1.3] — Organização da documentação em `doc/`
**Data:** 2026-06-16

**O que mudou**
- Diretório `doc/` criado; `CHANGELOG.md`, `DECISIONS.md`, `REFATORAÇÃO.md`, `SUPABASE.md` e `SYSTEM_MAP.md` movidos para ele
- `CLAUDE.md` permanece na raiz (convenção Claude Code)
- `@doc/architecture/SYSTEM_MAP.md` adicionado ao `CLAUDE.md` — garante carregamento automático da arquitetura viva a cada sessão
- Tabela de Documentação de Referência no `CLAUDE.md` atualizada com novos caminhos e coluna "Quando ler"
- Decisão [D-028] registrada em `doc/architecture/DECISIONS.md`

**Por que mudou**
- Raiz com 6 `.md` soltos dificultava distinguir código de documentação
- `@import` do `SYSTEM_MAP.md` garante contexto arquitetural completo em toda sessão sem depender de decisão do Claude

**Impacto**
- Sem impacto funcional no app
- Novas docs especializadas entram em `doc/` sem poluir a raiz
- Arquitetura viva carregada automaticamente a cada sessão Claude

---

## [v1.2] — Multi-seleção de serviços e meta em 3 níveis
**Data:** 2026-06-16

**O que mudou**
- `servicoInteresse` agora suporta múltiplos valores (array) por lead; seleção de serviços no formulário do vendedor é multi-select (toggle de botões independentes)
- `servicoLabel()` em `format.js` atualizado para formatar arrays como lista separada por vírgula
- Backward-compatible: dados legados (string simples no banco) são automaticamente normalizados para array na leitura (`leadFromDb`); escrita sempre serializa JSON string
- Filtros de serviço em `LeadsTab` e contagem no gráfico de `Dashboard` tratam tanto array quanto string legada
- Meta diária única substituída por 3 níveis progressivos: 🥉 Bronze (20) / 🥈 Prata (40) / 🥇 Ouro (60)
- Barra de progresso exibe 3 marcadores com cores distintas por nível atingido (amarelo → bronze → prata → verde)
- Ranking da equipe (Placar) exibe medalha ao lado do total de cada vendedor
- `META_BRONZE`, `META_PRATA`, `META_OURO` adicionados a `constants.js`; `META_DIARIA` mantido como alias de `META_OURO` para backward-compat

**Por que mudou**
- Vendedores precisavam registrar interesse em mais de um serviço por lead (ex: Internet + RJNET Móvel)
- Meta única (15 leads) não refletia progressão real; 3 níveis dão motivação contínua ao longo do evento

**Impacto**
- Leads podem ter múltiplos serviços de interesse registrados
- Filtros e gráficos do marketing tratam os arrays corretamente
- Dados existentes continuam funcionando sem migração de banco

---

## [v1.1] — Refatoração: etapa 18 — centralização do dual mode
**Data:** 2026-06-16

**O que mudou**
- Criado `src/lib/mode.js` com `isSupabaseMode()`, `getMode()` e constante `MODE`
- `AppProvider.jsx`, `Root.jsx`, `MarketingApp.jsx`, `SyncBadge.jsx` e `dataService.js` migrados para importar de `mode.js`
- Nenhum arquivo fora de `supabase.js` e `mode.js` acessa `supabaseEnabled` ou `VITE_SUPABASE_URL` diretamente

**Por que mudou**
- A verificação de modo (Supabase vs local) estava duplicada em 5 arquivos
- Qualquer mudança na lógica de detecção exigia editar múltiplos pontos

**Impacto**
- Detecção de modo centralizada em único lugar — mudar a lógica é editar apenas `mode.js`
- Refatoração de 18 etapas concluída 100%
- Build sem erros — nenhum comportamento alterado

---

## [v1.0] — Refatoração: modularização completa (etapas 1–17)
**Data:** 2026-06-15 / 2026-06-16

**O que mudou**
- `src/main.jsx` reduzido de ~2.354 linhas para ~35 linhas
- Código extraído para 25+ módulos em `src/utils/`, `src/lib/`, `src/components/`, `src/features/`, `src/auth/`, `src/hooks/`, `src/api/`, `src/context/`, `src/apps/`
- Etapa 1: `format.js` — formatação de datas e labels
- Etapa 2: `masks.js` — máscaras e validadores CPF/telefone
- Etapa 3: `csv.js` — exportação CSV de leads
- Etapa 4: `mockData.js` — dados mock para modo local
- Etapa 5: `constants.js` — centralização de magic strings/numbers
- Etapa 6: `ui.jsx` — componentes atômicos (Icon, StatusBadge, Kpi, ChartView…)
- Etapa 7: `useApp.js` + `SyncBadge.jsx`
- Etapa 8: módulo `src/auth/` (Login, LoginAuth, NovaSenha, RootAuth, RootLegacy)
- Etapa 9: módulo `src/components/modals/` (EventModal, MaterialModal)
- Etapa 10: módulo `src/features/events/` (Dashboard, EventosTab, EventDetail)
- Etapa 11: módulo `src/features/` (EstoqueTab, LeadsTab, CheckinTab)
- Etapa 12: módulo `src/features/team/` (EquipeTab, EquipeAuthTab)
- Etapa 13: `VendedorApp.jsx` extraído para `src/apps/`
- Etapa 14: `MarketingApp.jsx` + `Root.jsx` extraídos para `src/apps/`
- Etapa 15: `usePersisted.js` + `useRanking.js` extraídos para `src/hooks/`
- Etapa 16: `AppContext.js` + `AppProvider.jsx` extraídos para `src/context/`
- Etapa 17: factories de API (`eventoApi`, `leadApi`, `materialApi`, `vendedorApi`) extraídas para `src/api/`

**Por que mudou**
- `main.jsx` com +2.300 linhas tornava qualquer edição arriscada e lenta
- Sem estrutura de pastas, era impossível localizar código ou dividir trabalho

**Impacto**
- Manutenção drasticamente mais simples — cada módulo tem responsabilidade única
- Nenhum comportamento alterado, zero risco funcional
- Base pronta para crescimento sem acúmulo em um arquivo único

---

## [v0.8] — Simplificação de papéis: remove papel comercial
**Data:** 2026-06-12

**O que mudou**
- Papel `comercial` removido do sistema
- Sistema unificado em apenas dois papéis: `marketing` e `vendedor`

**Por que mudou**
- O papel comercial estava sobreposto ao marketing sem distinção real
- Gerava confusão nas RLS policies e no roteamento de auth

**Impacto**
- Modelo de permissões mais simples e claro
- RLS policies com menos casos de borda

---

## [v0.7] — Sync offline de leads + logo RJNet
**Data:** 2026-06-09

**O que mudou**
- Fila persistente de sync offline para leads capturados sem internet
- Logo SVG da RJNet adicionado ao app

**Por que mudou**
- Eventos ocorrem em locais com sinal instável; leads eram perdidos ao fechar o app
- Identidade visual da empresa ausente

**Impacto**
- Leads capturados offline são sincronizados automaticamente ao voltar online
- App representa a marca corretamente em campo

---

## [v0.6] — Migração de Babel/CDN para Vite
**Data:** 2026-06-09

**O que mudou**
- Build migrado de Babel (CDN) para Vite
- CSP ajustada para remover `unsafe-eval` (não mais necessário com Vite)

**Por que mudou**
- App exibia tela preta no Vercel com Babel/CDN
- CSP bloqueava carregamento em alguns browsers

**Impacto**
- Deploy estável no Vercel
- Build mais rápido e bundle otimizado
- Sem dependência de CDN externo para funcionar

---

## [v0.5] — Check-in por CPF, exportação CSV e exclusão de evento
**Data:** 2026-06-09

**O que mudou**
- Check-in de lead por CPF em evento ativo
- Exportação de leads em CSV por evento
- Exclusão de evento pelo marketing
- Persistência de estado entre sessões (localStorage)
- CPF adicionado ao formulário de lead e aos cadastros de vendedor

**Por que mudou**
- Marketing precisava controlar presença em eventos sem depender de planilha externa
- Leads acumulados no app sem forma de exportar para CRM/planilha
- Estado do app se perdia ao recarregar a página

**Impacto**
- Fluxo de evento completo: criar → capturar leads → fazer check-in → exportar
- Vendedores identificados por CPF para evitar duplicatas

---

## [v0.4] — Melhorias de usabilidade do vendedor
**Data:** 2026-06-09

**O que mudou**
- Campo de temperatura do lead (frio / morno / quente / convertido)
- Meta diária de leads com indicador visual de progresso
- Modo rápido de cadastro de lead (formulário reduzido)
- Campo "já é cliente RJNet" no formulário
- Serviços de interesse atualizados na tela comercial

**Por que mudou**
- Vendedores em campo precisam cadastrar leads rápido, sem campos desnecessários
- Marketing precisava de qualificação básica do lead já na captura

**Impacto**
- Tempo de cadastro de lead reduzido
- Lead chega ao CRM com temperatura e flag de cliente existente

---

## [v0.3] — Gestão de materiais e ajustes de layout
**Data:** 2026-06-09

**O que mudou**
- Controle completo de materiais por evento (alocar, devolver, rastrear estoque)
- Eventos listados primeiro no dashboard, indicadores abaixo
- Botão Sair alinhado à direita do header
- Ícones SVG geométricos substituindo emojis

**Por que mudou**
- Marketing não conseguia rastrear quais materiais estavam em cada evento
- Layout inicial priorizava KPIs mas o foco real é a lista de eventos

**Impacto**
- Estoque de materiais controlado por evento, com alertas de nível baixo
- Interface mais limpa e profissional sem emojis

---

## [v0.2] — Identidade visual, segurança e responsividade
**Data:** 2026-06-09

**O que mudou**
- Redesign completo: tema escuro com preto e amarelo
- Gráficos Chart.js (leads por serviço, distribuição de eventos)
- Layout mobile responsivo
- Toggle dark/light mode
- Sanitização de inputs e headers CSP no Vercel
- Testes E2E com Playwright + testes unitários

**Por que mudou**
- Protótipo inicial sem identidade visual definida
- Sem proteção contra XSS ou injeção nos campos de formulário
- App inutilizável em smartphones usados pelos vendedores em campo

**Impacto**
- App usável em campo (mobile)
- Dados de lead protegidos contra inputs maliciosos
- Base de testes para prevenir regressões

---

## [v0.1] — Lançamento inicial
**Data:** 2026-06-05

**O que mudou**
- Upload inicial do projeto
- Correção do 404 no Vercel (faltava `index.html` na raiz)

**Por que mudou**
- Primeiro deploy do sistema

**Impacto**
- App acessível via Vercel pela primeira vez
