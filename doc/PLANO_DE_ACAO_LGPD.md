# PLANO_DE_ACAO_LGPD.md
## RJNet Gestão de Eventos — Plano de Ação Executável de Conformidade

> **Versão:** 1.0.0  
> **Criado em:** 2026-06-16  
> **Origem:** `doc/LGPD_AUDIT_AND_COMPLIANCE.md` — auditoria completa de LGPD, segurança e governança  
> **Responsável:** A definir (DPO / responsável técnico)  
> **Status geral:** 🟡 EM PROGRESSO — 1 de 21 ações concluídas

---

## Como usar este documento

- Cada ação tem um **ID único** (ex: `PA-01`) referenciado na auditoria
- Ao concluir uma ação, atualize o **Status**, **Data de conclusão** e **Evidência**
- Registre decisões técnicas relevantes em `doc/DECISIONS.md`
- Registre mudanças de código em `doc/CHANGELOG.md`
- Atualize `doc/LGPD_AUDIT_AND_COMPLIANCE.md` quando a não conformidade for sanada
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
- [x] `doc/DECISIONS.md` — registrar decisão sobre modo legado (D-032)
- [x] `doc/CHANGELOG.md` — registrar a mudança (v1.7)
- [x] `doc/LGPD_AUDIT_AND_COMPLIANCE.md` — S-01 marcado como resolvido (seção 12.2 e 12.6)

**Evidência de conclusão:**
- `vite.config.js`: plugin `lgpdCredentialGuard` — aborta `npm run build` com `NODE_ENV=production` se `VITE_MARKETING_PASS` estiver definida; emite `console.warn` em dev
- `src/auth/Login.jsx`: guard de runtime com `import.meta.env.PROD`; objeto `AUTH` removido; credenciais lidas dentro do handler `submit()` (não exportadas)
- `src/auth/index.js`: re-export de `AUTH` removido
- `.env.example`: aviso explícito adicionado — `VITE_MARKETING_PASS` é variável de desenvolvimento exclusivamente
- Decisão D-032 registrada em `doc/DECISIONS.md`

---

### PA-02 — Confirmar e documentar aplicação do `migracao-auth.sql` em produção

| Campo | Valor |
|-------|-------|
| **Status** | 🔴 Em aberto |
| **Prioridade** | CRÍTICA |
| **ID Auditoria** | BD-01, SB-01 |
| **Não conformidade** | Políticas anônimas do bootstrap `schema.sql` dão acesso público total se a migração não foi aplicada |
| **Impacto** | Qualquer pessoa com a anon key (pública) acessa CPF, telefone e dados de todos os leads |
| **Responsável** | — |
| **Prazo** | 2026-06-17 |
| **Data de conclusão** | — |

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
- [ ] Este documento — preencher evidência
- [ ] `doc/SUPABASE.md` — adicionar seção de verificação de estado das migrações

**Evidência de conclusão:** _Preencher aqui com resultado das queries_

---

### PA-03 — Restringir CORS da Edge Function ao domínio da aplicação

| Campo | Valor |
|-------|-------|
| **Status** | 🔴 Em aberto |
| **Prioridade** | ALTA |
| **ID Auditoria** | S-04 |
| **Não conformidade** | `Access-Control-Allow-Origin: *` na Edge Function administrativa |
| **Impacto** | Qualquer origem pode invocar criação/exclusão de usuários (desde que tenha token válido) |
| **Responsável** | — |
| **Prazo** | 2026-06-23 |
| **Data de conclusão** | — |

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
- [ ] `doc/CHANGELOG.md`
- [ ] `doc/LGPD_AUDIT_AND_COMPLIANCE.md` — marcar S-04 e S-05 como resolvidos

**Evidência de conclusão:** _Preencher aqui_

---

## FASE 2 — Curto Prazo (7–30 dias)

> Correções técnicas que reduzem risco de vazamento e melhoram rastreabilidade.

