-- =============================================================
-- RJNET GESTÃO DE EVENTOS — Usuários de Teste por Área
-- =============================================================
-- Como aplicar:
--   1. Supabase Dashboard → Authentication → Users → crie cada
--      usuário manualmente com e-mail/senha abaixo e marque
--      "Auto Confirm User".
--   2. Cole este script no SQL Editor e clique em Run para
--      ativar os perfis e atribuir os papéis corretos.
--
-- ATENÇÃO: Use SOMENTE em ambiente de desenvolvimento/homologação.
-- Nunca aplique em produção com senhas de exemplo.
-- =============================================================

-- ─── Ativar e configurar papéis dos usuários de teste ────────
--
-- Execute após criar os usuários no painel Authentication.
-- O trigger on_auth_user_created já insere o registro em perfis;
-- este script apenas atualiza papel e ativo = true.

-- Usuário de teste — área Marketing (acesso total + gestão de usuários)
update public.perfis
  set papel = 'marketing', ativo = true, nome = 'Teste Marketing'
  where email = 'teste.marketing@rjnet.com.br';

-- Usuário de teste — área Vendedor (registro e gestão de próprios leads)
update public.perfis
  set papel = 'vendedor', ativo = true, nome = 'Teste Vendedor'
  where email = 'teste.vendedor@rjnet.com.br';

-- Usuário de teste — área Comercial (dashboard somente leitura)
update public.perfis
  set papel = 'comercial', ativo = true, nome = 'Teste Comercial'
  where email = 'teste.comercial@rjnet.com.br';

-- =============================================================
-- Verificação: confirme os registros criados
-- =============================================================
select id, email, nome, papel, ativo, criado_em
  from public.perfis
  where email in (
    'teste.marketing@rjnet.com.br',
    'teste.vendedor@rjnet.com.br',
    'teste.comercial@rjnet.com.br'
  )
  order by papel;
