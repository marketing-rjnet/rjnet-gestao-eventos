// @ts-check
const { test, expect } = require('@playwright/test');
const { loginMarketing, loginComercial, logout } = require('./helpers/auth');

const COM_USER = process.env.TEST_COMERCIAL_USER || 'comercial';
const COM_PASS = process.env.TEST_COMERCIAL_PASS || 'com2025';
const MKT_USER = process.env.TEST_MARKETING_USER || 'marketing';
const MKT_PASS = process.env.TEST_MARKETING_PASS || 'mkt2025';

test.describe('Autenticação', () => {

  test('página carrega com formulário de login', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.login-bg')).toBeVisible();
    await expect(page.locator('.login-card')).toBeVisible();
    await expect(page.locator('.logo-rj')).toHaveText('RJ');
    await expect(page.locator('.logo-net')).toHaveText('NET');
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
    await expect(page.locator('.header-role')).toHaveText('Marketing');
  });

  test('login Comercial exibe tela de seleção de vendedor', async ({ page }) => {
    await page.goto('/');
    await page.locator('.login-form input[autocomplete="username"]').fill(COM_USER);
    await page.locator('.login-form input[type="password"]').fill(COM_PASS);
    await page.locator('.login-form button[type="submit"]').click();
    await expect(page.locator('.vendedor-list')).toBeVisible();
    await expect(page.locator('.vendedor-btn').first()).toBeVisible();
  });

  test('login Comercial completo — seleciona vendedor e entra no app', async ({ page }) => {
    await loginComercial(page);
    await expect(page.locator('.login-bg')).not.toBeVisible();
    await expect(page.locator('.app-header')).toBeVisible();
  });

  test('botão Voltar na seleção de vendedor retorna ao login', async ({ page }) => {
    await page.goto('/');
    await page.locator('.login-form input[autocomplete="username"]').fill(COM_USER);
    await page.locator('.login-form input[type="password"]').fill(COM_PASS);
    await page.locator('.login-form button[type="submit"]').click();
    await expect(page.locator('.vendedor-list')).toBeVisible();
    await page.locator('.back-btn').click();
    await expect(page.locator('.login-form')).toBeVisible();
  });

  test('logout retorna à tela de login — Marketing', async ({ page }) => {
    await loginMarketing(page);
    await logout(page);
    await expect(page.locator('.login-bg')).toBeVisible();
    await expect(page.locator('.login-form')).toBeVisible();
  });

  test('logout retorna à tela de login — Comercial', async ({ page }) => {
    await loginComercial(page);
    await logout(page);
    await expect(page.locator('.login-bg')).toBeVisible();
  });

});