---

### PA-04 — Implementar mecanismo de consentimento LGPD para captação de leads

| Campo | Valor |
|-------|-------|
| **Status** | 🔴 Em aberto |
| **Prioridade** | CRÍTICA (LGPD) |
| **ID Auditoria** | L-01, L-02, L-03 |
| **Não conformidade** | Dados pessoais coletados sem consentimento, sem informação ao titular |
| **Impacto** | Ilegalidade do tratamento — risco de autuação pela ANPD e ações de titulares |
| **Responsável** | — |
| **Prazo** | 2026-07-16 |
| **Data de conclusão** | — |

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
- [ ] `doc/DECISIONS.md` — registrar decisão entre Opção A e B
- [ ] `doc/CHANGELOG.md`
- [ ] `doc/LGPD_AUDIT_AND_COMPLIANCE.md` — atualizar seção 3.3 e marcar L-01, L-02 como resolvidos
- [ ] Criar/atualizar `doc/POLITICA_DE_PRIVACIDADE.md` (ver PA-16)

**Evidência de conclusão:** _Preencher aqui_

---

### PA-05 — Criptografar dados da fila offline no localStorage

| Campo | Valor |
|-------|-------|
| **Status** | 🔴 Em aberto |
| **Prioridade** | ALTA |
| **ID Auditoria** | S-02 |
| **Não conformidade** | Leads capturados offline (incluindo CPF e telefone) armazenados em texto plano no localStorage |
| **Impacto** | Dados pessoais expostos no dispositivo do vendedor se não houver bloqueio de tela |
| **Responsável** | — |
| **Prazo** | 2026-07-16 |
| **Data de conclusão** | — |

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
- [ ] `doc/SYSTEM_MAP.md` — adicionar `src/lib/crypto.js` na estrutura
- [ ] `doc/CHANGELOG.md`
- [ ] `doc/LGPD_AUDIT_AND_COMPLIANCE.md` — marcar S-02 como resolvido

**Evidência de conclusão:** _Preencher aqui_

---

### PA-06 — Criar log de exportações CSV

| Campo | Valor |
|-------|-------|
| **Status** | 🔴 Em aberto |
| **Prioridade** | ALTA |
| **ID Auditoria** | A-01, L-08 |
| **Não conformidade** | Exportações de dados pessoais sem qualquer log ou rastreabilidade |
| **Impacto** | Impossibilidade de auditar vazamentos; não conformidade com princípio de segurança LGPD |
| **Responsável** | — |
| **Prazo** | 2026-07-16 |
| **Data de conclusão** | — |

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
- [ ] `doc/SUPABASE.md` — documentar nova tabela
- [ ] `doc/CHANGELOG.md`
- [ ] `doc/LGPD_AUDIT_AND_COMPLIANCE.md` — marcar A-01, L-08 como resolvidos

**Evidência de conclusão:** _Preencher aqui_

---

### PA-07 — Adicionar rastreabilidade ao soft delete de leads

| Campo | Valor |
|-------|-------|
| **Status** | 🔴 Em aberto |
| **Prioridade** | ALTA |
| **ID Auditoria** | BD-06, A-03 |
| **Não conformidade** | Soft delete sem registro de quem excluiu e quando |
| **Impacto** | Impossibilidade de auditar exclusões; não conformidade com rastreabilidade LGPD |
| **Responsável** | — |
| **Prazo** | 2026-07-16 |
| **Data de conclusão** | — |

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
- [ ] `doc/SUPABASE.md`
- [ ] `doc/CHANGELOG.md`
- [ ] `doc/LGPD_AUDIT_AND_COMPLIANCE.md` — marcar BD-06, A-03 como resolvidos

**Evidência de conclusão:** _Preencher aqui_

---

### PA-08 — Pseudonimizar ou criptografar CPF no banco de dados

