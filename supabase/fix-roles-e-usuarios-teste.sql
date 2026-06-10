-- ============================================================
-- 1. CORRIGIR papel do marketing@netangra.com.br → "marketing"
--    Execute no SQL Editor do Supabase Dashboard
-- ============================================================

UPDATE perfis
SET papel = 'marketing', ativo = true
WHERE email = 'marketing@netangra.com.br';

-- Confirme que atualizou exatamente 1 linha:
SELECT id, email, nome, papel, ativo
FROM perfis
WHERE email = 'marketing@netangra.com.br';


-- ============================================================
-- 2. CRIAR usuários de teste (comercial e vendedor)
--
--    ATENÇÃO: o Supabase não permite criar usuários Auth pelo SQL.
--    Crie as contas pelo painel Marketing → aba "Equipe" após
--    corrigir o passo 1. Ou use o Supabase Dashboard:
--    Authentication → Users → "Add user" com os dados abaixo,
--    depois execute o UPDATE abaixo para ativar e definir o papel.
--
--    Sugestão de credenciais de teste:
--      comercial.teste@netangra.com.br  / Teste@2025
--      vendedor.teste@netangra.com.br   / Teste@2025
-- ============================================================

-- Após criar os usuários no painel Auth, rode:
UPDATE perfis
SET papel = 'comercial', ativo = true, nome = 'Teste Comercial'
WHERE email = 'comercial.teste@netangra.com.br';

UPDATE perfis
SET papel = 'vendedor', ativo = true, nome = 'Teste Vendedor'
WHERE email = 'vendedor.teste@netangra.com.br';

-- Confirme:
SELECT email, nome, papel, ativo FROM perfis
WHERE email IN (
  'comercial.teste@netangra.com.br',
  'vendedor.teste@netangra.com.br'
);
