// @ts-check
/**
 * Validação de formulários que precisam de sessão de vendedor real, via
 * Supabase Auth simulado. O modo legado não tem mais caminho de UI para
 * autenticar como vendedor — ver tests/helpers/supabase-mock.js.
 */
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { mockSupabase, loginPorEmail } = require('./helpers/supabase-mock');

test.describe('Validação de Formulários — Comercial (Supabase)', () => {

  test('wizard etapa 1 — botão Próximo desabilitado com campos em branco', async ({ page }) => {
    await mockSupabase(page, { papel: 'vendedor' });
    await loginPorEmail(page, 'vendedor');
    const btnProximo = page.locator('.wizard-slide button', { hasText: 'Próximo →' });
    await expect(btnProximo).toBeDisabled();
    // Nenhum lead criado — contador não aparece (só some quando > 0)
    await expect(page.locator('.count-badge')).toContainText('0');
    await expect(page.locator('.toast')).not.toBeVisible();
  });

  test('lead registrado pelo vendedor aparece para o marketing', async ({ page }) => {
    test.slow();
    // Um único mock cobre as duas identidades — o vendedor registra e o
    // marketing lê do mesmo backend simulado, na mesma página.
    await mockSupabase(page, { papel: 'vendedor' });
    await loginPorEmail(page, 'vendedor');

    // Wizard: etapa 1
    await page.getByPlaceholder('Nome do cliente').fill('Lead Salvo E2E');
    await page.getByPlaceholder('(24) 99999-9999').fill('24999887766');
    await page.locator('.wizard-slide button', { hasText: 'Próximo →' }).click();
    // Etapa 2 — "internet_residencial" já vem pré-selecionado por padrão.
    await page.locator('.wizard-actions button', { hasText: 'Próximo →' }).click();
    // Etapa 3
    await page.locator('button[type="submit"]', { hasText: 'Registrar' }).click();

    await expect(page.locator('.toast')).toContainText('Lead Salvo E2E');

    // Sai e entra como marketing — o lead deve constar no CSV exportável.
    // D-058: a aba Relatórios não lista leads individualmente mais — virou
    // uma interface de seleção de evento/mês + exportação CSV.
    await page.locator('.app-header button', { hasText: 'Sair' }).click();
    await loginPorEmail(page, 'marketing');
    await page.locator('.header-nav .nav-tab', { hasText: 'Relatórios' }).click();

    await page.locator('.tbl-wrap table tbody tr', { hasText: 'Festa do Pescador - Angra' }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('button', { hasText: 'Exportar evento' }).click(),
    ]);
    const path = await download.path();
    const csv = fs.readFileSync(path, 'utf-8');
    expect(csv).toContain('Lead Salvo E2E');
  });

});
