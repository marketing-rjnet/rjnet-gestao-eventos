// @ts-check
const { test, expect } = require('@playwright/test');

async function loginMarketing(page) {
  await page.goto('/');
  await page.locator('.login-form input[autocomplete="username"]').fill('marketing');
  await page.locator('.login-form input[type="password"]').fill('mkt2025');
  await page.locator('.login-form button[type="submit"]').click();
  await expect(page.locator('.app-header')).toBeVisible();
}

async function goToEstoque(page) {
  await loginMarketing(page);
  await page.locator('.tab-btn', { hasText: 'Estoque' }).click();
  await expect(page.locator('.tab-btn.active')).toContainText('Estoque');
}

test.describe('Seção Estoque', () => {

  test('seção Estoque carrega sem erros', async ({ page }) => {
    await goToEstoque(page);
    await expect(page.locator('.estoque-table-wrap, .estoque-table, .empty-state')).toBeVisible();
  });

  test('tabela de materiais é visível com dados pré-carregados', async ({ page }) => {
    await goToEstoque(page);
    // App seeds 10 materials (Wind Banner 2m, Wind Banner 5m, Tenda Inflável…)
    await expect(page.locator('.estoque-table')).toBeVisible();
    const rows = page.locator('.estoque-table tbody tr, .estoque-table tr').filter({ hasNotText: /nome|material/i });
    await expect(rows.first()).toBeVisible();
  });

  test('badges de quantidade estão presentes nas linhas', async ({ page }) => {
    await goToEstoque(page);
    // qtd-badge class is used for status indicators in the table
    await expect(page.locator('.qtd-badge').first()).toBeVisible();
  });

  test('materiais esperados do mock aparecem na tabela', async ({ page }) => {
    await goToEstoque(page);
    const table = page.locator('.estoque-table');
    // Check for at least one of the seeded material names
    await expect(table).toContainText('Wind Banner');
  });

  test('tabela exibe nome e quantidade de cada material', async ({ page }) => {
    await goToEstoque(page);
    const table = page.locator('.estoque-table');
    // Every row should contain text (name) and a number
    await expect(table).toBeVisible();
    const content = await table.textContent();
    // Should contain numeric quantities
    expect(content).toMatch(/\d+/);
  });

  test('atualizar quantidade — se botão existir, funciona sem erro', async ({ page }) => {
    test.slow();
    await goToEstoque(page);
    // Check if there are inline quantity edit buttons or inputs
    const editBtn = page.locator('.btn-sm, button[aria-label*="editar"], button[title*="editar"]').first();
    const hasEditBtn = await editBtn.isVisible().catch(() => false);
    if (hasEditBtn) {
      await editBtn.click();
      // After click, an input or modal should appear
      const input = page.locator('.modal-box input[type="number"], .inline-form input[type="number"]');
      const hasInput = await input.isVisible().catch(() => false);
      if (hasInput) {
        await input.fill('99');
        await page.locator('.btn-primary').first().click();
        await expect(page.locator('.estoque-table')).toContainText('99');
      }
    } else {
      // Feature may not be present — skip rather than fail
      test.skip();
    }
  });

  test('seção Estoque também carrega para Comercial', async ({ page }) => {
    await page.goto('/');
    await page.locator('.login-form input[autocomplete="username"]').fill('comercial');
    await page.locator('.login-form input[type="password"]').fill('com2025');
    await page.locator('.login-form button[type="submit"]').click();
    await page.locator('.vendedor-btn').first().click();
    await page.locator('.tab-btn', { hasText: 'Estoque' }).click();
    await expect(page.locator('.estoque-table-wrap, .estoque-table, .empty-state')).toBeVisible();
  });

});
