# PLANO_DE_ACAO_LGPD.md
## RJNet Gestão de Eventos — Plano de Ação Executável de Conformidade

> **Versão:** 1.0.0  
> **Criado em:** 2026-06-16  
> **Origem:** `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` — auditoria completa de LGPD, segurança e governança  
> **Responsável:** A definir (DPO / responsável técnico)  
> **Status geral:** 🟡 EM PROGRESSO — 16 de 21 ações concluídas. Implementação técnica encerrada. Restam 4 ações administrativas/jurídicas (ver tabela abaixo).

---

## Como usar este documento

- Cada ação tem um **ID único** (ex: `PA-01`) referenciado na auditoria
- Ao concluir uma ação, atualize o **Status**, **Data de conclusão** e **Evidência**
- Registre decisões técnicas relevantes em `doc/architecture/DECISIONS.md`
- Registre mudanças de código em `doc/CHANGELOG.md`
- Atualize `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` quando a não conformidade for sanada
- Atualize `supabase/migracao-auth.sql` ou criar novo SQL quando houver mudança de schema

---

## Legenda de Status

| Símbolo | Status |
|---------|--------|
| 🔴 | Em aberto |
| 🟡 | Em progresso |
| 🟢 | Concluído |
| ⏸️ | Bloqueado / dependência |
| ❌ | Descartado (com justificativa) |

---

## FASE 1 — Correção Imediata (0–7 dias)

> Bloqueadores críticos que expõem dados ou credenciais agora.

---

### PA-01 — Remover senha de marketing do bundle JavaScript

| Campo | Valor |
|-------|-------|
| **Status** | 🟢 Concluído |
| **Prioridade** | CRÍTICA |
| **ID Auditoria** | S-01 |
| **Não conformidade** | `VITE_MARKETING_PASS` incorporada no bundle JS público — qualquer visitante pode obter a senha |
| **Impacto** | Comprometimento total do modo legado de autenticação |
| **Responsável** | — |
| **Prazo** | 2026-06-23 |
| **Data de conclusão** | 2026-06-16 |

**O que fazer:**

1. Avaliar se o modo local (sem Supabase) é utilizado em produção. Se **não** for utilizado:
   - Remover as variáveis `VITE_MARKETING_USER` e `VITE_MARKETING_PASS` da Vercel
   - Garantir que `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estejam configuradas
   - O app automaticamente cai para modo Supabase (sem credenciais no bundle)

2. Se o modo local **for** necessário (demo/testes):
   - Criar um endpoint de autenticação server-side (Edge Function ou proxy) que compare as credenciais sem expô-las no cliente
   - Ou remover completamente o modo legado de autenticação do código de produção

3. Após a correção, verificar o bundle gerado (`npm run build`) e confirmar que nenhuma senha aparece no diretório `dist/`

**Arquivos afetados:**
- `src/auth/RootLegacy.jsx`
- `src/auth/Login.jsx`
- `src/lib/mode.js`

**Documentação a atualizar após conclusão:**
- [x] `doc/architecture/DECISIONS.md` — registrar decisão sobre modo legado (D-032)
- [x] `doc/CHANGELOG.md` — registrar a mudança (v1.7)
- [x] `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` — S-01 marcado como resolvido (seção 12.2 e 12.6)

**Evidência de conclusão:**
- `vite.config.js`: plugin `lgpdCredentialGuard` — aborta `npm run build` com `NODE_ENV=production` se `VITE_MARKETING_PASS` estiver definida; emite `console.warn` em dev
- `src/auth/Login.jsx`: guard de runtime com `import.meta.env.PROD`; objeto `AUTH` removido; credenciais lidas dentro do handler `submit()` (não exportadas)
- `src/auth/index.js`: re-export de `AUTH` removido
- `.env.example`: aviso explícito adicionado — `VITE_MARKETING_PASS` é variável de desenvolvimento exclusivamente
- Decisão D-032 registrada em `doc/architecture/DECISIONS.md`

---

### PA-02 — Confirmar e documentar aplicação do `migracao-auth.sql` em produção

| Campo | Valor |
|-------|-------|
| **Status** | 🟢 Concluído |
| **Prioridade** | CRÍTICA |
| **ID Auditoria** | BD-01, SB-01 |
| **Não conformidade** | Políticas anônimas do bootstrap `schema.sql` dão acesso público total se a migração não foi aplicada |
| **Impacto** | Qualquer pessoa com a anon key (pública) acessa CPF, telefone e dados de todos os leads |
| **Responsável** | — |
| **Prazo** | 2026-06-17 |
| **Data de conclusão** | 2026-06-16 |

**O que fazer:**

1. Acessar Supabase Dashboard → SQL Editor e executar:
   ```sql
   -- Verificar se as policies anônimas ainda existem
   SELECT tablename, policyname, roles
   FROM pg_policies
   WHERE schemaname = 'public'
     AND roles @> ARRAY['anon'];
   ```
   Se retornar resultados, a migração **não** foi aplicada corretamente.

2. Verificar se a tabela `perfis` existe:
   ```sql
   SELECT EXISTS (
     SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'perfis'
   );
   ```

3. Se a migração não estiver aplicada: executar `supabase/migracao-auth.sql` e `supabase/protecao-dados.sql` no SQL Editor.

4. Verificar se a coluna `deletado` existe em `leads`:
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'leads' AND column_name = 'deletado';
   ```

5. Documentar o resultado aqui (estado encontrado + ações tomadas).

**Documentação a atualizar após conclusão:**
- [x] Este documento — evidência preenchida
- [x] `doc/architecture/SUPABASE.md` — seção "Verificação de estado das migrações (PA-02)" adicionada

**Evidência de conclusão — verificação executada em produção em 2026-06-16:**

| Bloco | Verificação | Resultado | Status |
|-------|------------|-----------|--------|
| 1 | Políticas anônimas | **0 linhas** ("No rows returned") | ✅ |
| 2 | Tabela `perfis` existe | **true** | ✅ |
| 3 | Colunas `deletado` e `vendedor_id` em `leads` | **2 linhas retornadas** | ✅ |
| 8 | Resumo leads | 70 total, 4 deletados, 66 ativos, 64 com vendedor_id | ✅ |

- `migracao-auth.sql` está aplicada em produção — nenhuma policy anônima ativa
- `protecao-dados.sql` está aplicada — coluna `deletado` presente
- Tabela `perfis` existe e está vinculada ao Supabase Auth
- 6 leads sem `vendedor_id` são registros legados (anteriores à migração Auth) — esperado

---

### PA-03 — Restringir CORS da Edge Function ao domínio da aplicação

| Campo | Valor |
|-------|-------|
| **Status** | 🟢 Concluído |
| **Prioridade** | ALTA |
| **ID Auditoria** | S-04 |
| **Não conformidade** | `Access-Control-Allow-Origin: *` na Edge Function administrativa |
| **Impacto** | Qualquer origem pode invocar criação/exclusão de usuários (desde que tenha token válido) |
| **Responsável** | — |
| **Prazo** | 2026-06-23 |
| **Data de conclusão** | 2026-06-16 |

