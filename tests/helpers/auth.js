// @ts-check
/**
 * Helpers de autenticação para os testes E2E.
 * Credenciais lidas de variáveis de ambiente — nunca hardcoded.
 */

const MKT_USER = process.env.TEST_MARKETING_USER || 'marketing';
const MKT_PASS = process.env.TEST_MARKETING_PASS || 'mkt2025';

const VEND_USER = process.env.TEST_VENDEDOR_USER || 'vendedor';
const VEND_PASS = process.env.TEST_VENDEDOR_PASS || 'vend2025';

/**
 * Loga como usuário Marketing e aguarda o app carregar.
 * @param {import('@playwright/test').Page} page
 */
async function loginMarketing(page) {
  await page.goto('/');
  await page.locator('.login-form input[autocomplete="username"]').fill(MKT_USER);
  await page.locator('.login-form input[type="password"]').fill(MKT_PASS);
  await page.locator('.login-form button[type="submit"]').click();
  await page.locator('.app-header').waitFor({ state: 'visible' });
}

/**
 * Loga como vendedor (seleciona o primeiro da lista) e aguarda o app carregar.
 * @param {import('@playwright/test').Page} page
 */
async function loginComercial(page) {
  await page.goto('/');
  await page.locator('.login-form input[autocomplete="username"]').fill(MKT_USER);
  await page.locator('.login-form input[type="password"]').fill(MKT_PASS);
  await page.locator('.login-form button[type="submit"]').click();
  // No modo local o login Marketing abre a seleção de vendedor
  const vendedorBtn = page.locator('.vendedor-btn').first();
  if (await vendedorBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await vendedorBtn.click();
  }
  await page.locator('.vend-bottom-nav').waitFor({ state: 'visible' });
}

/**
 * Faz logout de qualquer sessão ativa.
 * @param {import('@playwright/test').Page} page
 */
async function logout(page) {
  await page.locator('.app-header button', { hasText: 'Sair' }).click();
  await page.locator('.login-bg').waitFor({ state: 'visible' });
}

module.exports = { loginMarketing, loginComercial, logout };
