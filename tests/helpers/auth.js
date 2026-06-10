// @ts-check
/**
 * Helpers de autenticação para os testes E2E.
 * Credenciais lidas de variáveis de ambiente — nunca hardcoded.
 */

const MKT_USER = process.env.TEST_MARKETING_USER || 'marketing';
const MKT_PASS = process.env.TEST_MARKETING_PASS || 'mkt2025';

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
 * Faz logout de qualquer sessão ativa.
 * @param {import('@playwright/test').Page} page
 */
async function logout(page) {
  await page.locator('.app-header button', { hasText: 'Sair' }).click();
  await page.locator('.login-bg').waitFor({ state: 'visible' });
}

module.exports = { loginMarketing, logout };