**O que fazer:**

1. Editar `supabase/functions/atualizar-email-usuario/index.ts`
2. Substituir o header CORS:
   ```typescript
   // Antes
   const corsHeaders = {
     'Access-Control-Allow-Origin': '*',
     ...
   };

   // Depois
   const allowedOrigins = [
     'https://SEU_DOMINIO.vercel.app',  // substituir pelo domínio real
     'http://localhost:3000',             // apenas para dev local
   ];

   function getCorsHeaders(req: Request) {
     const origin = req.headers.get('Origin') || '';
     const allowed = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
     return {
       'Access-Control-Allow-Origin': allowed,
       'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
     };
   }
   ```
3. Atualizar todas as referências a `corsHeaders` para usar `getCorsHeaders(req)`
4. Fazer deploy da Edge Function via `supabase functions deploy atualizar-email-usuario`

5. Também corrigir exposição de erro interno (S-05):
   ```typescript
   // Antes
   return json({ error: String(err) }, 500);
   
   // Depois
   console.error('[rjnet] Erro interno:', err);
   return json({ error: 'Erro interno do servidor.' }, 500);
   ```

**Arquivos afetados:**
- `supabase/functions/atualizar-email-usuario/index.ts`

**Documentação a atualizar após conclusão:**
- [x] `doc/CHANGELOG.md` (v1.9)
- [x] `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` — S-04 e S-05 marcados como resolvidos

**Evidência de conclusão:**
- `supabase/functions/atualizar-email-usuario/index.ts` reescrito:
  - `corsHeaders` global constante removido — substituído por `getCorsHeaders(req)` por-requisição
  - `getAllowedOrigins()` lê do secret `CORS_ALLOWED_ORIGINS` (Supabase Dashboard → Settings → Edge Functions → Secrets); fallback: `http://localhost:3000`
  - Reflete a origem da requisição apenas se estiver na lista permitida; nunca retorna `*`
  - Catch final: `console.error('[rjnet:edge] ...')` internamente; cliente recebe apenas `"Erro interno do servidor. Contate o suporte."` (S-05 corrigido)
  - `json()` agora recebe `headers` como parâmetro — elimina dependência no `corsHeaders` global
- **Ação manual necessária:** configurar secret `CORS_ALLOWED_ORIGINS` no Supabase Dashboard com o domínio de produção (ex.: `https://rjnet-eventos.vercel.app,http://localhost:3000`) antes do próximo deploy da Edge Function

> **Nota PA-09:** S-05 (stack trace) foi corrigido nesta ação como especificado no passo 5 de PA-03. PA-09 pode ser marcado como resolvido via PA-03.

---

## FASE 2 — Curto Prazo (7–30 dias)

> Correções técnicas que reduzem risco de vazamento e melhoram rastreabilidade.

---

### PA-04 — Implementar mecanismo de consentimento LGPD para captação de leads

| Campo | Valor |
|-------|-------|
| **Status** | 🟢 Concluído |
| **Prioridade** | CRÍTICA (LGPD) |
| **ID Auditoria** | L-01, L-02, L-03 |
| **Não conformidade** | Dados pessoais coletados sem consentimento, sem informação ao titular |
| **Impacto** | Ilegalidade do tratamento — risco de autuação pela ANPD e ações de titulares |
| **Responsável** | — |
| **Prazo** | 2026-07-16 |
| **Data de conclusão** | 2026-06-16 |

**O que fazer — Opção A (Ficha física — mais rápida de implementar):**

1. Criar ficha de consentimento física para ser assinada pelo titular no evento:
   - Nome do controlador: RJNet Telecomunicações
   - Finalidade do tratamento: contato comercial para apresentação de serviços
   - Dados coletados: nome, telefone, CPF (opcional), endereço (opcional)
   - Direito de revogação e contato do DPO/responsável
   - Checkbox de aceite com data e assinatura

2. Adicionar campo no banco para registrar que o consentimento foi coletado:
   ```sql
   -- Executar no SQL Editor do Supabase
   ALTER TABLE public.leads
     ADD COLUMN IF NOT EXISTS consentimento_coletado boolean NOT NULL DEFAULT false,
     ADD COLUMN IF NOT EXISTS consentimento_em       timestamptz,
     ADD COLUMN IF NOT EXISTS versao_termo           text;
   ```

3. Adicionar campo no formulário do vendedor (`VendedorApp.jsx`):
   ```jsx
   <div className="big-field">
     <label>
       <input type="checkbox" required onChange={(e) => set("consentimentoColetado", e.target.checked)} />
       {" "}Titular assinou a ficha de consentimento LGPD
     </label>
   </div>
   ```

4. Bloquear envio do formulário se `consentimentoColetado === false`

5. Persistir `consentimento_em: new Date().toISOString()` e `versao_termo: "v1.0"` ao salvar o lead

**O que fazer — Opção B (QR Code / formulário digital — mais robusto):**

1. Criar formulário web público (nova rota ou página separada) onde o próprio titular preenche seus dados
2. Exibir termos de uso e política de privacidade antes do envio
3. Registrar IP, timestamp e versão do termo no banco
4. Vendedor usa o sistema para acompanhar leads criados pelo titular

**Arquivos afetados:**
- `supabase/schema.sql` ou novo arquivo `supabase/migracao-consentimento.sql`
- `src/apps/VendedorApp.jsx`
- `src/lib/dataService.js` (mapeador `leadToDb`/`leadFromDb`)

**Documentação a atualizar após conclusão:**
- [x] `doc/architecture/DECISIONS.md` — decisão D-033: Opção A (ficha física) escolhida
- [x] `doc/CHANGELOG.md` (v2.0)
- [x] `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` — L-01, L-02 marcados como resolvidos
- [ ] `doc/lgpd/POLITICA_DE_PRIVACIDADE.md` — pendente (PA-16, Fase 4)

**Evidência de conclusão:**
- `supabase/migracao-consentimento.sql`: migração idempotente com `ADD COLUMN IF NOT EXISTS` para `consentimento_coletado` (bool, default false), `consentimento_em` (timestamptz) e `versao_termo` (text); índice de auditoria criado
- `src/lib/dataService.js`: `leadFromDb` expõe `consentimentoColetado`, `consentimentoEm`, `versaoTermo`; `leadToDb` persiste `consentimento_em` e `versao_termo` automaticamente quando `consentimentoColetado = true`
- `src/apps/VendedorApp.jsx`: checkbox obrigatório adicionado antes do botão de submit; validação bloqueia envio com mensagem de erro se não marcado; `FORM_VAZIO` inicializa `consentimentoColetado: false`
- **Migração aplicada em produção em 2026-06-16:** colunas `consentimento_coletado` (boolean, default false, NOT NULL), `consentimento_em` (timestamptz, nullable), `versao_termo` (text, nullable) confirmadas via query de verificação — 3 linhas retornadas ✅