| Campo | Valor |
|-------|-------|
| **Status** | 🔴 Em aberto |
| **Prioridade** | ALTA |
| **ID Auditoria** | BD-02, L-03 |
| **Não conformidade** | CPF armazenado em texto plano; coleta possivelmente excessiva |
| **Impacto** | Em caso de vazamento, CPF é dado pessoal com alto potencial de dano |
| **Responsável** | — |
| **Prazo** | 2026-07-16 |
| **Data de conclusão** | — |

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
- [ ] `doc/DECISIONS.md` — registrar decisão entre as opções
- [ ] `doc/SUPABASE.md`
- [ ] `doc/CHANGELOG.md`
- [ ] `doc/LGPD_AUDIT_AND_COMPLIANCE.md` — marcar BD-02, L-03

**Evidência de conclusão:** _Preencher aqui_

---

### PA-09 — Corrigir stack trace exposto na Edge Function

| Campo | Valor |
|-------|-------|
| **Status** | 🔴 Em aberto |
| **Prioridade** | MÉDIA |
| **ID Auditoria** | S-05 |
| **Não conformidade** | `String(err)` em resposta 500 pode vazar informações internas |
| **Responsável** | — |
| **Prazo** | 2026-07-16 |
| **Data de conclusão** | — |

**O que fazer:**

Editar `supabase/functions/atualizar-email-usuario/index.ts`, bloco catch final:
```typescript
// Antes
return json({ error: String(err) }, 500);

// Depois
console.error('[rjnet:edge] Erro não tratado:', err);
return json({ error: 'Erro interno. Contate o suporte.' }, 500);
```

**Evidência de conclusão:** _Preencher aqui_

---

## FASE 3 — Médio Prazo (30–90 dias)

> Conformidade estrutural: auditoria de operações, retenção, minimização e RBAC.

---

### PA-10 — Implementar política de retenção de dados com exclusão automática

| Campo | Valor |
|-------|-------|
| **Status** | 🔴 Em aberto |
| **Prioridade** | ALTA (LGPD) |
| **ID Auditoria** | L-04, BD-05, L-06 |
| **Não conformidade** | Sem política de retenção — leads retidos indefinidamente mesmo após soft delete |
| **Responsável** | — |
| **Prazo** | 2026-09-16 |
| **Data de conclusão** | — |

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
- [ ] Novo: `doc/POLITICA_RETENCAO.md`
- [ ] `doc/LGPD_AUDIT_AND_COMPLIANCE.md`
- [ ] `doc/SUPABASE.md`
- [ ] `doc/CHANGELOG.md`

**Evidência de conclusão:** _Preencher aqui_

---

### PA-11 — Restringir SELECT de leads para vendedores (minimização de acesso)

| Campo | Valor |
|-------|-------|
| **Status** | 🔴 Em aberto |
| **Prioridade** | MÉDIA |
| **ID Auditoria** | SB-04 (RLS), princípio da minimização LGPD |
| **Não conformidade** | Vendedor lê CPF, telefone e endereço de leads de colegas |
| **Responsável** | — |
| **Prazo** | 2026-09-16 |
| **Data de conclusão** | — |

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
- [ ] `supabase/migracao-auth.sql` ou novo SQL
- [ ] `doc/SUPABASE.md`
- [ ] `doc/CHANGELOG.md`
- [ ] `doc/LGPD_AUDIT_AND_COMPLIANCE.md`

**Evidência de conclusão:** _Preencher aqui_

---

### PA-12 — Habilitar MFA (autenticação multifator)

| Campo | Valor |
|-------|-------|
| **Status** | 🔴 Em aberto |
| **Prioridade** | MÉDIA |
| **ID Auditoria** | S-03 |
| **Não conformidade** | Sem segundo fator de autenticação |
| **Responsável** | — |
| **Prazo** | 2026-09-16 |
| **Data de conclusão** | — |

**O que fazer:**

