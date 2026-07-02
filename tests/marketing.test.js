// @ts-check
const { test, expect } = require('@playwright/test');
const { loginMarketing } = require('./helpers/auth');

test.describe('Seção Marketing', () => {

  test('role Marketing é exibida no header', async ({ page }) => {
    await loginMarketing(page);
    await expect(page.locator('.user-badge .ub-name')).toHaveText('Marketing');
  });

  test('aba Eventos carrega sem erros', async ({ page }) => {
    await loginMarketing(page);
    // Início (Dashboard) é a aba padrão hoje, não Eventos.
    await page.locator('.header-nav .nav-tab', { hasText: 'Eventos' }).click();
    await expect(page.locator('.event-grid, .event-card, .empty').first()).toBeVisible();
  });

  test('eventos pré-carregados aparecem para Marketing', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Eventos' }).click();
    await expect(page.locator('.event-card').first()).toBeVisible();
  });

  test('aba Leads exibe a tabela de leads', async ({ page }) => {
    await loginMarketing(page);
    // A aba se chama "Relatórios" no header hoje (rótulo "Leads" era antigo).
    // A exportação CSV em si (fetchLeadsEvento) só funciona em modo Supabase
    // — sem cobertura aqui; ver formularios-supabase.test.js.
    await page.locator('.header-nav .nav-tab', { hasText: 'Relatórios' }).click();
    await expect(page.locator('.tbl-wrap table, .empty').first()).toBeVisible();
  });

  test('aba Estoque é acessível para Marketing', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Estoque' }).click();
    await expect(page.locator('.stock-group').first()).toBeVisible();
  });

  test('aba Equipe é acessível para Marketing', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Equipe' }).click();
    await expect(page.locator('.vendor-card').first()).toBeVisible();
  });

  test('detalhe de evento abre a partir da view Marketing', async ({ page }) => {
    test.slow();
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Eventos' }).click();
    const firstCard = page.locator('.event-card').first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();
    await expect(page.locator('.detail-hero')).toBeVisible();
  });

  test('adicionar vendedor na aba Equipe', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Equipe' }).click();
    await page.locator('button', { hasText: 'Adicionar Vendedor' }).click();
    await page.locator('.inline-form-card input').fill('Vendedor Teste E2E');
    await page.locator('.inline-form-card button[type="submit"]').click();
    await expect(page.locator('.v-name', { hasText: 'Vendedor Teste E2E' })).toBeVisible();
  });

});
