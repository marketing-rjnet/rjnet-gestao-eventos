// @ts-check
/**
 * Testes E2E de validação de formulários.
 * V3: wizard do vendedor — lead em branco é bloqueado na etapa 1 (botão disabled).
 */
const { test, expect } = require('@playwright/test');
const { loginMarketing } = require('./helpers/auth');

test.describe('Validação de Formulários', () => {

  test('formulário de login — campos em branco não entram no app', async ({ page }) => {
    await page.goto('/');
    await page.locator('.login-form button[type="submit"]').click();
    await expect(page.locator('.login-bg')).toBeVisible();
  });

  test('formulário de login — somente usuário preenchido não entra', async ({ page }) => {
    await page.goto('/');
    await page.locator('.login-form input[autocomplete="username"]').fill('marketing');
    await page.locator('.login-form button[type="submit"]').click();
    const hasError = await page.locator('.error-msg').isVisible().catch(() => false);
    const stayedOnLogin = await page.locator('.login-bg').isVisible().catch(() => false);
    expect(hasError || stayedOnLogin).toBeTruthy();
  });

  test('formulário de login — somente senha preenchida não entra', async ({ page }) => {
    await page.goto('/');
    await page.locator('.login-form input[type="password"]').fill('qualquersenha');
    await page.locator('.login-form button[type="submit"]').click();
    const hasError = await page.locator('.error-msg').isVisible().catch(() => false);
    const stayedOnLogin = await page.locator('.login-bg').isVisible().catch(() => false);
    expect(hasError || stayedOnLogin).toBeTruthy();
  });

  // O teste do wizard etapa 1 (Comercial) está em formularios-supabase.test.js:
  // o modo legado não tem mais caminho de UI para autenticar como vendedor.

  test('modal de novo evento abre ao clicar em Novo Evento', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Eventos' }).click();
    await page.locator('button', { hasText: /novo evento/i }).first().click();
    await expect(page.locator('.modal-box')).toBeVisible();
  });

  test('fechar modal sem salvar não cria evento', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Eventos' }).click();
    const countBefore = await page.locator('.event-card').count();

    await page.locator('button', { hasText: /novo evento/i }).first().click();
    await expect(page.locator('.modal-overlay')).toBeVisible();
    await page.locator('.modal-close').click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible();

    const countAfter = await page.locator('.event-card').count();
    expect(countAfter).toBe(countBefore);
  });

  test('preencher e salvar evento cria novo card', async ({ page }) => {
    test.slow();
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Eventos' }).click();
    // Evento novo nasce com status "planejado" (EventModal.jsx), mas o filtro
    // padrão da aba é "ativo" — sem trocar pra "Todos" o card criado nunca
    // aparece na contagem.
    await page.locator('.chip', { hasText: 'Todos' }).click();
    const countBefore = await page.locator('.event-card').count();

    await page.locator('button', { hasText: /novo evento/i }).first().click();
    await expect(page.locator('.modal-box')).toBeVisible();

    const modalForm = page.locator('.modal-form');
    await modalForm.getByPlaceholder('Ex: Festa do Pescador').fill('Evento Teste E2E');
    const inputs = modalForm.locator('input:not([type="date"])');
    if (await inputs.count() > 1) await inputs.nth(1).fill('Local Teste');
    const dateInputs = modalForm.locator('input[type="date"]');
    if (await dateInputs.count() > 0) await dateInputs.first().fill('2026-12-01');
    if (await dateInputs.count() > 1) await dateInputs.nth(1).fill('2026-12-02');

    await modalForm.locator('button[type="submit"], .btn-primary').first().click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 });
    const countAfter = await page.locator('.event-card').count();
    expect(countAfter).toBeGreaterThan(countBefore);
    await expect(page.locator('.event-card', { hasText: 'Evento Teste E2E' })).toBeVisible();
  });

  // O teste "lead registrado pelo vendedor aparece para o marketing" está em
  // formularios-supabase.test.js: precisa logar como vendedor e como
  // marketing na mesma sessão, e o modo legado não tem mais caminho de UI
  // para autenticar como vendedor.

});
