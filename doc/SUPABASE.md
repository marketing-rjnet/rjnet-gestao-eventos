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
| `vendedor` | Tela de registro de leads | Insere/vê/edita **apenas os próprios leads**; placar da equipe vem agregado do servidor |

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

## Segurança

Com a migração de auth aplicada, **a anon key sozinha não dá acesso a nada**:
todas as policies exigem usuário autenticado e ativo, e o que cada um vê/edita
é decidido pelo banco (RLS), não pelo front. Quem se auto-cadastrar pela API
fica com perfil inativo até o marketing ativar.

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
- [ ] MFA habilitado no Dashboard para usuários marketing (PA-12 — planejado)

**Query rápida de verificação de policies anônimas:**
```sql
SELECT tablename, policyname, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND roles @> ARRAY['anon'];
-- Resultado esperado em produção: zero linhas
```

---

## Migrações SQL — Ordem obrigatória de aplicação

| Ordem | Arquivo | Status | Descrição |
|-------|---------|--------|-----------|
| 1 | `supabase/schema.sql` | ✅ Obrigatório | Schema base, tabelas, seed |
| 2 | `supabase/migracao-auth.sql` | ✅ Obrigatório | Auth, perfis, RLS por papel |
| 3 | `supabase/protecao-dados.sql` | ✅ Obrigatório | Soft delete em leads |
| — | `supabase/verificar-migracao-auth.sql` | ✅ Disponível (PA-02) | Script de verificação — confirma que as 3 migrações acima foram aplicadas |
| 4 | `supabase/migracao-consentimento.sql` | ✅ Pronto para aplicar (PA-04) | 3 colunas de consentimento LGPD em `leads` — **executar no Dashboard** |
| 5 | `supabase/migracao-soft-delete-audit.sql` | 🔴 Planejado (PA-07) | Rastreabilidade de soft delete |
| 6 | `supabase/migracao-audit-exportacoes.sql` | 🔴 Planejado (PA-06) | Log de exportações CSV |
| 7 | `supabase/migracao-audit-log.sql` | 🔴 Planejado (PA-13) | Tabela de auditoria de operações |
| 8 | `supabase/migracao-retencao.sql` | 🔴 Planejado (PA-10) | Política de retenção automática |

> Auditorias e conformidade completa: `doc/LGPD_AUDIT_AND_COMPLIANCE.md`  
> Plano de ação LGPD: `doc/PLANO_DE_ACAO_LGPD.md`