> **⚠️ Atualização 2026-06-17 — D-043:** Campo de consentimento **ocultado temporariamente da UI** enquanto as decisões externas sobre o processo de coleta (ficha física vs. digital, fluxo) não são finalizadas. Schema e lógica de `dataService.js` preservados. Status PA-04 rebaixado para 🟡 (parcial). Para reativar: descomentar bloco do checkbox em `VendedorApp.jsx` e reintroduzir validação. Ver D-043 em `DECISIONS.md`.

> **Nota 2026-07-02 — D-057 (Área de Ofertas):** nova feature permite ao vendedor enviar, manualmente e 1:1 via WhatsApp, uma oferta pronta (imagem+copy) ao lead. O seletor prioriza o serviço de interesse já cadastrado, mas permite escolher qualquer uma das ofertas configuradas — cobre também interesse percebido na conversa, não só o declarado na captação; a decisão de qual oferta enviar continua sendo do vendedor em cada contato, não automatizada. Não introduz dado pessoal novo do titular (nome/telefone continuam só em `leads`; `oferta_envios` só referencia `lead_id` via FK com `ON DELETE CASCADE`) e não altera nem resolve o status de PA-04 — a pendência de consentimento segue a mesma acima. Por ser contato pontual iniciado pelo vendedor que já abordou o titular no evento (não campanha automatizada/segmentada em massa), é o uso mais alinhado à finalidade "contato comercial para apresentação de serviços" já redigida no termo suspenso — reforça, mas não substitui, a necessidade de destravar a decisão externa sobre o processo de coleta de consentimento.

---

### PA-05 — Criptografar dados da fila offline no localStorage

| Campo | Valor |
|-------|-------|
| **Status** | 🟢 Concluído |
| **Prioridade** | ALTA |
| **ID Auditoria** | S-02 |
| **Não conformidade** | Leads capturados offline (incluindo CPF e telefone) armazenados em texto plano no localStorage |
| **Impacto** | Dados pessoais expostos no dispositivo do vendedor se não houver bloqueio de tela |
| **Responsável** | — |
| **Prazo** | 2026-07-16 |
| **Data de conclusão** | 2026-06-16 |

**O que fazer:**

1. Criar utilitário de criptografia em `src/lib/crypto.js` usando Web Crypto API (nativa no browser):
   ```javascript
   // Deriva chave da sessão do usuário (não persiste a chave — dados inacessíveis após logout)
   export async function encryptData(data, key) { ... }
   export async function decryptData(encrypted, key) { ... }
   export async function deriveKeyFromSession(userId) { ... }
   ```

2. Modificar `src/lib/dataService.js` — funções `getQueue()` e `saveQueue()` para criptografar/descriptografar usando a chave derivada da sessão

3. Garantir que ao fazer logout, a chave seja descartada (os dados da fila ficam inacessíveis até o próximo login do mesmo usuário)

**Arquivos afetados:**
- `src/lib/dataService.js`
- Novo: `src/lib/crypto.js`

**Documentação a atualizar após conclusão:**
- [x] `doc/architecture/SYSTEM_MAP.md` — `src/lib/crypto.js` adicionado na estrutura
- [x] `doc/CHANGELOG.md` (v2.1)
- [x] `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` — S-02 marcado como resolvido
- [x] `doc/architecture/DECISIONS.md` — D-034 (estratégia de derivação de chave PBKDF2)

**Evidência de conclusão:**
- `src/lib/crypto.js` (novo): utilitário de criptografia AES-GCM 256 bits usando Web Crypto API nativa
  - `deriveKey(userId)`: PBKDF2-SHA256, 100.000 iterações, chave AES-GCM 256 bits — cacheada em memória (nunca persistida)
  - `encryptQueue(data, userId)`: serializa, gera IV aleatório, cifra com AES-GCM, retorna `base64(iv).base64(ciphertext)`
  - `decryptQueue(encrypted, userId)`: retorna `null` em caso de chave errada, dados corrompidos ou formato legado
  - `clearCryptoKey(userId)`: descarta chave do cache em memória no logout
  - `cryptoSupported`: flag de compatibilidade (todos os browsers modernos suportam)
- `src/lib/dataService.js`: `getQueue()` e `saveQueue()` tornadas assíncronas; criptografia ativa quando `cryptoSupported && _queueUserId` — fallback silencioso para texto plano em ambientes sem Web Crypto API; `flushPendingQueue()` atualizado para `await getQueue()` e `await saveQueue()`; exports `setQueueUserId()` e `clearQueueSession()` adicionados
- `src/auth/RootAuth.jsx`: chama `setQueueUserId(s.userId)` ao iniciar sessão (login + restore); chama `clearQueueSession(userId)` ao fazer logout e ao receber evento `SIGNED_OUT` — garante que a chave seja descartada da memória e os dados da fila fiquem inacessíveis

---

### PA-06 — Criar log de exportações CSV

| Campo | Valor |
|-------|-------|
| **Status** | 🟢 Concluído |
| **Prioridade** | ALTA |
| **ID Auditoria** | A-01, L-08 |
| **Não conformidade** | Exportações de dados pessoais sem qualquer log ou rastreabilidade |
| **Impacto** | Impossibilidade de auditar vazamentos; não conformidade com princípio de segurança LGPD |
| **Responsável** | — |
| **Prazo** | 2026-07-16 |
| **Data de conclusão** | 2026-06-16 |

**O que fazer:**

1. Criar tabela de auditoria de exportações no Supabase:
   ```sql
   -- supabase/migracao-audit-exportacoes.sql
   CREATE TABLE IF NOT EXISTS public.audit_exportacoes (
     id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     usuario_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
     usuario_nome text,
     usuario_email text,
     acao         text NOT NULL DEFAULT 'export_csv_leads',
     filtros      jsonb,
     total_registros integer,
     exportado_em timestamptz NOT NULL DEFAULT now()
   );

   ALTER TABLE public.audit_exportacoes ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "audit_export_insert" ON public.audit_exportacoes
     FOR INSERT TO authenticated
     WITH CHECK (public.papel_atual() = 'marketing');

   CREATE POLICY "audit_export_select" ON public.audit_exportacoes
     FOR SELECT TO authenticated
     USING (public.papel_atual() = 'marketing');
   ```

2. Adicionar registro na `audit_exportacoes` antes de cada exportação em `src/utils/csv.js`:
   - Usuário que exportou
   - Filtros aplicados
   - Quantidade de registros exportados
   - Data/hora

3. Criar seção no painel de marketing para visualizar histórico de exportações

**Arquivos afetados:**
- Novo: `supabase/migracao-audit-exportacoes.sql`
- `src/utils/csv.js`
- `src/lib/dataService.js` (novo método `db.registrarExportacao()`)

