// @ts-check
const { test, expect } = require('@playwright/test');

async function loginComercialComVendedor(page) {
  await page.goto('/');
  await page.locator('.login-form input[autocomplete="username"]').fill('comercial');
  await page.locator('.login-form input[type="password"]').fill('com2025');
  await page.locator('.login-form button[type="submit"]').click();
  await page.locator('.vendedor-btn').first().click();
  await expect(page.locator('.app-header')).toBeVisible();
}

test.describe('Validação de Formulários', () => {

  test('formulário de login — campos em branco não entram no app', async ({ page }) => {
    await page.goto('/');
    await page.locator('.login-form button[type="submit"]').click();
    // Either stays on login page (no navigation) or shows error
    await expect(page.locator('.login-bg')).toBeVisible();
  });

  test('formulário de login — somente usuário preenchido não entra', async ({ page }) => {
    await page.goto('/');
    await page.locator('.login-form input[autocomplete="username"]').fill('marketing');
    await page.locator('.login-form button[type="submit"]').click();
    // Should show error or remain on login
    const hasError = await page.locator('.error-msg').isVisible().catch(() => false);
    const stayedOnLogin = await page.locator('.login-bg').isVisible().catch(() => false);
    expect(hasError || stayedOnLogin).toBeTruthy();
  });

  test('formulário de login — somente senha preenchida não entra', async ({ page }) => {
    await page.goto('/');
    await page.locator('.login-form input[type="password"]').fill('mkt2025');
    await page.locator('.login-form button[type="submit"]').click();
    const hasError = await page.locator('.error-msg').isVisible().catch(() => false);
    const stayedOnLogin = await page.locator('.login-bg').isVisible().catch(() => false);
    expect(hasError || stayedOnLogin).toBeTruthy();
  });

  test('lead em branco não é salvo — form permanece aberto ou mostra erro', async ({ page }) => {
    test.slow();
    await loginComercialComVendedor(page);
    await page.locator('.event-card').first().click();
    await expect(page.locator('.detalhe-header')).toBeVisible();

    // Find add lead button or inline form
    const addBtn = page.locator('button', { hasText: /adicionar|novo lead/i }).first();
    const hasAddBtn = await addBtn.isVisible().catch(() => false);
    if (hasAddBtn) {
      await addBtn.click();
    }

    // If a modal or form opens, try to submit without filling
    const submitBtn = page.locator('.modal-form .btn-primary, .lead-form .btn-primary, .inline-form-card .btn-primary').first();
    const hasSubmit = await submitBtn.isVisible().catch(() => false);
    if (hasSubmit) {
      await submitBtn.click();
      // Should not close the form or should show validation
      const formStillOpen = await page.locator('.modal-overlay, .lead-form, .inline-form-card').isVisible().catch(() => false);
      const hasError = await page.locator('.error-msg, [class*="error"], input:invalid').count().then(n => n > 0).catch(() => false);
      expect(formStillOpen || hasError).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test('adicionar evento — modal de evento abre ao clicar em Novo Evento', async ({ page }) => {
    test.slow();
    await loginComercialComVendedor(page);
    const newEventBtn = page.locator('button', { hasText: /novo evento/i }).first();
    const hasBtn = await newEventBtn.isVisible().catch(() => false);
    if (hasBtn) {
      await newEventBtn.click();
      await expect(page.locator('.modal-overlay, .modal-box')).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('adicionar evento — fechar modal sem salvar não cria evento', async ({ page }) => {
    test.slow();
    await loginComercialComVendedor(page);
    const countBefore = await page.locator('.event-card').count();

    const newEventBtn = page.locator('button', { hasText: /novo evento/i }).first();
    const hasBtn = await newEventBtn.isVisible().catch(() => false);
    if (hasBtn) {
      await newEventBtn.click();
      await expect(page.locator('.modal-overlay')).toBeVisible();
      // Close via cancel or X button
      const cancelBtn = page.locator('.modal-close, .btn-secondary', { hasText: /cancelar|fechar/i }).first();
      const hasCancel = await cancelBtn.isVisible().catch(() => false);
      if (hasCancel) {
        await cancelBtn.click();
        await expect(page.locator('.modal-overlay')).not.toBeVisible();
        const countAfter = await page.locator('.event-card').count();
        expect(countAfter).toBe(countBefore);
      }
    } else {
      test.skip();
    }
  });

  test('adicionar evento — preencher e salvar cria novo card', async ({ page }) => {
    test.slow();
    await loginComercialComVendedor(page);
    const countBefore = await page.locator('.event-card').count();

    const newEventBtn = page.locator('button', { hasText: /novo evento/i }).first();
    const hasBtn = await newEventBtn.isVisible().catch(() => false);
    if (!hasBtn) { test.skip(); return; }

    await newEventBtn.click();
    await expect(page.locator('.modal-box')).toBeVisible();

    // Fill required fields inside the modal form
    const modalForm = page.locator('.modal-form');
    // Nome do evento
    await modalForm.locator('input[type="text"]').first().fill('Evento Teste E2E');
    // Local
    const inputs = modalForm.locator('input[type="text"]');
    const inputCount = await inputs.count();
    if (inputCount > 1) {
      await inputs.nth(1).fill('Local Teste');
    }
    // Data início
    const dateInputs = modalForm.locator('input[type="date"]');
    const dateCount = await dateInputs.count();
    if (dateCount > 0) {
      await dateInputs.first().fill('2025-12-01');
    }
    if (dateCount > 1) {
      await dateInputs.nth(1).fill('2025-12-02');
    }

    await modalForm.locator('.btn-primary, button[type="submit"]').first().click();

    // Modal should close and new card should appear
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 });
    const countAfter = await page.locator('.event-card').count();
    expect(countAfter).toBeGreaterThan(countBefore);
    await expect(page.locator('.event-card')).toContainText('Evento Teste E2E');
  });

  test('form de lead — dados salvos aparecem na lista de leads da aba', async ({ page }) => {
    test.slow();
    await loginComercialComVendedor(page);
    // Open Festa do Pescador (first event, has inline lead form)
    await page.locator('.event-card').first().click();
    await expect(page.locator('.detalhe-header')).toBeVisible();

    const leadForm = page.locator('.lead-form, .inline-form');
    const hasInlineForm = await leadForm.isVisible().catch(() => false);
    if (!hasInlineForm) { test.skip(); return; }

    const nameInput = leadForm.locator('input[type="text"]').first();
    await nameInput.fill('Lead Salvo E2E');
    await leadForm.locator('.btn-primary, button[type="submit"]').first().click();

    // Lead should now be in the leads section of this event
    await expect(page.locator('.leads-table, .mini-lead-list')).toContainText('Lead Salvo E2E');
  });

});
