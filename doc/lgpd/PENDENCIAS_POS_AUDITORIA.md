# PENDÊNCIAS PÓS-AUDITORIA LGPD
## RJNet Gestão de Eventos — O que ainda falta fazer

> **Gerado em:** 2026-06-16  
> **Origem:** Auditoria de validação pós-implementação (Claude Code)  
> **Referência completa:** `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` + `doc/lgpd/PLANO_DE_ACAO_LGPD.md`  
> **Nota de conformidade:** ver "NOTA GERAL" em `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` — fonte oficial do diagnóstico e da pontuação; não repetida aqui para evitar divergência entre os dois documentos.

---

## Situação atual em uma frase

**O plano de conformidade LGPD foi bem executado em documentação e código, mas vários artefatos SQL críticos ainda não foram aplicados ao banco de produção e ações organizacionais chave estão pendentes.**

---

## BLOCO 1 — EXECUTAR AGORA (técnico, sem dependência externa)

> Qualquer desenvolvedor ou operador pode executar. Tempo estimado: 1 hora total.

---

### 1.1 Aplicar migration de RLS para vendedores — ✅ CONCLUÍDO em 2026-07-07

**Arquivo:** `supabase/migracao-rls-vendedor-leads-v2.sql` (não a v1 — ver nota abaixo)
**Onde executar:** Supabase Dashboard → SQL Editor → Run  
**Tempo estimado:** 5 minutos

**Por que é urgente:** Em produção, vendedores leem os dados pessoais (nome, telefone, CPF, endereço, observação) de **todos os leads do sistema** — inclusive leads de colegas. O SQL corrige isso para que cada vendedor veja apenas os próprios leads.

**Nota (2026-07-07):** este item originalmente apontava para `migracao-rls-vendedor-leads.sql` (v1). Essa migration nunca foi aplicada em produção, e nesse meio-tempo `migracao-comercial.sql` (D-059) e `migracao-qrcode.sql` (D-061) — trabalho de feature, não de LGPD — reescreveram a mesma policy `leads_select` sem a restrição do PA-11. Aplicar a v1 isoladamente não resolve mais nada, porque a versão vigente da policy já é outra. Use a v2, que parte do estado atual e reaplica a restrição por cima dele. Detalhe completo em `doc/architecture/SUPABASE.md` (linha 20 da tabela de migrações) e `doc/lgpd/PLANO_DE_ACAO_LGPD.md` (PA-11).

**Como verificar depois:**
```sql
SELECT policyname, qual FROM pg_policies
WHERE tablename = 'leads' AND policyname = 'leads_select';
-- Deve conter "vendedor_id = auth.uid()" na condição do vendedor,
-- não "vendedor_id is not null"
```

**Confirmado em produção (2026-07-07):** verificação pós-aplicação retornou
`((deletado = false) AND ((papel_atual() = ANY (ARRAY['marketing'::text, 'comercial'::text])) OR ((papel_atual() = 'vendedor'::text) AND (vendedor_id = auth.uid()))))` — gap fechado.

---

### 1.2 Aplicar migration de audit log

**Arquivo:** `supabase/migracao-audit-log.sql`  
**Onde executar:** Supabase Dashboard → SQL Editor → Run  
**Tempo estimado:** 5 minutos

**Por que é urgente:** Em produção, nenhuma criação, edição ou exclusão de dados pessoais de leads é registrada. Sem esse log, é impossível responder a fiscalizações da ANPD ou investigar incidentes.

**Como verificar depois:**
```sql
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_name = 'audit_log'
) AS tabela_existe;

SELECT trigger_name FROM information_schema.triggers
WHERE trigger_name = 'audit_leads';
-- Ambos devem retornar resultado
```

---

### 1.3 Aplicar migration de retenção automática

**Arquivo:** `supabase/migracao-retencao.sql`  
**Onde executar:** Supabase Dashboard → SQL Editor → Run  
**Pré-requisito:** Habilitar extensão `pg_cron` primeiro (Dashboard → Database → Extensions → pg_cron → Enable)  
**Tempo estimado:** 10 minutos

**Por que é urgente:** Leads com `deletado = true` acumulam no banco indefinidamente. A LGPD exige eliminação após atingida a finalidade. Este SQL cria um job que roda todo dia às 02:00 BRT e exclui fisicamente:
- Leads com `deletado = true` há mais de 90 dias
- Leads de eventos encerrados há mais de 365 dias

**Como verificar depois:**
```sql
SELECT * FROM public.configuracoes_retencao;
-- Deve mostrar os prazos configurados

SELECT jobname, schedule FROM cron.job
WHERE jobname = 'limpar-leads-expirados';
-- Deve mostrar o job agendado
```

---

### 1.4 Configurar CORS da Edge Function e reimplantar

**Situação:** O código da Edge Function foi corrigido (CORS restrito), mas o secret não foi configurado e a função não foi reimplantada. Em produção, o CORS continua sem restrição efetiva.

**Passos:**

