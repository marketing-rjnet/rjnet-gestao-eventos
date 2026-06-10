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

## Segurança

As policies de RLS liberam leitura/escrita para a `anon key`, porque o app usa
login próprio (marketing/comercial) em vez de Supabase Auth. Isso significa que
**quem tiver a anon key consegue acessar os dados das tabelas**. A anon key fica
exposta no bundle do front-end — é o modelo aceito para uso interno, mas para
endurecer a segurança o próximo passo é migrar o login para **Supabase Auth** e
trocar as policies de `to anon` para `to authenticated`.

Nunca use a **service_role key** no front-end.