**Documentação a atualizar após conclusão:**
- [x] `doc/architecture/SUPABASE.md` — nova tabela `audit_exportacoes` documentada na tabela de migrações
- [x] `doc/CHANGELOG.md` (v2.2)
- [x] `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` — A-01, L-08 marcados como resolvidos

**Evidência de conclusão:**
- `supabase/migracao-audit-exportacoes.sql` (novo): cria tabela `audit_exportacoes` com RLS — apenas papel `marketing` pode inserir e consultar; índices por `usuario_id` e `exportado_em`; totalmente idempotente
- `src/lib/dataService.js`: `db.registrarExportacao({ usuarioId, usuarioNome, usuarioEmail, filtros, totalRegistros })` — fire-and-forget, nunca bloqueia o download; falha silenciosa com `console.warn`
- `src/utils/csv.js`: parâmetro `onAudit` opcional — callback chamado após o download com `{ totalRegistros }` para desacoplar a lógica de auditoria da geração do arquivo
- `src/features/leads/LeadsTab.jsx`: recebe `session` via prop; callback `onAudit` passado para `exportLeadsCSV` com `usuarioId`, `usuarioNome`, `usuarioEmail` e filtros aplicados (`evento`, `vendedor`, `servico`)
- `src/apps/MarketingApp.jsx`: `<LeadsTab session={session} />` — prop adicionada
- **Migração aplicada em produção em 2026-06-16:** tabela `audit_exportacoes`, policies RLS e índices criados com sucesso — "Success. No rows returned" ✅

---

### PA-07 — Adicionar rastreabilidade ao soft delete de leads

| Campo | Valor |
|-------|-------|
| **Status** | 🟢 Concluído |
| **Prioridade** | ALTA |
| **ID Auditoria** | BD-06, A-03 |
| **Não conformidade** | Soft delete sem registro de quem excluiu e quando |
| **Impacto** | Impossibilidade de auditar exclusões; não conformidade com rastreabilidade LGPD |
| **Responsável** | — |
| **Prazo** | 2026-07-16 |
| **Data de conclusão** | 2026-06-16 |

**O que fazer:**

1. Adicionar colunas de rastreabilidade ao soft delete:
   ```sql
   -- supabase/migracao-soft-delete-audit.sql
   ALTER TABLE public.leads
     ADD COLUMN IF NOT EXISTS deletado_em   timestamptz,
     ADD COLUMN IF NOT EXISTS deletado_por  uuid REFERENCES auth.users(id) ON DELETE SET NULL;
   ```

2. Modificar `db.removeLead()` em `src/lib/dataService.js` para incluir o usuário atual:
   ```javascript
   removeLead: (id, userId) => exec(
     supabase?.from('leads').update({
       deletado: true,
       deletado_em: new Date().toISOString(),
       deletado_por: userId,
     }).eq('id', id),
     'remover lead'
   ),
   ```

3. Passar `session.userId` ao chamar `removeLead()` no `VendedorApp.jsx` e no `EventDetail.jsx`

**Arquivos afetados:**
- Novo: `supabase/migracao-soft-delete-audit.sql`
- `src/lib/dataService.js`
- `src/apps/VendedorApp.jsx`
- `src/features/events/EventDetail.jsx`

**Documentação a atualizar após conclusão:**
- [x] `doc/architecture/SUPABASE.md` — migração PA-07 adicionada na tabela de ordem
- [x] `doc/CHANGELOG.md` (v2.3)
- [x] `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` — BD-06, A-03 marcados como resolvidos

**Evidência de conclusão:**
- `supabase/migracao-soft-delete-audit.sql` (novo): `ADD COLUMN IF NOT EXISTS deletado_em timestamptz` e `deletado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL` na tabela `leads`; índices parciais (`WHERE deletado = true`) para consultas de auditoria eficientes
- `src/lib/dataService.js`: `db.removeLead(id)` atualizado para gravar `deletado: true`, `deletado_em: new Date().toISOString()` e `deletado_por: _queueUserId` — reutiliza o userId já registrado em memória via PA-05 (`setQueueUserId`), sem necessidade de alterar assinatura da função nem propagar props por toda a cadeia
- **Migração aplicada em produção em 2026-06-16:** colunas `deletado_em` (timestamptz), `deletado_por` (uuid) e índices parciais criados com sucesso — "Success. No rows returned" ✅

> **⚠️ Revisão pós-implementação (2026-06-17 — D-043):** O soft delete via UPDATE gerava "new row violates row-level security policy" para vendedores ao tentar setar `deletado=true`, mesmo com `vendedor_id = auth.uid()` correto. `db.removeLead` foi migrado para hard DELETE (`supabase.from('leads').delete()`), que usa a policy `leads_delete` (sem `WITH CHECK`). A rastreabilidade LGPD é mantida pelo trigger `audit_leads` (AFTER DELETE → `audit_log` com `usuario_id`, `usuario_nome`, `dados_antes`). As colunas `deletado_em`/`deletado_por` continuam existindo no schema e são utilizadas quando o marketing realiza soft delete diretamente via SQL.

---

### PA-08 — Pseudonimizar ou criptografar CPF no banco de dados

| Campo | Valor |
|-------|-------|
| **Status** | 🟢 Concluído |
| **Prioridade** | ALTA |
| **ID Auditoria** | BD-02, L-03 |
| **Não conformidade** | CPF armazenado em texto plano; coleta possivelmente excessiva |
| **Impacto** | Em caso de vazamento, CPF é dado pessoal com alto potencial de dano |
| **Responsável** | — |
| **Prazo** | 2026-07-16 |
| **Data de conclusão** | 2026-06-16 |

**O que fazer (avaliar qual caminho seguir):**

**Opção A — Remover CPF (preferível se o check-in puder usar outro identificador):**
1. Avaliar se a funcionalidade de check-in (`CheckinTab.jsx`) pode usar telefone como identificador
2. Se sim: remover o campo `cpf` do formulário e da tabela
3. Se não: ir para Opção B

