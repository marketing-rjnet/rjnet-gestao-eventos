// @ts-check
const { test, expect } = require('@playwright/test');
const { loginMarketing, logout } = require('./helpers/auth');

const MKT_USER = process.env.TEST_MARKETING_USER || 'marketing';
const MKT_PASS = process.env.TEST_MARKETING_PASS || 'mkt2025';

test.describe('Autenticação', () => {

  test('página carrega com formulário de login', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.login-bg')).toBeVisible();
    await expect(page.locator('.login-card')).toBeVisible();
    await expect(page.locator('.login-card img[alt="RJNet"]')).toBeVisible();
    await expect(page.locator('.login-form input[autocomplete="username"]')).toBeVisible();
    await expect(page.locator('.login-form input[type="password"]')).toBeVisible();
  });

  test('credenciais inválidas exibem mensagem de erro', async ({ page }) => {
    await page.goto('/');
    await page.locator('.login-form input[autocomplete="username"]').fill('invalido');
    await page.locator('.login-form input[type="password"]').fill('errado');
    await page.locator('.login-form button[type="submit"]').click();
    await expect(page.locator('.error-msg')).toBeVisible();
    await expect(page.locator('.error-msg')).toHaveText(/incorretos/i);
  });

  test('login Marketing abre o app diretamente', async ({ page }) => {
    await loginMarketing(page);
    await expect(page.locator('.login-bg')).not.toBeVisible();
    await expect(page.locator('.app-header')).toBeVisible();
    await expect(page.locator('.user-badge .ub-name')).toHaveText('Marketing');
  });

  test('logout retorna à tela de login — Marketing', async ({ page }) => {
    await loginMarketing(page);
    await logout(page);
    await expect(page.locator('.login-bg')).toBeVisible();
    await expect(page.locator('.login-form')).toBeVisible();
  });

  // Os testes de login/logout Comercial (vendedor) estão em auth-supabase.test.js:
  // o modo legado (esta suíte, porta 3000) não tem mais nenhum caminho de UI para
  // autenticar como vendedor — a tela de seleção de vendedor foi removida do app.

});
