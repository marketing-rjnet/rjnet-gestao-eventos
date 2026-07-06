// @ts-check
/**
 * Testes E2E de navegação entre abas.
 * D-065: Marketing tem 3 botões diretos (Início/Eventos/Relatórios) + botão
 *     "Mais" com dropdown (desktop) / bottom sheet (mobile) agrupado por
 *     categoria (Captação, Comercial, Operação, Sistema). Vendedor tem 3
 *     botões no bottom nav.
 */
const { test, expect } = require('@playwright/test');
const { loginMarketing, loginComercial } = require('./helpers/auth');

test.describe('Navegação entre abas', () => {

  test('header desktop do Marketing exibe 3 tabs diretas + Mais', async ({ page }) => {
    await loginMarketing(page);
    await expect(page.locator('.header-nav')).toBeVisible();
    const tabs = page.locator('.header-nav .nav-tab');
    await expect(tabs).toHaveCount(4);
  });

  test('aba Início (Dashboard) está ativa por padrão', async ({ page }) => {
    await loginMarketing(page);
    await expect(page.locator('.header-nav .nav-tab.active')).toContainText('Início');
  });

  test('Dashboard exibe hero card ou KPIs', async ({ page }) => {
    await loginMarketing(page);
    await expect(page.locator('.hero-card, .grid-kpi').first()).toBeVisible();
  });

  test('botão Mais abre dropdown agrupado por categoria', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Mais' }).click();
    await expect(page.locator('.nav-more-dropdown')).toBeVisible();
    await expect(page.locator('.nav-more-group-title')).toHaveText(['Captação', 'Comercial', 'Operação', 'Sistema']);
  });

  test('clicando em Estoque (dentro de Mais) exibe seção de estoque', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Mais' }).click();
    await page.locator('.nav-more-item', { hasText: 'Estoque' }).click();
    await expect(page.locator('.page-title')).toHaveText('Estoque');
  });

  test('clicando em Relatórios exibe seção de leads', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Relatórios' }).click();
    await expect(page.locator('.header-nav .nav-tab.active')).toContainText('Relatórios');
    await expect(page.locator('.page-title').first()).toHaveText('Exportar Leads');
  });

  test('clicando em Equipe (dentro de Mais) exibe lista de vendedores', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Mais' }).click();
    await page.locator('.nav-more-item', { hasText: 'Equipe' }).click();
    await expect(page.locator('.vendor-card').first()).toBeVisible();
  });

  test('clicando em Check-in (dentro de Mais) exibe busca por nome', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Mais' }).click();
    await page.locator('.nav-more-item', { hasText: 'Check-in' }).click();
    await expect(page.locator('.page-title')).toContainText('Check-in');
  });

  test('clicando em Formulários (dentro de Mais) exibe o Form Builder', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Mais' }).click();
    await page.locator('.nav-more-item', { hasText: 'Formulários' }).click();
    await expect(page.locator('.page-title')).toHaveText('Formulários');
  });

  test('clicando em Eventos exibe grid de eventos', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Eventos' }).click();
    await expect(page.locator('.header-nav .nav-tab.active')).toContainText('Eventos');
    await expect(page.locator('.event-grid, .event-card, .empty').first()).toBeVisible();
  });

  test('clicando em Início retorna ao Dashboard', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Eventos' }).click();
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

  test('Comercial usa navegação própria com 3 abas', async ({ page }) => {
    await loginComercial(page);
    const tabs = page.locator('.vend-bottom-nav .vend-nav-btn');
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toContainText('Registrar');
    await expect(tabs.nth(1)).toContainText('Meus Leads');
    await expect(tabs.nth(2)).toContainText('Evento');
  });

  test('Comercial inicia na aba Registrar com wizard visível', async ({ page }) => {
    await loginComercial(page);
    await expect(page.locator('.wizard-progress')).toBeVisible();
    await expect(page.locator('.vend-nav-btn.active')).toContainText('Registrar');
  });

});