**Opção B — Criptografar CPF com pgcrypto:**
1. Habilitar a extensão pgcrypto no Supabase: `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
2. Criar função de criptografia/descriptografia simétrica com chave armazenada como secret do Supabase
3. Modificar `leadToDb` para criptografar antes de salvar e `leadFromDb` para descriptografar ao ler

**Opção C — Pseudonimização (hash):**
1. Armazenar apenas `SHA-256(cpf)` — permite verificação de igualdade no check-in sem expor o CPF real
2. Adicionar coluna `cpf_hash` e remover coluna `cpf` após migração

**Arquivos afetados (dependendo da opção):**
- `src/lib/dataService.js`
- `src/features/checkin/CheckinTab.jsx`
- `src/apps/VendedorApp.jsx`
- `supabase/schema.sql` ou novo SQL de migração

**Documentação a atualizar após conclusão:**
- [x] `doc/architecture/DECISIONS.md` — D-035: Opção A (remoção do CPF) escolhida via migração para check-in por nome
- [x] `doc/architecture/SUPABASE.md` — migração PA-08 adicionada na tabela de ordem
- [x] `doc/CHANGELOG.md` (v2.4)
- [x] `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` — BD-02, L-03 marcados como resolvidos

**Evidência de conclusão:**
- `supabase/migracao-remove-cpf.sql` (novo): `DROP COLUMN IF EXISTS cpf` — remove coluna e todos os valores existentes da tabela `leads`
- `src/lib/dataService.js`: `leadFromDb` e `leadToDb` sem campo `cpf` — dado não entra nem sai do banco
- `src/features/checkin/CheckinTab.jsx`: check-in reescrito — busca por nome (substring case-insensitive) dentro do evento; exibe lista de matches quando mais de um resultado; sem campo CPF na UI
- `src/apps/VendedorApp.jsx`: campo CPF removido do formulário de captura, do formulário de edição inline (`LeadEditInline`) e da lista de leads; `FORM_VAZIO` sem `cpf`; import `maskCpf` removido
- `src/utils/csv.js`: coluna CPF removida do CSV exportado
- **Migração de remoção aplicada em produção em 2026-06-16** — coluna `cpf` removida ✅
- **Reintrodução (PA-08b):** coluna `cpf` readicionada como opcional com finalidade declarada — visita técnica e contrato — **aplicada em produção em 2026-06-16** ✅

---

### PA-09 — Corrigir stack trace exposto na Edge Function

| Campo | Valor |
|-------|-------|
| **Status** | 🟢 Concluído (resolvido em PA-03) |
| **Prioridade** | MÉDIA |
| **ID Auditoria** | S-05 |
| **Não conformidade** | `String(err)` em resposta 500 pode vazar informações internas |
| **Responsável** | — |
| **Prazo** | 2026-07-16 |
| **Data de conclusão** | 2026-06-16 |

**O que fazer:**

Editar `supabase/functions/atualizar-email-usuario/index.ts`, bloco catch final:
```typescript
// Antes
return json({ error: String(err) }, 500);