**Passo 1 — Configurar o secret no Dashboard:**
- Supabase Dashboard → Settings → Edge Functions → Secrets
- Adicionar secret: `CORS_ALLOWED_ORIGINS`
- Valor: `https://SEU_DOMINIO.vercel.app,http://localhost:3000`
- Substituir `SEU_DOMINIO` pelo domínio real do projeto na Vercel

**Passo 2 — Reimplantar a Edge Function:**
```bash
supabase functions deploy atualizar-email-usuario
```

**Como verificar depois:** Fazer uma chamada `OPTIONS` à Edge Function de uma origem não autorizada — deve retornar sem `Access-Control-Allow-Origin` para origens fora da lista.

---

### 1.5 Habilitar MFA no Supabase Dashboard

**Situação:** O fluxo de MFA (código TOTP) está implementado no app, mas a funcionalidade não foi habilitada no Supabase Dashboard. Nenhum usuário tem MFA ativo.

**Passos:**
1. Supabase Dashboard → Authentication → Multi-Factor Auth
2. Habilitar TOTP
3. Orientar todos os usuários com papel `marketing` a configurar um autenticador (Google Authenticator, Authy ou similar) no próximo login

**Como verificar:** Fazer login com um usuário marketing que já tenha configurado o autenticador — o app deve exibir a tela de código TOTP.

---

## BLOCO 2 — AÇÕES ORGANIZACIONAIS (requerem decisão ou contrato)

> Não são técnicas. Dependem de pessoas e processos externos ao código.

---

### 2.1 Criar e-mail privacidade@rjnet.com.br

**Responsável:** TI  
**Por que é necessário:** É o canal pelo qual titulares (leads captados em eventos) exercem os direitos da LGPD: pedir acesso aos dados, solicitar correção, pedir exclusão. O roteiro de atendimento já existe em `doc/lgpd/ROTEIRO_DSAR.md`. Falta o canal.

**O que fazer:** Criar a caixa de e-mail e definir responsável por monitorá-la. Prazo de resposta: 15 dias (conforme `doc/lgpd/ROTEIRO_DSAR.md`).

---

### 2.2 Assinar DPA com a Supabase Inc.

**Responsável:** Gestão / Financeiro / Jurídico  
**Por que é necessário:** Dados pessoais de cidadãos brasileiros (incluindo CPF, telefone, nome e endereço) estão armazenados em servidores da Supabase Inc. nos EUA. A LGPD (art. 33) exige garantias contratuais para essa transferência internacional.

**O que fazer:**
1. Fazer upgrade para o plano pago da Supabase (o DPA está disponível para clientes pagos)
2. Acessar https://supabase.com/privacy → Data Processing Agreement
3. Assinar o DPA
4. Preencher data e número do contrato em `doc/lgpd/DPA_FORNECEDORES.md`

---

### 2.3 Nomear o DPO (Encarregado de Proteção de Dados)

**Responsável:** Diretoria  
**Por que é necessário:** A LGPD (art. 41) exige a designação de um Encarregado. Sem DPO nomeado:
- Os documentos RIPD (`doc/lgpd/RIPD.md`), ROPA (`doc/lgpd/ROPA.md`) e Plano de Incidentes (`doc/lgpd/PLANO_INCIDENTES.md`) não têm aprovação formal
- A empresa não tem ponto de contato para a ANPD em caso de fiscalização
- O canal de privacidade fica sem responsável definido

**O que fazer:**
1. Nomear formalmente (pode ser interno ou externo)
2. Publicar nome e e-mail de contato do DPO
3. Atualizar PA-19 em `doc/lgpd/PLANO_DE_ACAO_LGPD.md` com o nome e contato
4. O DPO deve revisar e aprovar RIPD, ROPA e Plano de Incidentes

---

### 2.4 Publicar a Política de Privacidade externamente

**Responsável:** Marketing / TI  
**Por que é necessário:** A `doc/lgpd/POLITICA_DE_PRIVACIDADE.md` existe como documento interno, mas os titulares (leads captados em eventos) não têm como acessá-la. A LGPD (art. 9º) exige que o titular seja informado sobre o tratamento.

**O que fazer:**
1. Publicar a política no site da RJNet em URL fixa (ex: `rjnet.com.br/privacidade`)
2. Incluir o link nas fichas físicas de consentimento entregues nos eventos
3. Atualizar `doc/lgpd/POLITICA_DE_PRIVACIDADE.md` com a URL pública

---

### 2.5 Decidir sobre os campos `endereço` e `observação`

**Responsável:** Negócio / Jurídico  
**Por que é necessário:** Esses campos coletam dados pessoais sem avaliação formal de proporcionalidade registrada. A LGPD exige que cada dado coletado tenha finalidade necessária e proporcional (art. 6º, III).

**O que fazer (reunião com time de negócio):**

