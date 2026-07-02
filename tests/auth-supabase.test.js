// @ts-check
/**
 * Login/logout do vendedor via Supabase Auth simulado (porta 3001).
 * O modo legado não tem mais nenhum caminho de UI para autenticar como
 * vendedor — a tela de seleção de vendedor foi removida do app (só restava
 * CSS órfão em index.css, já limpo). Ver tests/helpers/supabase-mock.js.
 */
const { test, expect } = require('@playwright/test');
const { mockSupabase, loginPorEmail } = require('./helpers/supabase-mock');

test.describe('Autenticação — Comercial (Supabase)', () => {

  test('login Comercial completo — entra no app como vendedor', async ({ page }) => {
    await mockSupabase(page, { papel: 'vendedor' });
    await loginPorEmail(page, 'vendedor');
    await expect(page.locator('.login-bg')).not.toBeVisible();
    await expect(page.locator('.app-header')).toBeVisible();
  });

  test('logout retorna à tela de login — Comercial', async ({ page }) => {
    await mockSupabase(page, { papel: 'vendedor' });
    await loginPorEmail(page, 'vendedor');
    await page.locator('.app-header button', { hasText: 'Sair' }).click();
    await expect(page.locator('.login-bg')).toBeVisible();
  });

});
