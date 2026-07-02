// @ts-check
/**
 * Testes de segurança que precisam de uma sessão de vendedor real —
 * migrados do modo legado (removido) para o Supabase Auth simulado.
 * Ver tests/helpers/supabase-mock.js.
 */
const { test, expect } = require('@playwright/test');
const { mockSupabase, loginPorEmail } = require('./helpers/supabase-mock');

test.describe('XSS — Formulário de Lead (Supabase)', () => {

  test('payload XSS no nome do lead é exibido como texto, não executado', async ({ page }) => {
    test.slow();
    const alerts = [];
    page.on('dialog', async (dialog) => {
      alerts.push(dialog.message());
      await dialog.dismiss();
    });

    await mockSupabase(page, { papel: 'vendedor' });
    await loginPorEmail(page, 'vendedor');

    const xssPayload = '<script>alert("xss-lead")</script>Fulano';
    await page.getByPlaceholder('Nome do cliente').fill(xssPayload);
    await page.getByPlaceholder('(24) 99999-9999').fill('24999887766');
    await page.locator('.wizard-slide button', { hasText: 'Próximo →' }).click();
    // "internet_residencial" já vem pré-selecionado por padrão (FORM_VAZIO).
    await page.locator('.wizard-actions button', { hasText: 'Próximo →' }).click();
    await page.locator('button[type="submit"]', { hasText: 'Registrar' }).click();
    await page.waitForTimeout(500);

    // Script não deve ter executado
    expect(alerts).toHaveLength(0);

    // O lead salvo deve exibir o nome como texto puro, sem tags HTML
    await page.locator('.vend-nav-btn', { hasText: 'Meus Leads' }).click();
    const nome = page.locator('.lm-name').first();
    await expect(nome).toContainText('Fulano');
    await expect(nome).not.toContainText('<script');
    expect(await page.locator('.lm-name script').count()).toBe(0);
    // Nenhum elemento <script> com o conteúdo do payload pode existir no DOM
    // (os scripts legítimos do Vite/app não contam)
    const hasInjectedScript = await page.evaluate(() =>
      [...document.querySelectorAll('script')].some((s) =>
        (s.textContent || '').includes('xss-lead') || (s.src || '').includes('xss-lead')
      )
    );
    expect(hasInjectedScript).toBeFalsy();
  });

});