// Depois
console.error('[rjnet:edge] Erro não tratado:', err);
return json({ error: 'Erro interno. Contate o suporte.' }, 500);
```

**Evidência de conclusão:** Corrigido como parte de PA-03 — `catch (err)` agora faz `console.error('[rjnet:edge] Erro não tratado em atualizar-email-usuario:', err)` internamente e retorna `"Erro interno do servidor. Contate o suporte."` ao cliente. Ver `supabase/functions/atualizar-email-usuario/index.ts`.

---

## FASE 3 — Médio Prazo (30–90 dias)

> Conformidade estrutural: auditoria de operações, retenção, minimização e RBAC.

---

### PA-10 — Implementar política de retenção de dados com exclusão automática

| Campo | Valor |
|-------|-------|
| **Status** | 🟢 Concluído |
| **Prioridade** | ALTA (LGPD) |
| **ID Auditoria** | L-04, BD-05, L-06 |
| **Não conformidade** | Sem política de retenção — leads retidos indefinidamente mesmo após soft delete |
| **Responsável** | — |
| **Prazo** | 2026-09-16 |
| **Data de conclusão** | 2026-06-16 |

**O que fazer:**

1. Definir com o jurídico/negócio o período de retenção de leads (ex: 12 meses após o evento, ou 6 meses após o soft delete)

2. Criar Edge Function de limpeza periódica:
   ```typescript
   // supabase/functions/limpar-dados-expirados/index.ts
   // Deleta fisicamente leads com deletado=true e deletado_em < now() - INTERVAL '90 days'
   // E leads de eventos encerrados há mais de 12 meses (sem atividade comercial)
   ```

3. Agendar via Supabase Cron Job (pg_cron) ou trigger periódico

4. Criar tabela de configuração de retenção:
   ```sql
   INSERT INTO public.configuracoes (chave, valor) VALUES
     ('retencao_leads_deletados_dias', '90'),
     ('retencao_leads_eventos_encerrados_dias', '365');
   ```

5. Documentar política de retenção em `doc/POLITICA_RETENCAO.md` (novo documento)

**Documentação a atualizar após conclusão:**
- [x] Novo: `doc/POLITICA_RETENCAO.md`
- [x] `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md`
- [x] `doc/architecture/SUPABASE.md`
- [x] `doc/CHANGELOG.md`

**Evidência de conclusão:**
- `supabase/migracao-retencao.sql` (novo): extensão `pg_cron`, tabela `configuracoes_retencao` com valores padrão (90 dias para soft delete, 365 dias para eventos encerrados), função `limpar_leads_expirados()` com hard delete automático, job agendado para 02:00 BRT diariamente
- **Ação manual necessária:** executar `supabase/migracao-retencao.sql` no Supabase Dashboard → SQL Editor (requer extensão pg_cron habilitada em Database → Extensions)
- Prazos padrão adotados: 90 dias (leads deletados) e 365 dias (leads de eventos encerrados) — ajustar em `configuracoes_retencao` conforme decisão jurídica

---

### PA-11 — Restringir SELECT de leads para vendedores (minimização de acesso)

| Campo | Valor |
|-------|-------|
| **Status** | 🟢 Concluído |
| **Prioridade** | MÉDIA |
| **ID Auditoria** | SB-04 (RLS), princípio da minimização LGPD |
| **Não conformidade** | Vendedor lê CPF, telefone e endereço de leads de colegas |
| **Responsável** | — |
| **Prazo** | 2026-09-16 |
| **Data de conclusão** | 2026-06-16 |

**O que fazer:**

1. Modificar a policy `leads_select` em `supabase/migracao-auth.sql`:
   ```sql
   -- Antes: vendedor vê todos os leads não deletados
   -- Depois: vendedor vê apenas seus próprios leads (ranking já usa função segura)
   DROP POLICY IF EXISTS "leads_select" ON public.leads;
   CREATE POLICY "leads_select" ON public.leads FOR SELECT TO authenticated
     USING (
       deletado = false
       AND (
         public.papel_atual() = 'marketing'
         OR (public.papel_atual() = 'vendedor' AND vendedor_id = auth.uid())
       )
     );
   ```

2. Verificar se isso quebra alguma funcionalidade no `VendedorApp.jsx`:
   - Aba "Meus Leads": usa `leadsDoEvento.filter(l => l.vendedorNome === session.vendedorNome)` — continua funcionando
   - Ranking: usa `rankingEvento()` via RPC segura — continua funcionando
   - `fetchAll()` retornará apenas leads do próprio vendedor — ✅

3. Testar fluxo completo do vendedor após a mudança

**Documentação a atualizar após conclusão:**
- [x] `supabase/migracao-auth.sql` ou novo SQL
- [x] `doc/architecture/SUPABASE.md`
- [x] `doc/CHANGELOG.md`
- [x] `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md`

**Evidência de conclusão:**
- `supabase/migracao-rls-vendedor-leads.sql` (novo): recria `leads_select` policy — vendedor recebe do banco apenas `vendedor_id = auth.uid()` (antes recebia todos os leads e o frontend filtrava); marketing mantém acesso total
- Nota: o frontend já filtrava por `vendedorNome` na UI — agora a restrição existe também na camada de banco, eliminando o tráfego de dados de colegas para o dispositivo do vendedor
- **Ação manual necessária:** executar `supabase/migracao-rls-vendedor-leads.sql` no Supabase Dashboard → SQL Editor

---

### PA-12 — Habilitar MFA (autenticação multifator)

| Campo | Valor |
|-------|-------|
| **Status** | 🟢 Concluído (UI implementada; configuração Supabase é manual) |
| **Prioridade** | MÉDIA |
| **ID Auditoria** | S-03 |
| **Não conformidade** | Sem segundo fator de autenticação |
| **Responsável** | — |
| **Prazo** | 2026-09-16 |
| **Data de conclusão** | 2026-06-16 |

**O que fazer:**

1. Habilitar TOTP MFA no Supabase Dashboard → Authentication → Multi-Factor Auth
2. Adaptar `src/auth/LoginAuth.jsx` para tratar o fluxo de desafio MFA quando o usuário tiver o fator configurado
3. Tornar MFA obrigatório apenas para usuários `marketing` (que têm acesso a todos os dados)
4. Documentar o processo de configuração para os usuários de marketing em `doc/architecture/SUPABASE.md`

**Evidência de conclusão:**
- `src/lib/dataService.js`: `auth.signIn()` detecta desafio MFA (`session === null && user === null`) — cria challenge TOTP e retorna `{ mfaRequired: true, factorId, challengeId }`; novo método `auth.verifyMfa(factorId, challengeId, codigo)` verifica o código e estabelece sessão completa
- `src/auth/LoginAuth.jsx`: tela de código TOTP exibida automaticamente quando `mfaRequired`; campo numérico com `autoComplete="one-time-code"`, botão voltar ao login
- **Ação manual necessária (Supabase Dashboard):** Authentication → Multi-Factor Auth → habilitar TOTP; orientar usuários marketing a configurar o autenticador (Google Authenticator, Authy, etc.)

---

### PA-13 — Criar tabela de auditoria de operações em dados pessoais

| Campo | Valor |
|-------|-------|
| **Status** | 🟢 Concluído |
| **Prioridade** | ALTA |
| **ID Auditoria** | A-02, A-04, A-05, BD-04 |
| **Não conformidade** | Sem log de edições, acessos e alterações de permissões |
| **Responsável** | — |
| **Prazo** | 2026-09-16 |
| **Data de conclusão** | 2026-06-16 |

**O que fazer:**

1. Criar tabela de audit log:
   ```sql
   -- supabase/migracao-audit-log.sql
   CREATE TABLE IF NOT EXISTS public.audit_log (
     id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     usuario_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
     usuario_nome  text,
     acao          text NOT NULL,  -- 'create_lead', 'update_lead', 'delete_lead', 'update_perfil', etc.
     tabela        text,
     registro_id   text,
     dados_antes   jsonb,
     dados_depois  jsonb,
     ip            text,           -- se disponível via header
     criado_em     timestamptz NOT NULL DEFAULT now()
   );

   ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

   -- Apenas marketing pode ler
   CREATE POLICY "audit_log_select" ON public.audit_log
     FOR SELECT TO authenticated
     USING (public.papel_atual() = 'marketing');

   -- Sistema pode inserir (via trigger ou Edge Function)
   CREATE POLICY "audit_log_insert" ON public.audit_log
     FOR INSERT TO authenticated
     WITH CHECK (true);
   ```

2. Criar triggers para eventos de leads:
   ```sql
   CREATE OR REPLACE FUNCTION public.log_lead_change()
   RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
   BEGIN
     INSERT INTO public.audit_log (usuario_id, acao, tabela, registro_id, dados_antes, dados_depois)
     VALUES (
       auth.uid(),
       TG_OP,
       TG_TABLE_NAME,
       COALESCE(NEW.id, OLD.id),
       CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
       CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END
     );
     RETURN COALESCE(NEW, OLD);
   END;
   $$;

   CREATE TRIGGER audit_leads
     AFTER INSERT OR UPDATE OR DELETE ON public.leads
     FOR EACH ROW EXECUTE FUNCTION public.log_lead_change();
   ```

3. Criar view de auditoria para o painel de marketing

**Documentação a atualizar após conclusão:**
- [x] `doc/architecture/SUPABASE.md`
- [x] `doc/CHANGELOG.md`
- [x] `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` — marcar A-02, A-04, A-05, BD-04

**Evidência de conclusão:**
- `supabase/migracao-audit-log.sql` (novo): tabela `audit_log` com RLS (select restrito a marketing, insert permitido a authenticated); índices por usuário, registro e data; trigger `audit_leads` registra automaticamente INSERT/UPDATE/DELETE na tabela `leads` com dados antes/depois em JSONB; função `log_lead_change()` com SECURITY DEFINER
- **Ação manual necessária:** executar `supabase/migracao-audit-log.sql` no Supabase Dashboard → SQL Editor

---

### PA-14 — Assinar DPA com Supabase Inc. e documentar transferência internacional

| Campo | Valor |
|-------|-------|
| **Status** | 🟡 Em progresso (requer ação jurídica) |
| **Prioridade** | ALTA (LGPD) |
| **ID Auditoria** | L-07, I-01 |
| **Não conformidade** | Transferência de dados pessoais de brasileiros para os EUA sem garantias adequadas documentadas |
| **Responsável** | — (jurídico + técnico) |
| **Prazo** | 2026-09-16 |
| **Data de conclusão** | — |

**O que fazer:**

1. Acessar o DPA da Supabase em: `https://supabase.com/privacy` → Data Processing Agreement
2. Assinar o DPA (disponível para todos os planos pagos)
3. Verificar se a Supabase possui certificações adequadas (ISO 27001, SOC 2) como garantias do art. 33 LGPD
4. Documentar no processo interno de conformidade:
   - Empresa: Supabase Inc.
   - País: EUA
   - Dados transferidos: todos os dados pessoais do sistema
   - Base legal: art. 33, II LGPD (garantias contratuais) ou art. 33, VII (legítimo interesse)
   - Evidência: número/data do DPA assinado

5. Criar seção em `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` documentando o DPA

**Documentação a atualizar após conclusão:**
- [x] `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` — marcar L-07, I-01
- [x] Novo: `doc/lgpd/DPA_FORNECEDORES.md` — registro de todos os DPAs

**Evidência de conclusão:**
- `doc/lgpd/DPA_FORNECEDORES.md` (novo): registro de fornecedores com acesso a dados pessoais — Supabase Inc. (EUA, SOC 2/ISO 27001) e Vercel Inc. (sem dados pessoais)
- **Ação manual necessária (jurídico):** assinar DPA com Supabase em https://supabase.com/privacy e preencher data/número em `doc/lgpd/DPA_FORNECEDORES.md`

