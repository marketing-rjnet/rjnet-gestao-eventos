# Integração Supabase

O app sincroniza eventos, leads, estoque e equipe com o Supabase quando as
credenciais estão configuradas. **Sem credenciais, nada quebra**: ele continua
funcionando 100% com `localStorage`, como antes.

## Como ativar (5 minutos)

1. **Crie o projeto** em [supabase.com](https://supabase.com) (plano gratuito serve).

2. **Crie as tabelas**: no Dashboard, abra **SQL Editor**, cole o conteúdo de
   [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**. Isso cria
   as 4 tabelas (`eventos`, `leads`, `materiais`, `vendedores`), ativa o
   realtime e já popula o estoque e a equipe iniciais.

3. **Pegue as credenciais**: em **Settings → API**, copie a **Project URL** e a
   **anon public key**.

4. **Configure as variáveis**:
   - **Local**: copie `.env.example` para `.env.local` e preencha:
     ```
     VITE_SUPABASE_URL=https://seu-projeto.supabase.co
     VITE_SUPABASE_ANON_KEY=sua-chave-anonima
     ```
   - **Vercel**: em **Settings → Environment Variables**, adicione as duas
     variáveis acima e faça um redeploy.

5. Pronto. Abra o app — o console deve **não** mostrar a mensagem
   "Supabase não configurado".

## Como funciona

- **Carga inicial**: ao abrir o app, os dados vêm do Supabase e substituem o
  cache local.
- **Escritas otimistas**: toda ação (novo lead, evento, etc.) atualiza a tela
  na hora e envia ao banco em segundo plano. Se a sincronização falhar, o dado
  fica salvo localmente e um aviso é exibido.
- **Realtime**: mudanças feitas em outro dispositivo aparecem automaticamente
  (ex.: vendedor cadastra lead no celular → aparece no painel do marketing).

Arquivos relevantes:

| Arquivo | Função |
|---|---|
| `src/lib/supabase.js` | Cria o client a partir das env vars |
| `src/lib/dataService.js` | Queries, mapeamento camelCase ↔ snake_case e realtime |
| `supabase/schema.sql` | Schema completo + seed |

## Login individual e papéis (Supabase Auth)

Cada pessoa entra com o próprio e-mail e senha. O papel define a área:

| Papel | Área | Permissões no banco |
|---|---|---|
| `marketing` | Painel completo + gestão de usuários | Tudo |
| `comercial` | Início/Eventos/Ofertas/Relatórios (`ComercialApp.jsx`) | Mesmo nível de `marketing` em `eventos`/`ofertas`/`leads` (inclusive leads de qualquer vendedor); **sem** escrita em `materiais` (estoque) nem em `perfis` (gestão de equipe) — D-059 |
| `vendedor` | Tela de registro de leads | Insere/vê/edita **apenas os próprios leads**; placar da equipe vem agregado do servidor; leads de QR Code/Formulário sem `vendedor_id` ficam invisíveis até a distribuição manual (D-061) |

### Como ativar (depois do schema.sql)

1. **Rode a migração**: SQL Editor → cole [`supabase/migracao-auth.sql`](supabase/migracao-auth.sql) → Run.
   Isso cria a tabela `perfis`, remove o acesso anônimo e instala as regras por papel.

2. **Crie o primeiro administrador**:
   - Dashboard → **Authentication → Users → Add user** → seu e-mail e senha,
     marcando **Auto Confirm User**
   - SQL Editor:
     ```sql
     update public.perfis set papel = 'marketing', ativo = true
       where email = 'seu@email.com';
     ```

3. **Desative a confirmação de e-mail** (os usuários são criados pelo
   marketing): Dashboard → **Authentication → Sign In / Up → Email** →
   desmarque **Confirm email**.

4. Pronto. No app, a aba **Equipe** do marketing passa a criar/ativar/desativar
   usuários e definir papéis.

Notas:
- Usuário desativado não acessa nada — o banco nega tudo na hora.
- "Esqueci minha senha" envia link por e-mail (o e-mail nativo do Supabase tem
  limite baixo por hora; configure SMTP próprio se a equipe crescer).
- Leads antigos (registrados antes da migração) continuam visíveis para o
  marketing, mas não aparecem na tela do vendedor — eles não têm
  vínculo com o usuário novo.

## Usuários de teste por área

Para validar as permissões em ambiente de desenvolvimento/homologação, crie os
três usuários abaixo no painel **Authentication → Users** (marque **Auto Confirm
User** em cada um) e depois rode o script
[`supabase/seed-usuarios-teste.sql`](supabase/seed-usuarios-teste.sql) no SQL
Editor para ativar os perfis:

| E-mail | Senha sugerida | Papel | Área |
|---|---|---|---|
| `teste.marketing@rjnet.com.br` | `Teste@Marketing1` | `marketing` | Painel completo + gestão de usuários |
| `teste.vendedor@rjnet.com.br` | `Teste@Vendedor1` | `vendedor` | Registro e gestão dos próprios leads |

> **Atenção**: use estas credenciais apenas em projetos de teste. Nunca reutilize
> senhas de exemplo em produção.
>
> **Gap conhecido:** `supabase/seed-usuarios-teste.sql` ainda não ativa um perfil `comercial` (D-059) — para testar esse papel, crie o usuário manualmente no Dashboard e rode `update public.perfis set papel = 'comercial', ativo = true where email = '...'`.

## Segurança

Com a migração de auth aplicada, **a anon key sozinha não dá acesso a leads,
eventos, materiais ou perfis**: todas as policies dessas tabelas exigem usuário
autenticado e ativo, e o que cada um vê/edita é decidido pelo banco (RLS), não
pelo front. Quem se auto-cadastrar pela API fica com perfil inativo até o
marketing ativar.

**Exceção deliberada (D-062):** `formularios` e `campos_personalizados` têm
policies `anon` de **leitura**, restritas a `ativo=true` — são as primeiras
(e únicas) tabelas do projeto com acesso anônimo, necessárias para a página
pública `/f/:slug` renderizar sem sessão. Não expõem dado pessoal de titular
(só metadado do formulário: nome, campos habilitados). A **escrita** de leads
públicos nunca passa pela `anon key` — vai pela Edge Function
`submeter-formulario`, que usa `service_role` no servidor.

Nunca use a **service_role key** no front-end.

---

## Verificação de estado das migrações (PA-02)

Use o script `supabase/verificar-migracao-auth.sql` para confirmar que todas as migrações obrigatórias foram aplicadas.

**Como executar:** Supabase Dashboard → SQL Editor → cole o conteúdo do script → Run.

**Resultado esperado (produção correta):**

| Bloco | Verificação | Resultado esperado |
|-------|------------|-------------------|
| 1 | Políticas anônimas | **0 linhas** (se retornar linhas, migração não aplicada) |
| 2 | Tabela `perfis` existe | **true** |
| 3 | Coluna `deletado` em `leads` | **1 linha** |
| 4 | Coluna `vendedor_id` em `leads` | **1 linha** |
| 5 | Função `papel_atual()` | **1 linha** |
| 6 | Função `ranking_evento()` | **1 linha** |
| 7 | Policies por papel | **≥ 8 linhas** com `authenticated` |

**Se falhar:** execute as migrações em falta na ordem definida abaixo e reexecute o script.

---

## Checklist de segurança pré-produção

Execute este checklist antes de qualquer go-live ou atualização relevante:

- [ ] `supabase/schema.sql` aplicado
- [ ] `supabase/migracao-auth.sql` aplicado (remove acesso anônimo)
- [ ] `supabase/protecao-dados.sql` aplicado (soft delete)
- [ ] Script `supabase/verificar-migracao-auth.sql` executado e todos os blocos validados
- [ ] Primeiro usuário marketing criado e ativado
- [x] Variáveis `VITE_MARKETING_USER` e `VITE_MARKETING_PASS` **não definidas** em produção (PA-01 — guard implementado em `vite.config.js`)
- [ ] MFA habilitado no Dashboard para usuários marketing (PA-12 — UI implementada; habilitar em Authentication → Multi-Factor Auth)

**Query rápida de verificação de policies anônimas:**
```sql
SELECT tablename, policyname, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND roles @> ARRAY['anon'];
-- Resultado esperado em produção (após D-062): só policies de leitura em
-- `formularios` e `campos_personalizados` (restritas a ativo=true).
-- Qualquer outra tabela com policy `anon` é um problema — migração de auth
-- não aplicada corretamente ou vazamento de acesso.
```

**Query de verificação de EXECUTE anônimo em funções** (não aparece na query acima — `pg_policies` só cobre RLS de tabela, não grants de função):
```sql
SELECT routine_name, grantee, privilege_type
FROM information_schema.role_routine_grants
WHERE grantee IN ('anon', 'public');
-- Resultado esperado em produção (após D-089): só
-- `timer_challenge_painel_publico` (Desafio RJNet, tela de TV — restrita a
-- ranking/ganhadores sem telefone). Qualquer outra função com EXECUTE pra
-- anon/public é um problema (ver V-02 do D-078: limpar_leads_expirados()
-- não deve ter esse grant).
```

---

## MFA TOTP (PA-12)

Suporte a autenticação multifator (TOTP) adicionado via PA-12.

### Como habilitar

1. **Supabase Dashboard → Authentication → Multi-Factor Auth → habilitar TOTP**
2. Orientar usuários marketing a configurar um app autenticador (Google Authenticator, Authy, etc.) na próxima sessão de login
3. Após habilitar no Dashboard, o fluxo de login detecta MFA automaticamente

### Como funciona no app

- `src/lib/dataService.js`: `auth.signIn()` detecta o desafio MFA quando `session === null && user === null` após o login com e-mail/senha — cria challenge TOTP e retorna `{ mfaRequired: true, factorId, challengeId }`
- `src/auth/LoginAuth.jsx`: exibe automaticamente uma tela de código TOTP quando `mfaRequired`; campo numérico com `autoComplete="one-time-code"`; `auth.verifyMfa(factorId, challengeId, codigo)` verifica o código e estabelece a sessão completa
- Usuários sem MFA configurado passam pelo fluxo normal de login sem interrupção

### Observação

MFA é recomendado apenas para usuários com papel `marketing` (acesso total a dados). O Supabase não permite forçar MFA por papel nativamente — a orientação deve ser feita administrativamente.

---

## Migrações SQL — Ordem obrigatória de aplicação

| Ordem | Arquivo | Status | Descrição |
|-------|---------|--------|-----------|
| 1 | `supabase/schema.sql` | ✅ Obrigatório | Schema base, tabelas, seed |
| 2 | `supabase/migracao-auth.sql` | ✅ Obrigatório | Auth, perfis, RLS por papel |
| 3 | `supabase/protecao-dados.sql` | ✅ Obrigatório | Soft delete em leads |
| — | `supabase/verificar-migracao-auth.sql` | ✅ Disponível (PA-02) | Script de verificação — confirma que as 3 migrações acima foram aplicadas |
| 4 | `supabase/migracao-consentimento.sql` | ✅ Aplicado em produção (PA-04) | 3 colunas de consentimento LGPD em `leads` — confirmado 2026-06-16 |
| 5 | `supabase/migracao-audit-exportacoes.sql` | ✅ Aplicado em produção (PA-06) | Tabela `audit_exportacoes` — log de exportações CSV de dados pessoais — confirmado 2026-06-16 |
| 6 | `supabase/migracao-soft-delete-audit.sql` | ✅ Aplicado em produção (PA-07) | Colunas `deletado_em` e `deletado_por` em `leads` — rastreabilidade de soft delete — confirmado 2026-06-16 |
| 7 | `supabase/migracao-remove-cpf.sql` | ✅ Aplicado em produção (PA-08) | Remove coluna `cpf` de `leads` — confirmado 2026-06-16 |
| 8 | `supabase/migracao-readd-cpf.sql` | ✅ Aplicado em produção (PA-08b) | Reintroduz `cpf` como opcional com finalidade declarada — confirmado 2026-06-16 |
| 9 | `supabase/migracao-rls-vendedor-leads.sql` | ⚠️ Substituída por v2 (linha 20) — não aplicar isoladamente | RLS: vendedor vê apenas os próprios leads (superada por migrações posteriores, ver linha 20) |
| 10 | `supabase/migracao-audit-log.sql` | ⚠️ Pendente execução em produção (PA-13) | Tabela `audit_log` + trigger em leads |
| 11 | `supabase/migracao-retencao.sql` | ⚠️ Pendente execução em produção (PA-10) | Retenção automática via pg_cron |
| 12 | `supabase/migracao-ofertas.sql` | ⚠️ Pendente execução em produção (D-057) | Tabelas `ofertas`/`oferta_envios`, RLS e bucket Storage `ofertas` (público) |
| 13 | `supabase/migracao-leads-mensais.sql` | ⚠️ Pendente execução em produção (D-058) | Coluna `leads.mes_referencia`, constraint de exclusividade com `evento_id`, RPC `ranking_mes()`, 3º bloco de retenção |
| 14 | `supabase/migracao-comercial.sql` | ⚠️ Pendente execução em produção (D-059) | Papel `comercial` + RLS de `eventos`/`ofertas`/`leads`/bucket Storage |
| 15 | `supabase/migracao-qrcode.sql` | ⚠️ Pendente execução em produção (D-061) | Colunas `origem`/`qr_code_id`/`qr_code_label` em `leads`; relaxa constraint de exclusividade para aceitar lead sem evento nem mês; RLS de `vendedor` passa a exigir `vendedor_id is not null`. **Vestigial desde D-065** (gerador standalone removido), mas continua ativo — compartilhado com `origem='formulario'` |
| 16 | `supabase/migracao-qrcode-retencao.sql` | ⚠️ Pendente execução em produção (D-061/D-064) | 4º bloco de retenção: leads sem `evento_id` nem `mes_referencia` expiram por `criado_em` |
| 17 | `supabase/migracao-form-builder.sql` | ⚠️ Pendente execução em produção (D-062) | Tabela `formularios`, colunas `formulario_id`/`bairro` em `leads`, **primeiras policies `anon`** do projeto (leitura, `ativo=true`) |
| 18 | `supabase/migracao-campos-personalizados.sql` | ⚠️ Pendente execução em produção (D-063) | Tabela `campos_personalizados`, RLS `anon` de leitura, coluna `leads.campos_extras` (jsonb) |
| 19 | `supabase/migracao-moderacao-formulario.sql` | ⚠️ Pendente execução em produção (D-067) | Coluna `leads.origem_ip` + índice para rate limit (5 submissões/10min por IP no formulário público) |
| 20 | `supabase/migracao-rls-vendedor-leads-v2.sql` | ✅ Aplicado em produção em 2026-07-07 (PA-11 v2) | RLS: reaplica `vendedor_id = auth.uid()` em `leads_select` por cima da versão vigente (linha 15). Confirmado via `pg_policies` pós-aplicação. **Qualquer migração futura que reescreva `leads_select` sem essa condição reabre o mesmo gap** — checar esta linha antes de tocar nessa policy de novo |
| 21 | `supabase/migracao-desafio-cronometro.sql` | ⚠️ Pendente execução em produção (D-089) | Tabelas `timer_challenge_events`/`timer_challenge_entries` (domínio novo e independente, sem tocar `leads`/`eventos`), RLS marketing-only, RPC pública `timer_challenge_painel_publico` (SECURITY DEFINER). Não depende de nenhuma migração anterior desta lista além de `migracao-auth.sql` (usa `papel_atual()`) — pode ser aplicada em qualquer momento |

| 22 | `supabase/migracao-landing-pages.sql` | ⚠️ Pendente execução em produção (D-104) | Tabelas `landing_pages`/`lp_sessions`/`lp_events`, colunas `leads.landing_page_id`/`lp_session_id`, RPC pública `landing_page_publica` (SECURITY DEFINER, `anon`), RPC interna `aquisicao_metricas` (marketing), retenção `limpar_lp_tracking_expirado()` + job pg_cron (guardados por `if exists`), **seed da LP Fibra**. Depende só de `migracao-auth.sql` (e opcionalmente `migracao-retencao.sql`); rodar `NOTIFY pgrst` (já incluso) |

> Status "⚠️ Pendente execução em produção" nas linhas 9–19 reflete o que estava
> registrado antes destas migrações existirem — **confirme o estado real em
> produção** (via `verificar-migracao-auth.sql` ou consulta direta) antes de
> assumir que algo já foi aplicado ou não.
>
> **Nota sobre a linha 9 e a linha 20:** `migracao-rls-vendedor-leads.sql` (PA-11, escrita em 2026-06-16) nunca chegou a ser aplicada em produção. Entre a escrita e a aplicação, `migracao-comercial.sql` (linha 14, D-059) e `migracao-qrcode.sql` (linha 15, D-061) reescreveram a mesma policy `leads_select` sem a restrição do PA-11 — a versão vigente hoje deixa o vendedor ler leads de qualquer colega (`vendedor_id is not null`, não `= auth.uid()`). Por isso a linha 9 está marcada como substituída: aplicar só ela, seguindo a ordem numérica, não fecha o gap, porque as linhas 14/15 viriam depois e desfariam a restrição de novo. A correção real é a linha 20, que deve ser aplicada por último.
>
> **Nota histórica:** `supabase/migrar-comercial-para-vendedor.sql` é um script
> pontual de uma versão anterior do sistema (protótipo local, pré-Auth/RLS) que
> **removia** um papel `comercial` então somente-leitura — não confundir com o
> papel `comercial` atual, reintroduzido pela migração 14 (D-059) com escrita
> real via RLS. Não execute o script antigo depois da migração 14.
>
> **Scripts de performance, sem ordem fixa (idempotentes, aplicar quando
> conveniente):** `supabase/fix-ranking-deletado.sql` (QW-001/PA-NEW-001 —
> `ranking_evento()` passa a filtrar `deletado = false`) e
> `supabase/perf-indices-compostos.sql` (QW-002/PA-007 — índices compostos
> `(evento_id, deletado)` para as queries mais frequentes). Não dependem de
> nenhuma migração desta lista nem são pré-requisito de outra.

> Auditorias e conformidade completa: `doc/lgpd/LGPD_AUDIT_AND_COMPLIANCE.md`  
> Plano de ação LGPD: `doc/lgpd/PLANO_DE_ACAO_LGPD.md`

---

## Área de Ofertas — Storage (D-057)

Primeiro uso de **Supabase Storage** no projeto. `supabase/migracao-ofertas.sql` cria:

- Tabela `ofertas` (`servico` como chave primária, máx. 5 linhas — mesmo enum de `servicoInteresse`) e `oferta_envios` (indicador de clique, não de entrega), com RLS no mesmo padrão de `materiais`/`leads`.
- Bucket **`ofertas`, público** (decisão consciente: são imagens promocionais sem dado pessoal de titular — evita a complexidade de signed URLs). Escrita restrita a `papel_atual() = 'marketing'` via policies em `storage.objects`; leitura pública.

**Passo extra além de rodar o SQL**: a `INSERT INTO storage.buckets` no script cria o bucket automaticamente, mas confirme no Dashboard (**Storage**) que ele aparece como público após a migração. Sem isso, ou sem a migração aplicada, a aba "Ofertas" do marketing funciona normalmente para texto, mas o upload de imagem falha silenciosamente (erro só visível no console do navegador).

**CSP:** `vercel.json` tem `img-src` ampliado para `https://*.supabase.co` — necessário para as imagens do bucket renderizarem em produção/preview (CSP não existe em `npm run dev`).

---

## Mês de referência, papel comercial e QR Code (D-058, D-059, D-061)

- **`migracao-leads-mensais.sql`** (D-058): coluna `leads.mes_referencia` (date, primeiro dia do mês), RPC `ranking_mes(mref)` espelhando `ranking_evento()`, coluna `oferta_envios.mes_referencia`, e um 3º bloco de retenção em `limpar_leads_expirados()` para leads de mês encerrado há mais de `retencao_leads_mensais_dias` (365 por padrão).
- **`migracao-comercial.sql`** (D-059): novo papel `comercial` no check constraint de `perfis`; estende `eventos_write`/`ofertas_write`/bucket `ofertas`/`leads_insert`/`leads_update`/`leads_delete` para aceitar `papel_atual() in ('marketing', 'comercial')`. `materiais_write` e as policies de `perfis` continuam exclusivas de `marketing`. A migração original só estendeu a **escrita** de `leads` — a leitura (`leads_select`, de `protecao-dados.sql`) ficou restrita a `marketing`/`vendedor` até ser corrigida (ver nota abaixo).
- **`migracao-qrcode.sql`** (D-061): colunas `origem`/`qr_code_id`/`qr_code_label` em `leads`; relaxa a constraint `leads_evento_xor_mes` de `= 1` para `<= 1` (agora aceita lead sem `evento_id` nem `mes_referencia`); RLS de `vendedor` passa a exigir `vendedor_id is not null` — leads de QR Code/Formulário ficam invisíveis ao vendedor até serem distribuídos manualmente. **Vestigial desde D-065**: o gerador standalone de QR Code que produzia `origem='qrcode'` foi removido, mas a coluna e o pipeline de distribuição continuam ativos, compartilhados com `origem='formulario'`.

**Bug pós-implementação corrigido depois:** `leads_select` e `oferta_envios_select` não haviam sido estendidas para `comercial` junto com a escrita — resultado em produção: o card "Mês/Dia a dia" do Início mostrava contagem certa (via `ranking_mes()`, `security definer`, ignora RLS), mas as telas de detalhe (`MesDetail`/`EventDetail`, SELECT direto) vinham vazias para o comercial. Corrigido em `migracao-comercial.sql` (idempotente, pode rodar de novo).

---

## Form Builder e campos personalizados (D-062, D-063)

- **`migracao-form-builder.sql`** (D-062): tabela `formularios` (`campos`/`campos_obrigatorios`, `slug` único, `ativo`); colunas `formulario_id`/`bairro` em `leads`. **Primeiras policies `anon` do projeto** — leitura restrita a `ativo=true`, sem dado sensível — necessárias para a página pública `/f/:slug` renderizar sem sessão. Escrita restrita a `marketing`/`comercial`.
- **`migracao-campos-personalizados.sql`** (D-063): tabela `campos_personalizados` (catálogo de campos de texto livre reutilizáveis, `ativo`), RLS `anon` de leitura no mesmo padrão de `formularios`, coluna `leads.campos_extras` (jsonb, chave = `key` do campo).
- Escrita pública de leads (Edge Function `supabase/functions/submeter-formulario/index.ts`) usa `service_role` — nunca a `anon key` — e replica no servidor (Deno) a mesma validação/sanitização do catálogo fixo `CAMPOS_FORMULARIO` do frontend.
- **Gotcha conhecido** (mesmo do D-057): depois de rodar qualquer uma dessas duas migrações, rode `NOTIFY pgrst, 'reload schema';` (ou Dashboard → Settings → API → Reload schema) — sem isso, colunas/tabelas novas não ficam visíveis para o PostgREST imediatamente.

---

## Moderação do formulário público (D-067)

**`migracao-moderacao-formulario.sql`** adiciona `leads.origem_ip` (capturado via `x-forwarded-for` na Edge Function pública, sem retenção própria — apagado junto do lead pela retenção D-064) e um índice para o rate limit. `submeter-formulario` é a **única escrita não-autenticada** do sistema; três camadas de proteção, além do honeypot/sanitização já existentes:

1. `containsLink()` (duplicada em Deno na Edge Function) rejeita link em texto livre (`nome`/`endereco`/`bairro`/campos personalizados)
2. Rate limit de 5 submissões/10min por IP, contado direto em `leads` (sem tabela nova) antes de cada insert
3. `origem_ip` capturado para permitir investigação manual de abuso

Processo de remoção/denúncia de conteúdo ilegal: `doc/SEGURANCA_MODERACAO.md`. Alternativa de migrar a captação para Google Forms foi avaliada e **descartada** — não transfere a responsabilidade legal, e reintroduziria a duplicação de caminho de captação que D-065 acabou de eliminar.

---

## Desafio RJNet — Acerte 00:03:33 (D-089)

**`migracao-desafio-cronometro.sql`** cria um domínio novo e isolado (não altera `leads`/`eventos`/nenhuma tabela existente):

- `timer_challenge_events` (dias/edições do desafio) e `timer_challenge_entries` (participações, sempre filtradas por `event_id`). RLS restrita a `papel_atual() = 'marketing'` — **não** `comercial` (única exceção deliberada ao padrão-default pós-D-059, seguindo a especificação "Tela para o Marketing" à risca).
- RPC pública `timer_challenge_painel_publico(p_slug text)` (SECURITY DEFINER) — devolve estatísticas + Top 10 do ranking + ganhadores instantâneos (sem telefone) num único payload jsonb, usada pela tela de TV `/tv/:slug`. **Primeiro `grant execute ... to anon` para uma função neste projeto** — decisão documentada em D-089, distinta do precedente de leitura `anon` em tabela (`formularios`/`campos_personalizados`/`simuladores`, que só expõe metadado de campanha).
- Sem Edge Function nova: o cadastro é sempre feito por um usuário `marketing` autenticado (nunca por formulário público), então não há "cliente hostil" a se defender — `src/lib/desafioCronometro.js` já é a fonte de verdade do cálculo, chamada uma única vez no cliente antes do INSERT.
- Realtime da tela de TV via **Broadcast** (canal `desafio-painel-<eventId>`, mesmo idioma de `activityLog.js`/Monitor), nunca `postgres_changes` — a tela é anônima e não tem policy de SELECT nas tabelas, então uma subscription normal não entregaria nada a ela.
- Não depende de `NOTIFY pgrst` pra funcionar no frontend admin (usa o `fetchAll` genérico), mas rode mesmo assim por hábito depois de aplicar.

---

## Landing Pages e Aquisição (D-104)

**`migracao-landing-pages.sql`** cria um domínio novo e genérico (a LP Fibra é só a primeira linha):

- `landing_pages` (identidade, status, campanha padrão, destino do WhatsApp — número nasce **nulo** —, `tracking` jsonb com IDs públicos de GTM/GA4/Ads/Meta). RLS: escrita `marketing`; leitura interna `papel_atual() is not null` (só metadado — o comercial precisa do nome da LP na fila de distribuição).
- `lp_sessions` (sessão anônima: UUID do cliente, UTM first-touch, referrer, URL, `device`; **sem IP/user-agent**) e `lp_events` (uma tabela para todos os tipos; `nome` validado por whitelist em código). RLS: leitura `marketing`; **nenhuma policy de escrita** — só as Edge Functions (`service_role`) gravam.
- `leads.landing_page_id`/`leads.lp_session_id` (FK `set null`) + `origem='landing_page'`; UTM reaproveita `leads.utm`.
- RPC pública `landing_page_publica(p_slug)` — único acesso `anon` (padrão D-103): identidade + WhatsApp + IDs de tracking. RPC interna `aquisicao_metricas(...)` — exige `papel_atual()='marketing'`, devolve totais/por LP/por campanha/por dia.
- Retenção: `limpar_lp_tracking_expirado()` (395 dias, chave `retencao_lp_sessoes_dias`), `REVOKE` de `public/anon/authenticated`, job `lgpd-limpar-lp-tracking` às 05:30 UTC.
- Edge Functions **`rastrear-lp`** (sessão + eventos) e **`submeter-lp`** (lead) — mesmas camadas de `_shared/captacao.ts` (CORS, sanitização, `containsLink`, IP confiável, rate limit). **Adicionar o domínio da LP em `CORS_ALLOWED_ORIGINS`** (ex.: `https://fibra.rjnet.com.br`). Guia completo: `doc/aquisicao/INTEGRACAO_LP.md`.
