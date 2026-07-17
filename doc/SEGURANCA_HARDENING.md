# Hardening de Segurança — Checklist de Painel e Deploy

> Pré-requisitos operacionais que **não vivem no código** e precisam ser
> configurados no painel do Supabase / Vercel. Gerado a partir da auditoria
> de segurança de 2026-07-17. Sem estes itens, controles implementados no
> código (RLS, Edge Functions) podem ser contornados por configuração.
>
> **Status da aplicação (2026-07-17):** `migracao-hardening-seguranca.sql`
> executada em produção e verificada — as 4 queries do rodapé passaram
> (V-01/V-02/V-05/V-06 OK). Edge Functions do painel conferidas com o
> `getClientIp` do V-03 (sem drift nesta data). Signups OFF confirmado.
> Itens marcados `[x]` abaixo foram verificados nessa data; os demais
> seguem pendentes de confirmação ou são recorrentes.

## 1. Ordem de aplicação das migrações SQL (causa raiz do V-01)

As migrações são coladas manualmente no SQL Editor — **não há runner que
garanta ordem**. Foi essa ambiguidade que permitiu a `leads_select` ficar
permissiva em algum momento. Regras:

- Aplicar **todas** as migrações e, **por último**, `migracao-hardening-seguranca.sql`.
- Após qualquer migração que altere tabela/coluna: `NOTIFY pgrst, 'reload schema';`
- Verificar o estado final com as queries do rodapé de `migracao-hardening-seguranca.sql`.
- Recomendado (médio prazo): migrar para **Supabase CLI** (`supabase migration`)
  com versionamento, eliminando a colagem manual.

## 2. Autenticação — painel Supabase (V-04)

`Dashboard → Authentication`:

- [x] **Enable Signups: OFF.** *(verificado 2026-07-17 — ver também D-079:
      provedores sociais, incl. Google, avaliados e mantidos desabilitados)*
      Usuários são criados **apenas** pela Edge
      Function `atualizar-email-usuario` (papel marketing). Signup público
      aberto permite que qualquer um com a anon key crie contas `auth.users`
      (mesmo que inertes por `ativo=false`) — vetor de flood.
- [ ] **Confirm email:** definir de forma consciente. Como os usuários são
      criados com `email_confirm: true` pela Edge Function, a confirmação
      pública não é necessária; mantê-la desligada **só** faz sentido com
      signups OFF (senão vira flood de contas não verificadas).
- [ ] **MFA/TOTP:** habilitado (o código já suporta — `PA-12`). Exigir para
      contas marketing.
- [ ] Revisar políticas de senha (comprimento mínimo, senhas vazadas).

## 3. Secrets das Edge Functions

`Dashboard → Edge Functions → Secrets`:

- [ ] **`CORS_ALLOWED_ORIGINS`** = domínios reais, separados por vírgula
      (ex.: `https://SEU_DOMINIO.vercel.app,http://localhost:3000`).
      Sem isso, o CORS cai no fallback `http://localhost:3000` e as portas
      públicas quebram em produção.
- [ ] `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`
      presentes (injetados pela plataforma, mas confirmar).
- [ ] A `service_role` **nunca** deve ser exposta em variável `VITE_*`
      (essas vão para o bundle público). Só `VITE_SUPABASE_URL` e
      `VITE_SUPABASE_ANON_KEY` são públicas e esperadas.

## 4. Funções SECURITY DEFINER (V-02)

- [x] Confirmar que `limpar_leads_expirados()` **não** tem `EXECUTE` para
      `public`/`anon`/`authenticated` (revogado em `migracao-hardening-seguranca.sql`).
      Só o job `pg_cron` a executa. *(verificado 2026-07-17 — EXECUTE apenas
      para `service_role`/`postgres`)*
- [ ] Ao criar **qualquer nova** função `SECURITY DEFINER`, aplicar o padrão:
      `revoke all on function ... from public, anon;` + `grant execute ... to authenticated;`
      (ou nem isso, se só o cron usar). Nunca deixar o `EXECUTE` default para PUBLIC.

## 5. Storage

- [ ] Bucket `ofertas` é **público por decisão** (só material promocional,
      sem PII). Não subir nada sensível nesse bucket — qualquer pessoa lê por path.

## 6. Deploy Vercel

- [ ] `VITE_MARKETING_PASS` **ausente** em produção (o build aborta se
      presente — `vite.config.js`, PA-01). Modo Supabase Auth em produção.
- [ ] Confirmar headers de `vercel.json` aplicados (CSP, HSTS, X-Frame-Options)
      após cada deploy.
- **Nota operacional (Free Tier):** o projeto Supabase **pausa por
  inatividade** e isso derruba os deploys de produção na Vercel (ocorrido em
  2026-07-17). Ao reativar o projeto, **redeployar a produção** (linha da
  `main` → Redeploy, ou push na `main`); redeploy de uma *preview* não assume
  o domínio de produção e builda com env vars do escopo Preview.

## 7. Rate limit das portas públicas (V-03)

- [x] Após editar `supabase/functions/_shared/captacao.ts`, **redeployar as
      duas** Edge Functions que o importam: `submeter-formulario` e
      `submeter-simulador`. *(feito e conferido 2026-07-17 — as versões
      inline do painel contêm o `getClientIp` do V-03; regra permanece
      válida para toda edição futura do `_shared`)*
- [ ] Monitorar picos de leads por IP/janela; considerar CAPTCHA invisível
      se o abuso persistir (o rate limit por IP é mitigação, não barreira
      absoluta contra atacante distribuído).