1. Habilitar TOTP MFA no Supabase Dashboard → Authentication → Multi-Factor Auth
2. Adaptar `src/auth/LoginAuth.jsx` para tratar o fluxo de desafio MFA quando o usuário tiver o fator configurado
3. Tornar MFA obrigatório apenas para usuários `marketing` (que têm acesso a todos os dados)
4. Documentar o processo de configuração para os usuários de marketing em `doc/SUPABASE.md`

**Evidência de conclusão:** _Preencher aqui_

---

### PA-13 — Criar tabela de auditoria de operações em dados pessoais

| Campo | Valor |
|-------|-------|
| **Status** | 🔴 Em aberto |
| **Prioridade** | ALTA |
| **ID Auditoria** | A-02, A-04, A-05, BD-04 |
| **Não conformidade** | Sem log de edições, acessos e alterações de permissões |
| **Responsável** | — |
| **Prazo** | 2026-09-16 |
| **Data de conclusão** | — |

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
- [ ] `doc/SUPABASE.md`
- [ ] `doc/CHANGELOG.md`
- [ ] `doc/LGPD_AUDIT_AND_COMPLIANCE.md` — marcar A-02, A-04, A-05, BD-04

**Evidência de conclusão:** _Preencher aqui_

---

### PA-14 — Assinar DPA com Supabase Inc. e documentar transferência internacional

| Campo | Valor |
|-------|-------|
| **Status** | 🔴 Em aberto |
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

5. Criar seção em `doc/LGPD_AUDIT_AND_COMPLIANCE.md` documentando o DPA

**Documentação a atualizar após conclusão:**
- [ ] `doc/LGPD_AUDIT_AND_COMPLIANCE.md` — marcar L-07, I-01
- [ ] Novo: `doc/DPA_FORNECEDORES.md` — registro de todos os DPAs

**Evidência de conclusão:** _Número/data do DPA assinado com Supabase_

---

### PA-15 — Criar processo de atendimento a direitos de titulares (DSAR)

| Campo | Valor |
|-------|-------|
| **Status** | 🔴 Em aberto |
| **Prioridade** | ALTA (LGPD) |
| **ID Auditoria** | L-05 |
| **Não conformidade** | Sem mecanismo para titulares exercerem direitos do art. 18 LGPD |
| **Responsável** | — |
| **Prazo** | 2026-09-16 |
| **Data de conclusão** | — |

**O que fazer:**

1. Definir canal de contato para titulares (e-mail dedicado: privacidade@rjnet.com.br ou similar)

2. Criar roteiro operacional para cada direito:

   **Direito de acesso (art. 18, I):** Query para buscar todos os dados de um titular por CPF ou telefone
   **Direito de correção (art. 18, III):** Processo de atualização via painel de marketing
   **Direito de exclusão (art. 18, VI):** Processo de hard delete do registro (não apenas soft delete)
   **Direito de portabilidade (art. 18, V):** Exportação individual dos dados do titular em JSON/CSV
   **Direito de revogação de consentimento (art. 18, IX):** Exclusão do registro + bloqueio de recontato

3. Criar queries SQL padrão para cada operação e documentar em `doc/ROTEIRO_DSAR.md`

4. Definir prazo de resposta: 15 dias (recomendado) conforme boas práticas ANPD

**Documentação a atualizar após conclusão:**
- [ ] Novo: `doc/ROTEIRO_DSAR.md`
- [ ] `doc/LGPD_AUDIT_AND_COMPLIANCE.md` — marcar L-05

**Evidência de conclusão:** _Link para o e-mail/canal de contato publicado_

---

## FASE 4 — Longo Prazo (90+ dias)

> Governança, documentação legal e maturidade contínua.

---

### PA-16 — Elaborar e publicar Política de Privacidade