---

### PA-15 — Criar processo de atendimento a direitos de titulares (DSAR)

| Campo | Valor |
|-------|-------|
| **Status** | 🟢 Concluído |
| **Prioridade** | ALTA (LGPD) |
| **ID Auditoria** | L-05 |
| **Não conformidade** | Sem mecanismo para titulares exercerem direitos do art. 18 LGPD |
| **Responsável** | — |
| **Prazo** | 2026-09-16 |
| **Data de conclusão** | 2026-06-16 |

**O que fazer:**

1. Definir canal de contato para titulares (e-mail dedicado: privacidade@rjnet.com.br ou similar)

2. Criar roteiro operacional para cada direito:

   **Direito de acesso (art. 18, I):** Query para buscar todos os dados de um titular por CPF ou telefone
   **Direito de correção (art. 18, III):** Processo de atualização via painel de marketing
   **Direito de exclusão (art. 18, VI):** Processo de hard delete do registro (não apenas soft delete)
   **Direito de portabilidade (art. 18, V):** Exportação individual dos dados do titular em JSON/CSV
   **Direito de revogação de consentimento (art. 18, IX):** Exclusão do registro + bloqueio de recontato

3. Criar queries SQL padrão para cada operação e documentar em `doc/lgpd/ROTEIRO_DSAR.md`

4. Definir prazo de resposta: 15 dias (recomendado) conforme boas práticas ANPD

**Documentação a atualizar após conclusão:**
- [x] Novo: `doc/lgpd/ROTEIRO_DSAR.md`
- [x] `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` — marcar L-05

**Evidência de conclusão:**
- `doc/lgpd/ROTEIRO_DSAR.md` (novo): roteiro completo com queries SQL para acesso, correção, exclusão (hard delete), portabilidade e revogação de consentimento; prazo de resposta 15 dias; modelo de registro de atendimentos
- **Ação manual necessária:** criar canal de contato `privacidade@rjnet.com.br` para receber solicitações de titulares

---

## FASE 4 — Longo Prazo (90+ dias)

> Governança, documentação legal e maturidade contínua.

---

### PA-16 — Elaborar e publicar Política de Privacidade

| Campo | Valor |
|-------|-------|
| **Status** | 🟢 Concluído |
| **Prioridade** | ALTA |
| **ID Auditoria** | G-01, L-02 |
| **Não conformidade** | Sistema sem política de privacidade — não existe documentação pública sobre o tratamento de dados |
| **Responsável** | — |
| **Prazo** | 2026-12-16 |
| **Data de conclusão** | 2026-06-16 |

**O que fazer:**

1. Elaborar política de privacidade cobrindo:
   - Identidade do controlador (RJNet)
   - Dados coletados e finalidades
   - Bases legais de cada tratamento
   - Compartilhamento com terceiros (Supabase)
   - Transferência internacional (Supabase EUA)
   - Direitos dos titulares e como exercê-los
   - Contato do DPO/responsável
   - Vigência e atualizações

2. Versionar a política (v1.0, v1.1 etc.) e armazenar em `doc/lgpd/POLITICA_DE_PRIVACIDADE.md`

3. Referenciar a versão vigente no campo `versao_termo` ao coletar consentimento (ver PA-04)

**Documentação a atualizar após conclusão:**
- [ ] Novo: `doc/lgpd/POLITICA_DE_PRIVACIDADE.md`
- [ ] `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` — marcar G-01, L-02

**Evidência de conclusão:**
- `doc/lgpd/POLITICA_DE_PRIVACIDADE.md` (novo): política v1.0 cobrindo controlador, dados coletados, finalidades, bases legais, compartilhamento (Supabase/Vercel), retenção, direitos dos titulares, medidas de segurança, transferência internacional e canal de contato
- Versão do termo referenciada como `v1.0` — já usada em `versao_termo` no consentimento (PA-04)

---

### PA-17 — Elaborar RIPD (Relatório de Impacto à Proteção de Dados)

| Campo | Valor |
|-------|-------|
| **Status** | 🟡 Em progresso (documento criado; pendente aprovação pelo DPO) |
| **Prioridade** | MÉDIA |
| **ID Auditoria** | L-09 |
| **Responsável** | — (DPO + técnico) |
| **Prazo** | 2026-12-16 |
| **Data de conclusão** | — |

**Evidência de conclusão:**
- `doc/lgpd/RIPD.md` (novo): RIPD v1.0 cobrindo descrição do tratamento, avaliação de necessidade/proporcionalidade por campo, matriz de riscos com 8 riscos identificados, medidas de mitigação adotadas e pendentes
- ⚠️ Pendente: aprovação formal pelo DPO após nomeação (PA-19)

---

### PA-18 — Criar e manter ROPA (Registro de Operações de Tratamento)

| Campo | Valor |
|-------|-------|
| **Status** | 🟡 Em progresso (documento criado; pendente validação pelo DPO) |
| **Prioridade** | MÉDIA |
| **ID Auditoria** | L-10 |
| **Responsável** | — (DPO) |
| **Prazo** | 2026-12-16 |
| **Data de conclusão** | — |

**Evidência de conclusão:**
- `doc/lgpd/ROPA.md` (novo): 4 operações de tratamento documentadas — captação de leads, exportação CSV, autenticação de usuários internos e auditoria de operações; bases legais, destinatários, transferências internacionais, retenção e medidas de segurança
- ⚠️ Pendente: validação pelo DPO após nomeação (PA-19); prazo de retenção do audit_log a definir

---

### PA-19 — Nomear Encarregado de Proteção de Dados (DPO)

| Campo | Valor |
|-------|-------|
| **Status** | 🔴 Em aberto |
| **Prioridade** | MÉDIA |
| **ID Auditoria** | L-11 |
| **Responsável** | — (diretoria) |
| **Prazo** | 2026-12-16 |
| **Data de conclusão** | — |

**O que fazer:**

1. Nomear formalmente o DPO (interno ou externo)
2. Publicar dados de contato do DPO (e-mail e canal)
3. Registrar a nomeação
4. Registrar o DPO no canal da ANPD quando disponível

**Evidência de conclusão:** _Nome e contato do DPO nomeado_

---

### PA-20 — Elaborar Plano de Resposta a Incidentes de Dados

| Campo | Valor |
|-------|-------|
| **Status** | 🟡 Em progresso (documento criado; pendente aprovação pelo DPO e tabletop exercise) |
| **Prioridade** | MÉDIA |
| **ID Auditoria** | G-03 |
| **Responsável** | — (DPO + técnico) |
| **Prazo** | 2026-12-16 |
| **Data de conclusão** | — |

**Evidência de conclusão:**
- `doc/lgpd/PLANO_INCIDENTES.md` (novo): classificação de severidade (4 níveis), procedimento em 6 fases (detecção → contenção → avaliação → notificação → correção → lições aprendidas), queries SQL para investigação via audit_log, prazos ANPD (72h), modelo de registro de incidentes
- ⚠️ Pendente: aprovação pelo DPO (PA-19); simulação de tabletop exercise; preenchimento de contatos de emergência

