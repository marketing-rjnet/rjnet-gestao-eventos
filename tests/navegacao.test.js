// @ts-check
const { test, expect } = require('@playwright/test');
const { loginMarketing, loginComercial } = require('./helpers/auth');

test.describe('Navegação entre abas', () => {

  test('todas as abas estão visíveis após login Marketing', async ({ page }) => {
    await loginMarketing(page);
    await expect(page.locator('.header-nav')).toBeVisible();
    const tabs = page.locator('.header-nav .nav-tab');
    await expect(tabs).toHaveCount(5);
    await expect(tabs.nth(0)).toContainText('Eventos');
    await expect(tabs.nth(1)).toContainText('Estoque');
    await expect(tabs.nth(2)).toContainText('Leads');
    await expect(tabs.nth(3)).toContainText('Equipe');
    await expect(tabs.nth(4)).toContainText('Check-in');
  });

  test('aba Eventos está ativa por padrão', async ({ page }) => {
    await loginMarketing(page);
    await expect(page.locator('.header-nav .nav-tab.active')).toContainText('Eventos');
  });

  test('clicando em Estoque exibe seção de estoque', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Estoque' }).click();
    await expect(page.locator('.header-nav .nav-tab.active')).toContainText('Estoque');
    await expect(page.locator('.page-title')).toHaveText('Estoque');
  });

  test('clicando em Leads exibe seção de leads', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Leads' }).click();
    await expect(page.locator('.header-nav .nav-tab.active')).toContainText('Leads');
    await expect(page.locator('.page-title')).toHaveText('Leads');
  });

  test('clicando em Equipe exibe lista de vendedores', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Equipe' }).click();
    await expect(page.locator('.header-nav .nav-tab.active')).toContainText('Equipe');
    await expect(page.locator('.vendor-card').first()).toBeVisible();
  });

  test('clicando em Check-in exibe busca por CPF', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Check-in' }).click();
    await expect(page.locator('.page-title')).toContainText('Check-in');
  });

  test('clicando em Eventos retorna à seção de eventos', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Estoque' }).click();
    await page.locator('.header-nav .nav-tab', { hasText: 'Eventos' }).click();
    await expect(page.locator('.header-nav .nav-tab.active')).toContainText('Eventos');
    await expect(page.locator('.event-grid, .event-card, .empty').first()).toBeVisible();
  });

  test('botão Voltar no detalhe de evento retorna à lista', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.event-card').first().click();
    await expect(page.locator('.detail-hero')).toBeVisible();
    await page.locator('.back-btn').first().click();
    await expect(page.locator('.event-grid')).toBeVisible();
  });

  test('Comercial usa navegação própria com 3 abas', async ({ page }) => {
    await loginComercial(page);
    const tabs = page.locator('.vend-bottom-nav .vend-nav-btn');
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toContainText('Registrar');
    await expect(tabs.nth(1)).toContainText('Meus Leads');
    await expect(tabs.nth(2)).toContainText('Evento');
  });

});
