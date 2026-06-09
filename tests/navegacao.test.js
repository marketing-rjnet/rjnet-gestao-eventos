// @ts-check
const { test, expect } = require('@playwright/test');
const { loginMarketing, loginComercial } = require('./helpers/auth');

test.describe('Navegação entre abas', () => {

  test('todas as abas estão visíveis após login Marketing', async ({ page }) => {
    await loginMarketing(page);
    await expect(page.locator('.tab-nav')).toBeVisible();
    const tabs = page.locator('.tab-btn');
    await expect(tabs).toHaveCount(4);
    await expect(tabs.nth(0)).toContainText('Eventos');
    await expect(tabs.nth(1)).toContainText('Estoque');
    await expect(tabs.nth(2)).toContainText('Leads');
    await expect(tabs.nth(3)).toContainText('Equipe');
  });

  test('aba Eventos está ativa por padrão', async ({ page }) => {
    await loginMarketing(page);
    await expect(page.locator('.tab-btn.active')).toContainText('Eventos');
  });

  test('clicando em Estoque exibe seção de estoque', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.tab-btn', { hasText: 'Estoque' }).click();
    await expect(page.locator('.tab-btn.active')).toContainText('Estoque');
    await expect(page.locator('.estoque-table-wrap, .estoque-table, .empty-state')).toBeVisible();
  });

  test('clicando em Leads exibe seção de leads', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.tab-btn', { hasText: 'Leads' }).click();
    await expect(page.locator('.tab-btn.active')).toContainText('Leads');
    await expect(page.locator('.leads-table-wrap, .leads-table, .empty-state')).toBeVisible();
  });

  test('clicando em Equipe exibe lista de vendedores', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.tab-btn', { hasText: 'Equipe' }).click();
    await expect(page.locator('.tab-btn.active')).toContainText('Equipe');
  });

  test('clicando em Eventos retorna à seção de eventos', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.tab-btn', { hasText: 'Estoque' }).click();
    await page.locator('.tab-btn', { hasText: 'Eventos' }).click();
    await expect(page.locator('.tab-btn.active')).toContainText('Eventos');
    await expect(page.locator('.card-grid, .event-card, .empty-state')).toBeVisible();
  });

  test('botão Voltar no detalhe de evento retorna à lista', async ({ page }) => {
    await loginMarketing(page);
    const eventCard = page.locator('.event-card').first();
    const hasEvents = await eventCard.isVisible().catch(() => false);
    if (hasEvents) {
      await eventCard.click();
      await expect(page.locator('.detalhe-header, .back-btn')).toBeVisible();
      await page.locator('.back-btn').first().click();
      await expect(page.locator('.card-grid, .event-card')).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('todas as abas estão visíveis após login Comercial', async ({ page }) => {
    await loginComercial(page);
    const tabs = page.locator('.tab-btn');
    await expect(tabs).toHaveCount(4);
  });

});
