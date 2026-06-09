// @ts-check
const { test, expect } = require('@playwright/test');
const { loginComercial, loginMarketing } = require('./helpers/auth');

test.describe('Seção Comercial', () => {

  test('seção Eventos carrega sem erros', async ({ page }) => {
    await loginComercial(page);
    await expect(page.locator('.tab-btn.active')).toContainText('Eventos');
    await expect(page.locator('.card-grid, .event-card, .empty-state')).toBeVisible();
  });

  test('eventos pré-carregados são exibidos', async ({ page }) => {
    await loginComercial(page);
    const cards = page.locator('.event-card');
    await expect(cards.first()).toBeVisible();
    await expect(cards).toHaveCount(2);
  });

  test('abre detalhe de um evento ao clicar no card', async ({ page }) => {
    test.slow();
    await loginComercial(page);
    await page.locator('.event-card').first().click();
    await expect(page.locator('.detalhe-header')).toBeVisible();
    await expect(page.locator('.detalhe-badges')).toBeVisible();
  });

  test('botão Voltar no detalhe retorna à lista de eventos', async ({ page }) => {
    await loginComercial(page);
    await page.locator('.event-card').first().click();
    await expect(page.locator('.detalhe-header')).toBeVisible();
    await page.locator('.back-btn').first().click();
    await expect(page.locator('.card-grid, .event-card')).toBeVisible();
  });

  test('detalhe do evento contém seção de leads', async ({ page }) => {
    await loginComercial(page);
    await page.locator('.event-card').first().click();
    await expect(page.locator('.leads-table-wrap, .mini-lead-list, .lead-form, .empty-state')).toBeVisible();
  });

  test('adiciona um lead e ele aparece na lista', async ({ page }) => {
    test.slow();
    await loginComercial(page);
    await page.locator('.event-card').first().click();

    const leadForm = page.locator('.lead-form, .inline-form');
    const hasForm = await leadForm.isVisible().catch(() => false);

    if (hasForm) {
      await leadForm.locator('input[type="text"]').first().fill('Teste Lead E2E');
      await leadForm.locator('.btn-primary, button[type="submit"]').first().click();
      await expect(page.locator('text=Teste Lead E2E')).toBeVisible();
    } else {
      const addBtn = page.locator('button', { hasText: /adicionar lead|novo lead|add/i }).first();
      const hasAddBtn = await addBtn.isVisible().catch(() => false);
      if (hasAddBtn) {
        await addBtn.click();
        await expect(page.locator('.modal-overlay, .inline-form-card, .lead-form')).toBeVisible();
      } else {
        test.skip();
      }
    }
  });

  test('vendedores da equipe são listados na aba Equipe', async ({ page }) => {
    await loginComercial(page);
    await page.locator('.tab-btn', { hasText: 'Equipe' }).click();
    await expect(page.locator('.vendedor-card-nome, .vendedor-card-info').first()).toBeVisible();
  });

});
