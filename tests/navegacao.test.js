// @ts-check
/**
 * Testes E2E de navegação entre abas.
 * V3: Marketing tem bottom nav mobile (5 itens + Mais) e header desktop com 7 tabs.
 *     Aba padrão do Marketing é "Início" (Dashboard). Vendedor tem 3 botões no bottom nav.
 */
const { test, expect } = require('@playwright/test');
const { loginMarketing } = require('./helpers/auth');

test.describe('Navegação entre abas', () => {

  test('header desktop do Marketing exibe 8 tabs', async ({ page }) => {
    await loginMarketing(page);
    await expect(page.locator('.header-nav')).toBeVisible();
    const tabs = page.locator('.header-nav .nav-tab');
    // Início, Eventos, Estoque, Ofertas (D-057), Relatórios, Equipe, Check-in, Monitor
    await expect(tabs).toHaveCount(8);
  });

  test('aba Início (Dashboard) está ativa por padrão', async ({ page }) => {
    await loginMarketing(page);
    await expect(page.locator('.header-nav .nav-tab.active')).toContainText('Início');
  });

  test('Dashboard exibe hero card ou KPIs', async ({ page }) => {
    await loginMarketing(page);
    await expect(page.locator('.hero-card, .grid-kpi').first()).toBeVisible();
  });

  test('clicando em Estoque exibe seção de estoque', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Estoque' }).click();
    await expect(page.locator('.header-nav .nav-tab.active')).toContainText('Estoque');
    await expect(page.locator('.page-title')).toHaveText('Estoque');
  });

  test('clicando em Relatórios exibe seção de leads', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Relatórios' }).click();
    await expect(page.locator('.header-nav .nav-tab.active')).toContainText('Relatórios');
    // D-058: a aba agora tem 2 seções (evento + mês de referência), cada
    // uma com seu próprio .page-title — não existe mais um título "Leads" só.
    await expect(page.locator('.page-title', { hasText: 'Exportar Leads' })).toBeVisible();
    await expect(page.locator('.page-title', { hasText: 'Atividade Mensal' })).toBeVisible();
  });

  test('clicando em Equipe exibe lista de vendedores', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Equipe' }).click();
    await expect(page.locator('.header-nav .nav-tab.active')).toContainText('Equipe');
    await expect(page.locator('.vendor-card').first()).toBeVisible();
  });

  test('clicando em Check-in exibe busca por nome', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Check-in' }).click();
    await expect(page.locator('.page-title')).toContainText('Check-in');
  });

  test('clicando em Eventos exibe grid de eventos', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Eventos' }).click();
    await expect(page.locator('.header-nav .nav-tab.active')).toContainText('Eventos');
    await expect(page.locator('.event-grid, .event-card, .empty').first()).toBeVisible();
  });

  test('clicando em Início retorna ao Dashboard', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Estoque' }).click();
    await page.locator('.header-nav .nav-tab', { hasText: 'Início' }).click();
    await expect(page.locator('.header-nav .nav-tab.active')).toContainText('Início');
    await expect(page.locator('.hero-card, .grid-kpi').first()).toBeVisible();
  });

  test('botão Voltar no detalhe de evento retorna à lista', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Eventos' }).click();
    await page.locator('.event-card').first().click();
    await expect(page.locator('.detail-hero')).toBeVisible();
    await page.locator('.back-btn').first().click();
    await expect(page.locator('.event-grid')).toBeVisible();
  });

  // Os testes de navegação Comercial (vendedor) estão em navegacao-supabase.test.js:
  // o modo legado não tem mais caminho de UI para autenticar como vendedor.

});