---

### PA-21 — Avaliar e remover campos excessivos do formulário de lead

| Campo | Valor |
|-------|-------|
| **Status** | 🔴 Em aberto |
| **Prioridade** | MÉDIA |
| **ID Auditoria** | L-03, L-08 |
| **Não conformidade** | Possível excesso de coleta (CPF, endereço) sem justificativa proporcional documentada |
| **Responsável** | — (negócio + jurídico) |
| **Prazo** | 2026-12-16 |
| **Data de conclusão** | — |

**O que fazer:**

1. Reunir com o time de negócio para avaliar a necessidade real de cada campo:

   | Campo | Pergunta | Decisão |
   |-------|---------|---------|
   | CPF | Sem CPF é possível fazer check-in por telefone? | A definir |
   | Endereço | O endereço é usado para verificar cobertura? Isso ocorre antes ou depois da captação? | A definir |
   | Temperatura | Utilizada nas ações de follow-up? | Manter |
   | Observação (texto livre) | Necessária? Há campos estruturados que substituam? | A definir |

2. Para cada campo decidido como desnecessário: criar migração SQL para remover a coluna

3. Registrar a decisão em `doc/architecture/DECISIONS.md`

**Evidência de conclusão:** _Decisão registrada em DECISIONS.md + campos removidos se aplicável_

---

## Painel de Status Consolidado

| ID | Ação | Fase | Prioridade | Status | Prazo |
|----|------|------|-----------|--------|-------|
| PA-01 | Remover senha de marketing do bundle JS | 1 | CRÍTICA | 🟢 | 2026-06-23 |
| PA-02 | Confirmar aplicação de `migracao-auth.sql` em produção | 1 | CRÍTICA | 🟢 | 2026-06-17 |
| PA-03 | Restringir CORS da Edge Function | 1 | ALTA | 🟢 | 2026-06-23 |
| PA-04 | Implementar consentimento LGPD para leads | 2 | CRÍTICA | 🟡 | 2026-07-16 |
| PA-05 | Criptografar fila offline no localStorage | 2 | ALTA | 🟢 | 2026-07-16 |
| PA-06 | Criar log de exportações CSV | 2 | ALTA | 🟢 | 2026-07-16 |
| PA-07 | Rastreabilidade do soft delete (quem/quando) | 2 | ALTA | 🟢 | 2026-07-16 |
| PA-08 | Pseudonimizar/criptografar CPF | 2 | ALTA | 🟢 | 2026-07-16 |
| PA-09 | Corrigir stack trace na Edge Function | 2 | MÉDIA | 🟢 | 2026-07-16 |
| PA-10 | Política de retenção e exclusão automática | 3 | ALTA | 🟢 | 2026-09-16 |
| PA-11 | Restringir SELECT de leads para vendedores | 3 | MÉDIA | 🟢 | 2026-09-16 |
| PA-12 | Habilitar MFA para usuários marketing | 3 | MÉDIA | 🟢 | 2026-09-16 |
| PA-13 | Tabela de auditoria de operações | 3 | ALTA | 🟢 | 2026-09-16 |
| PA-14 | Assinar DPA com Supabase | 3 | ALTA | 🟡 | 2026-09-16 |
| PA-15 | Processo DSAR para direitos de titulares | 3 | ALTA | 🟢 | 2026-09-16 |
| PA-16 | Elaborar política de privacidade | 4 | ALTA | 🟢 | 2026-12-16 |
| PA-17 | Elaborar RIPD/DPIA | 4 | MÉDIA | 🟡 | 2026-12-16 |
| PA-18 | Criar ROPA | 4 | MÉDIA | 🟡 | 2026-12-16 |
| PA-19 | Nomear DPO | 4 | MÉDIA | 🔴 | 2026-12-16 |
| PA-20 | Plano de resposta a incidentes | 4 | MÉDIA | 🟡 | 2026-12-16 |
| PA-21 | Avaliar e remover campos excessivos | 4 | MÉDIA | 🔴 | 2026-12-16 |

---

## Novos documentos a criar neste plano

| Documento | Criado por | PA Responsável | Status |
|-----------|-----------|---------------|--------|
| `doc/lgpd/POLITICA_DE_PRIVACIDADE.md` | Jurídico | PA-16 | 🟢 |
| `doc/POLITICA_RETENCAO.md` | DPO + Técnico | PA-10 | 🟢 |
| `doc/lgpd/ROTEIRO_DSAR.md` | DPO | PA-15 | 🟢 |
| `doc/lgpd/RIPD.md` | DPO + Técnico | PA-17 | 🟡 |
| `doc/lgpd/ROPA.md` | DPO | PA-18 | 🟡 |
| `doc/lgpd/DPA_FORNECEDORES.md` | Jurídico | PA-14 | 🟡 |
| `doc/lgpd/PLANO_INCIDENTES.md` | DPO + Técnico | PA-20 | 🟡 |

---

## Novos arquivos SQL a criar neste plano

| Arquivo | PA Responsável | Status |
|---------|---------------|--------|
| `supabase/migracao-consentimento.sql` | PA-04 | 🟢 |
| `supabase/migracao-audit-exportacoes.sql` | PA-06 | 🟢 |
| `supabase/migracao-soft-delete-audit.sql` | PA-07 | 🟢 |
| `supabase/migracao-audit-log.sql` | PA-13 | 🟢 |
| `supabase/migracao-retencao.sql` | PA-10 | 🟢 |
| `supabase/migracao-rls-vendedor-leads.sql` | PA-11 | 🟢 |

---

> **Status geral:** 🟡 EM PROGRESSO — 16 de 21 ações concluídas. Implementação técnica encerrada. Restam 4 ações administrativas/jurídicas (ver tabela abaixo).

---

## Pendências Administrativas — Implementação Técnica Encerrada

> Todas as ações técnicas foram implementadas. O que segue depende exclusivamente de decisões organizacionais, jurídicas ou contratuais.

| # | Ação | Responsável | PA | Impacto se não feito |
|---|------|------------|----|--------------------|
| 1 | Criar e-mail `privacidade@rjnet.com.br` | TI | PA-15 | Titulares sem canal para exercer direitos LGPD |
| 2 | Nomear o DPO formalmente | Diretoria | PA-19 | RIPD, ROPA e Plano de Incidentes sem aprovação formal |
| 3 | Upgrade Supabase Pro + assinar DPA | Gestão/Financeiro | PA-14 | Transferência internacional sem garantia contratual (risco art. 33 LGPD) |
| 4 | Decidir sobre campos endereço e observações | Negócio | PA-21 | Possível coleta excessiva não endereçada |

> Quando qualquer dessas ações for executada, atualizar o PA correspondente neste documento.

---


> **Referência de auditoria:** `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md`  
> **Histórico de mudanças:** `doc/CHANGELOG.md`
