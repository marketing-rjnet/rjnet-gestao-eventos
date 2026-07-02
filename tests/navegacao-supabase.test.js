// @ts-check
/**
 * Navegação da tela do vendedor (bottom nav), via Supabase Auth simulado.
 * O modo legado não tem mais caminho de UI para autenticar como vendedor —
 * ver tests/helpers/backend-mock.js.
 */
const { test, expect } = require('@playwright/test');
const { mockSupabase, loginPorEmail } = require('./helpers/backend-mock');

test.describe('Navegação — Comercial (Supabase)', () => {

  test('Comercial usa navegação própria com 3 abas', async ({ page }) => {
    await mockSupabase(page, { papel: 'vendedor' });
    await loginPorEmail(page, 'vendedor');
    const tabs = page.locator('.vend-bottom-nav .vend-nav-btn');
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toContainText('Registrar');
    await expect(tabs.nth(1)).toContainText('Meus Leads');
    await expect(tabs.nth(2)).toContainText('Evento');
  });

  test('Comercial inicia na aba Registrar com wizard visível', async ({ page }) => {
    await mockSupabase(page, { papel: 'vendedor' });
    await loginPorEmail(page, 'vendedor');
    await expect(page.locator('.wizard-progress')).toBeVisible();
    await expect(page.locator('.vend-nav-btn.active')).toContainText('Registrar');
  });

});