| Campo | Valor |
|-------|-------|
| **Status** | 🔴 Em aberto |
| **Prioridade** | ALTA |
| **ID Auditoria** | G-01, L-02 |
| **Não conformidade** | Sistema sem política de privacidade — não existe documentação pública sobre o tratamento de dados |
| **Responsável** | — (jurídico) |
| **Prazo** | 2026-12-16 |
| **Data de conclusão** | — |

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

2. Versionar a política (v1.0, v1.1 etc.) e armazenar em `doc/POLITICA_DE_PRIVACIDADE.md`

3. Referenciar a versão vigente no campo `versao_termo` ao coletar consentimento (ver PA-04)

**Documentação a atualizar após conclusão:**
- [ ] Novo: `doc/POLITICA_DE_PRIVACIDADE.md`
- [ ] `doc/LGPD_AUDIT_AND_COMPLIANCE.md` — marcar G-01, L-02

**Evidência de conclusão:** _URL ou path do documento publicado_

---

### PA-17 — Elaborar RIPD (Relatório de Impacto à Proteção de Dados)

| Campo | Valor |
|-------|-------|
| **Status** | 🔴 Em aberto |
| **Prioridade** | MÉDIA |
| **ID Auditoria** | L-09 |
| **Responsável** | — (DPO + técnico) |
| **Prazo** | 2026-12-16 |
| **Data de conclusão** | — |

**O que fazer:**

Elaborar RIPD/DPIA para o tratamento de dados de leads em eventos, cobrindo:
1. Descrição sistemática do tratamento
2. Avaliação de necessidade e proporcionalidade
3. Avaliação dos riscos para os direitos e liberdades dos titulares
4. Medidas de mitigação adotadas
5. Parecer do DPO

Armazenar em `doc/RIPD.md`.

**Evidência de conclusão:** _Documento RIPD aprovado_

---

### PA-18 — Criar e manter ROPA (Registro de Operações de Tratamento)

| Campo | Valor |
|-------|-------|
| **Status** | 🔴 Em aberto |
| **Prioridade** | MÉDIA |
| **ID Auditoria** | L-10 |
| **Responsável** | — (DPO) |
| **Prazo** | 2026-12-16 |
| **Data de conclusão** | — |

**O que fazer:**

Criar `doc/ROPA.md` contendo, para cada operação de tratamento:
- Finalidade
- Base legal
- Categorias de titulares
- Categorias de dados
- Destinatários
- Transferências internacionais
- Prazo de retenção
- Medidas de segurança

**Evidência de conclusão:** _Documento ROPA criado e validado pelo DPO_

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
| **Status** | 🔴 Em aberto |
| **Prioridade** | MÉDIA |
| **ID Auditoria** | G-03 |
| **Responsável** | — (DPO + técnico) |
| **Prazo** | 2026-12-16 |
| **Data de conclusão** | — |

**O que fazer:**

Elaborar `doc/PLANO_INCIDENTES.md` cobrindo:
1. Definição de incidente de dados (vazamento, acesso não autorizado, perda, etc.)
2. Procedimento de contenção imediata
3. Avaliação de impacto
4. Notificação à ANPD em até 72h (art. 48 LGPD) — quando obrigatório
5. Notificação aos titulares afetados
6. Registro do incidente
7. Lições aprendidas e medidas corretivas

**Evidência de conclusão:** _Documento aprovado + simulação de tabletop exercise_

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

3. Registrar a decisão em `doc/DECISIONS.md`

**Evidência de conclusão:** _Decisão registrada em DECISIONS.md + campos removidos se aplicável_

---

## Painel de Status Consolidado

