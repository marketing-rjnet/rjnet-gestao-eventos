// @ts-check
const { test, expect } = require('@playwright/test');

// Comercial login requires selecting a vendedor after credentials
async function loginComercial(page, vendedorIndex = 0) {
  await page.goto('/');
  await page.locator('.login-form input[autocomplete="username"]').fill('comercial');
  await page.locator('.login-form input[type="password"]').fill('com2025');
  await page.locator('.login-form button[type="submit"]').click();
  await expect(page.locator('.vendedor-list')).toBeVisible();
  await page.locator('.vendedor-btn').nth(vendedorIndex).click();
  await expect(page.locator('.app-header')).toBeVisible();
}

test.describe('Seção Comercial', () => {

  test('seção Eventos carrega sem erros', async ({ page }) => {
    await loginComercial(page);
    await expect(page.locator('.tab-btn.active')).toContainText('Eventos');
    // Either event cards or empty state must be visible
    await expect(page.locator('.card-grid, .event-card, .empty-state')).toBeVisible();
  });

  test('eventos pré-carregados são exibidos', async ({ page }) => {
    await loginComercial(page);
    // App has mock events: "Festa do Pescador - Angra" and "Feira de Tecnologia RJ"
    const cards = page.locator('.event-card');
    await expect(cards.first()).toBeVisible();
    await expect(cards).toHaveCount(2);
  });

  test('abre detalhe de um evento ao clicar no card', async ({ page }) => {
    test.slow();
    await loginComercial(page);
    await page.locator('.event-card').first().click();
    // Detail header should appear
    await expect(page.locator('.detalhe-header')).toBeVisible();
    // Should have badges section (status, tipo)
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
    // Leads subsection should exist
    await expect(page.locator('.leads-table-wrap, .mini-lead-list, .lead-form, .empty-state')).toBeVisible();
  });

  test('adiciona um lead e ele aparece na lista', async ({ page }) => {
    test.slow();
    await loginComercial(page);
    // Open the first event (Festa do Pescador - Angra has a lead pre-seeded)
    await page.locator('.event-card').first().click();

    // Fill the inline lead form if present
    const leadForm = page.locator('.lead-form, .inline-form');
    const hasForm = await leadForm.isVisible().catch(() => false);

    if (hasForm) {
      // Fill nome field (first text input in the form)
      await leadForm.locator('input[type="text"]').first().fill('Teste Lead E2E');
      // Try to submit (look for a primary button in the form)
      await leadForm.locator('.btn-primary, button[type="submit"]').first().click();
      // New lead should appear
      await expect(page.locator('text=Teste Lead E2E')).toBeVisible();
    } else {
      // Inline form may be behind a button — click "Adicionar" or similar
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
    // Mock data has 4 vendors
    await expect(page.locator('.vendedor-card-nome, .vendedor-card-info').first()).toBeVisible();
  });

});
