// @ts-check
const { test, expect } = require('@playwright/test');
const { loginMarketing } = require('./helpers/auth');

async function goToEstoque(page) {
  await loginMarketing(page);
  await page.locator('.header-nav .nav-tab', { hasText: 'Mais' }).click();
  await page.locator('.nav-more-item', { hasText: 'Estoque' }).click();
  await expect(page.locator('.page-title')).toHaveText('Estoque');
}

test.describe('Seção Estoque', () => {

  test('seção Estoque carrega sem erros', async ({ page }) => {
    await goToEstoque(page);
    await expect(page.locator('.stock-group').first()).toBeVisible();
  });

  test('materiais pré-carregados aparecem nas linhas', async ({ page }) => {
    await goToEstoque(page);
    await expect(page.locator('.stock-row').first()).toBeVisible();
    await expect(page.locator('.sr-name', { hasText: 'Wind Banner 2m' })).toBeVisible();
  });

  test('badges de disponibilidade estão presentes nas linhas', async ({ page }) => {
    await goToEstoque(page);
    const badges = page.locator('.stock-row .badge');
    await expect(badges.first()).toBeVisible();
    await expect(badges.first()).toContainText('disp.');
  });

  test('cada linha exibe total, em campo e disponível', async ({ page }) => {
    await goToEstoque(page);
    const row = page.locator('.stock-row').first();
    await expect(row.locator('.sr-num')).toHaveCount(3);
    await expect(row).toContainText('total');
    await expect(row).toContainText('em campo');
  });

  test('KPIs de estoque exibem totais', async ({ page }) => {
    await goToEstoque(page);
    const kpis = page.locator('.grid-kpi-3');
    await expect(kpis).toContainText('Total Tipos');
    await expect(kpis).toContainText('Em Campo');
  });

  test('adicionar material novo — aparece na listagem', async ({ page }) => {
    await goToEstoque(page);
    await page.locator('button', { hasText: 'Adicionar Material' }).click();
    await expect(page.locator('.modal-box')).toBeVisible();

    await page.locator('.modal-box input').first().fill('Material Teste E2E');
    await page.locator('.modal-box input[type="number"], .modal-box input[inputmode="numeric"]').first().fill('7');
    await page.locator('.modal-box button[type="submit"], .modal-box .btn-primary').first().click();

    await expect(page.locator('.sr-name', { hasText: 'Material Teste E2E' })).toBeVisible();
  });

});