| ID | Ação | Fase | Prioridade | Status | Prazo |
|----|------|------|-----------|--------|-------|
| PA-01 | Remover senha de marketing do bundle JS | 1 | CRÍTICA | 🟢 | 2026-06-23 |
| PA-02 | Confirmar aplicação de `migracao-auth.sql` em produção | 1 | CRÍTICA | 🔴 | 2026-06-17 |
| PA-03 | Restringir CORS da Edge Function | 1 | ALTA | 🔴 | 2026-06-23 |
| PA-04 | Implementar consentimento LGPD para leads | 2 | CRÍTICA | 🔴 | 2026-07-16 |
| PA-05 | Criptografar fila offline no localStorage | 2 | ALTA | 🔴 | 2026-07-16 |
| PA-06 | Criar log de exportações CSV | 2 | ALTA | 🔴 | 2026-07-16 |
| PA-07 | Rastreabilidade do soft delete (quem/quando) | 2 | ALTA | 🔴 | 2026-07-16 |
| PA-08 | Pseudonimizar/criptografar CPF | 2 | ALTA | 🔴 | 2026-07-16 |
| PA-09 | Corrigir stack trace na Edge Function | 2 | MÉDIA | 🔴 | 2026-07-16 |
| PA-10 | Política de retenção e exclusão automática | 3 | ALTA | 🔴 | 2026-09-16 |
| PA-11 | Restringir SELECT de leads para vendedores | 3 | MÉDIA | 🔴 | 2026-09-16 |
| PA-12 | Habilitar MFA para usuários marketing | 3 | MÉDIA | 🔴 | 2026-09-16 |
| PA-13 | Tabela de auditoria de operações | 3 | ALTA | 🔴 | 2026-09-16 |
| PA-14 | Assinar DPA com Supabase | 3 | ALTA | 🔴 | 2026-09-16 |
| PA-15 | Processo DSAR para direitos de titulares | 3 | ALTA | 🔴 | 2026-09-16 |
| PA-16 | Elaborar política de privacidade | 4 | ALTA | 🔴 | 2026-12-16 |
| PA-17 | Elaborar RIPD/DPIA | 4 | MÉDIA | 🔴 | 2026-12-16 |
| PA-18 | Criar ROPA | 4 | MÉDIA | 🔴 | 2026-12-16 |
| PA-19 | Nomear DPO | 4 | MÉDIA | 🔴 | 2026-12-16 |
| PA-20 | Plano de resposta a incidentes | 4 | MÉDIA | 🔴 | 2026-12-16 |
| PA-21 | Avaliar e remover campos excessivos | 4 | MÉDIA | 🔴 | 2026-12-16 |

---

## Novos documentos a criar neste plano

| Documento | Criado por | PA Responsável | Status |
|-----------|-----------|---------------|--------|
| `doc/POLITICA_DE_PRIVACIDADE.md` | Jurídico | PA-16 | 🔴 |
| `doc/POLITICA_RETENCAO.md` | DPO + Técnico | PA-10 | 🔴 |
| `doc/ROTEIRO_DSAR.md` | DPO | PA-15 | 🔴 |
| `doc/RIPD.md` | DPO + Técnico | PA-17 | 🔴 |
| `doc/ROPA.md` | DPO | PA-18 | 🔴 |
| `doc/DPA_FORNECEDORES.md` | Jurídico | PA-14 | 🔴 |
| `doc/PLANO_INCIDENTES.md` | DPO + Técnico | PA-20 | 🔴 |

---

## Novos arquivos SQL a criar neste plano

| Arquivo | PA Responsável | Status |
|---------|---------------|--------|
| `supabase/migracao-consentimento.sql` | PA-04 | 🔴 |
| `supabase/migracao-audit-exportacoes.sql` | PA-06 | 🔴 |
| `supabase/migracao-soft-delete-audit.sql` | PA-07 | 🔴 |
| `supabase/migracao-audit-log.sql` | PA-13 | 🔴 |
| `supabase/migracao-retencao.sql` | PA-10 | 🔴 |

---

> **Próxima revisão do plano:** 2026-07-16 (após Fase 2)  
> **Referência de auditoria:** `doc/LGPD_AUDIT_AND_COMPLIANCE.md`  
> **Histórico de mudanças:** `doc/CHANGELOG.md`
