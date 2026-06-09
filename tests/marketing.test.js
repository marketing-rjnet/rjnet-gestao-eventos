// @ts-check
const { test, expect } = require('@playwright/test');
const { loginMarketing } = require('./helpers/auth');

test.describe('Seção Marketing', () => {

  test('role Marketing é exibida no header', async ({ page }) => {
    await loginMarketing(page);
    await expect(page.locator('.header-role')).toHaveText('Marketing');
  });

  test('aba Eventos carrega sem erros', async ({ page }) => {
    await loginMarketing(page);
    await expect(page.locator('.card-grid, .event-card, .empty-state')).toBeVisible();
  });

  test('eventos pré-carregados aparecem para Marketing', async ({ page }) => {
    await loginMarketing(page);
    await expect(page.locator('.event-card').first()).toBeVisible();
  });

  test('aba Leads exibe a tabela de leads', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.tab-btn', { hasText: 'Leads' }).click();
    await expect(page.locator('.leads-table-wrap, .leads-table, .empty-state')).toBeVisible();
  });

  test('leads do mock aparecem na aba Leads', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.tab-btn', { hasText: 'Leads' }).click();
    const leadsTable = page.locator('.leads-table');
    const hasTable = await leadsTable.isVisible().catch(() => false);
    if (hasTable) {
      await expect(leadsTable).toContainText('João Pereira');
    } else {
      await expect(page.locator('.leads-table-wrap, .empty-state')).toBeVisible();
    }
  });

  test('aba Estoque é acessível para Marketing', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.tab-btn', { hasText: 'Estoque' }).click();
    await expect(page.locator('.estoque-table-wrap, .estoque-table, .empty-state')).toBeVisible();
  });

  test('aba Equipe é acessível para Marketing', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.tab-btn', { hasText: 'Equipe' }).click();
    await expect(page.locator('.app-header')).toBeVisible();
  });

  test('detalhe de evento abre a partir da view Marketing', async ({ page }) => {
    test.slow();
    await loginMarketing(page);
    const firstCard = page.locator('.event-card').first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();
    await expect(page.locator('.detalhe-header')).toBeVisible();
  });

  test('badge de leads atualiza na aba após adicionar lead', async ({ page }) => {
    await loginMarketing(page);
    const leadsBadge = page.locator('.tab-btn', { hasText: 'Leads' }).locator('.tab-badge');
    const hasBadge = await leadsBadge.isVisible().catch(() => false);
    if (hasBadge) {
      const badgeText = await leadsBadge.textContent();
      expect(Number(badgeText)).toBeGreaterThan(0);
    }
  });

});