| Campo | Pergunta a responder | Decisão possível |
|---|---|---|
| `endereço` | O endereço é verificado no momento da captação para checar cobertura, ou apenas depois? A coleta é proporcional à finalidade? | Manter com justificativa formal **ou** remover e verificar cobertura de outra forma |
| `observação` (texto livre) | Existe necessidade de campo sem estrutura? Dados sensíveis não planejados são inseridos? | Manter **ou** substituir por campos estruturados **ou** adicionar orientação explícita ao vendedor |

Registrar a decisão em `doc/architecture/DECISIONS.md` e atualizar PA-21 em `doc/lgpd/PLANO_DE_ACAO_LGPD.md`.

---

## BLOCO 3 — VALIDAÇÃO DE LEADS HISTÓRICOS

> Situação especial que requer decisão.

Os **70 leads em produção** (coletados antes de 2026-06-16) têm `consentimento_coletado = false`. Eles foram coletados sem o mecanismo de consentimento implementado em PA-04.

**Opções:**

| Opção | Impacto | Complexidade |
|---|---|---|
| **A) Manter e documentar como risco aceito** | Risco regulatório residual para os registros históricos | Baixa |
| **B) Excluir fisicamente todos os leads históricos** | Elimina o risco, mas perde dados comerciais | Baixa (1 query SQL) |
| **C) Coletar consentimento retroativo** | Impraticável para dados já captados em eventos passados | Alta / impraticável |

**Recomendação:** Definir com jurídico qual opção seguir e registrar em `doc/architecture/DECISIONS.md`.

---

## RESUMO EXECUTIVO — CHECKLIST

```
BLOCO 1 — TÉCNICO (executar no Supabase Dashboard / terminal)
═══════════════════════════════════════════════════════════════
[x] 1.1  Executar migracao-rls-vendedor-leads-v2.sql      ~5 min — CONCLUÍDO 2026-07-07
[ ] 1.2  Executar migracao-audit-log.sql                 ~5 min
[ ] 1.3  Habilitar pg_cron + executar migracao-retencao.sql  ~10 min
[ ] 1.4  Configurar secret CORS_ALLOWED_ORIGINS + deploy Edge Function  ~15 min
[ ] 1.5  Habilitar TOTP no Dashboard + orientar usuários marketing  ~10 min

BLOCO 2 — ORGANIZACIONAL (requer pessoas e processos)
═══════════════════════════════════════════════════════════════
[ ] 2.1  Criar e-mail privacidade@rjnet.com.br                (TI)
[ ] 2.2  Assinar DPA com Supabase Inc.            (Gestão/Financeiro)
[ ] 2.3  Nomear DPO e publicar contato                   (Diretoria)
[ ] 2.4  Publicar Política de Privacidade externamente  (Marketing/TI)
[ ] 2.5  Decidir sobre campos endereço e observação  (Negócio/Jurídico)

BLOCO 3 — DECISÃO ESPECIAL
═══════════════════════════════════════════════════════════════
[ ] 3.1  Definir tratamento dos 70 leads históricos sem consentimento
```

---

## IMPACTO ESPERADO NA NOTA DE CONFORMIDADE

> A nota de "situação atual" não é repetida aqui — ver "NOTA GERAL" em `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` (fonte oficial). As estimativas de nota após cada bloco abaixo são projeções deste documento (2026-06-16), não recalculadas desde então.

| Após concluir | Nota estimada | Nível |
|---|:---:|---|
| Bloco 1 (técnico) concluído | 7,9 / 10 | Avançado |
| Bloco 1 + Bloco 2 + Bloco 3 concluídos | 9,1 / 10 | Avançado |

---

## REFERÊNCIAS

| Documento | Conteúdo |
|---|---|
| `doc/lgpd/PLANO_DE_ACAO_LGPD.md` | Plano de ação completo com todas as 21 ações (PA-01 a PA-21) |
| `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md` | Auditoria completa com não conformidades e histórico de implementações |
| `doc/lgpd/ROTEIRO_DSAR.md` | Queries SQL e processo para atender direitos de titulares |
| `doc/architecture/SUPABASE.md` | Ordem das migrações, checklist de segurança pré-produção e configuração MFA |
| `doc/lgpd/DPA_FORNECEDORES.md` | Registro de fornecedores — preencher com data/número do DPA após assinatura |
| `doc/lgpd/RIPD.md` | Relatório de Impacto — pendente aprovação do DPO |
| `doc/lgpd/ROPA.md` | Registro de Operações — pendente validação do DPO |
| `doc/lgpd/PLANO_INCIDENTES.md` | Plano de Resposta a Incidentes — pendente aprovação do DPO |
| `doc/lgpd/POLITICA_DE_PRIVACIDADE.md` | Política de Privacidade v1.0 — pendente publicação externa |

---

> **Este documento deve ser atualizado** à medida que cada item for concluído.  
> Ao concluir uma ação, marque o checkbox correspondente e registre a data.  
> Qualquer dúvida técnica: consultar `doc/lgpd/PLANO_DE_ACAO_LGPD.md` para o detalhamento completo da ação.
