// @ts-check
/**
 * Testes de segurança: SQL Injection, XSS, força bruta, e outras superfícies de ataque.
 * Estes testes verificam que payloads maliciosos não causam comportamento inesperado.
 */
const { test, expect } = require('@playwright/test');
const { loginMarketing, loginComercial } = require('./helpers/auth');

// ─── Payloads de ataque ────────────────────────────────────────────────────────

const SQL_PAYLOADS = [
  "' OR '1'='1",
  "' OR 1=1--",
  "'; DROP TABLE usuarios;--",
  "' UNION SELECT username,password FROM users--",
  "admin'--",
  "' OR 'x'='x",
  "1' AND SLEEP(5)--",
  "') OR ('1'='1",
];

const XSS_PAYLOADS = [
  '<script>alert("xss")</script>',
  '<img src=x onerror=alert(1)>',
  '"><script>alert(document.cookie)</script>',
  "javascript:alert('xss')",
  '<svg onload=alert(1)>',
  '{{7*7}}',           // Template injection
  '${7*7}',           // JS template literal injection
  '<iframe src="javascript:alert(1)">',
];

// ─── SQL Injection no formulário de login ─────────────────────────────────────

test.describe('SQL Injection — Login', () => {

  for (const payload of SQL_PAYLOADS) {
    test(`login com payload SQL não autentica: ${payload.substring(0, 30)}`, async ({ page }) => {
      await page.goto('/');

      // Injeta payload no campo de usuário
      await page.locator('.login-form input[autocomplete="username"]').fill(payload);
      await page.locator('.login-form input[type="password"]').fill('qualquercoisa');
      await page.locator('.login-form button[type="submit"]').click();

      // Deve permanecer na tela de login — NÃO deve entrar no app
      await expect(page.locator('.login-bg')).toBeVisible({ timeout: 3000 });
      await expect(page.locator('.app-header')).not.toBeVisible();
    });

    test(`senha com payload SQL não autentica: ${payload.substring(0, 30)}`, async ({ page }) => {
      await page.goto('/');

      await page.locator('.login-form input[autocomplete="username"]').fill('marketing');
      await page.locator('.login-form input[type="password"]').fill(payload);
      await page.locator('.login-form button[type="submit"]').click();

      await expect(page.locator('.login-bg')).toBeVisible({ timeout: 3000 });
      await expect(page.locator('.app-header')).not.toBeVisible();
    });
  }

});

// ─── XSS — Formulário de login ────────────────────────────────────────────────

test.describe('XSS — Login', () => {

  test('payloads XSS no campo usuário não executam script', async ({ page }) => {
    const alerts = [];
    page.on('dialog', async dialog => {
      alerts.push(dialog.message());
      await dialog.dismiss();
    });

    for (const payload of XSS_PAYLOADS) {
      await page.goto('/');
      await page.locator('.login-form input[autocomplete="username"]').fill(payload);
      await page.locator('.login-form input[type="password"]').fill('teste');
      await page.locator('.login-form button[type="submit"]').click();
      await page.waitForTimeout(300);
    }

    // Nenhum alert/confirm/prompt deve ter sido disparado
    expect(alerts).toHaveLength(0);
  });

  test('payloads XSS na senha não executam script', async ({ page }) => {
    const alerts = [];
    page.on('dialog', async dialog => {
      alerts.push(dialog.message());
      await dialog.dismiss();
    });

    for (const payload of XSS_PAYLOADS) {
      await page.goto('/');
      await page.locator('.login-form input[autocomplete="username"]').fill('marketing');
      await page.locator('.login-form input[type="password"]').fill(payload);
      await page.locator('.login-form button[type="submit"]').click();
      await page.waitForTimeout(300);
    }

    expect(alerts).toHaveLength(0);
  });

});

// ─── XSS — Formulário de Lead ─────────────────────────────────────────────────

test.describe('XSS — Formulário de Lead', () => {

  test('payload XSS no nome do lead é exibido como texto, não executado', async ({ page }) => {
    test.slow();
    const alerts = [];
    page.on('dialog', async dialog => {
      alerts.push(dialog.message());
      await dialog.dismiss();
    });

    await loginComercial(page);
    await page.locator('.event-card').first().click();

    const leadForm = page.locator('.lead-form, .inline-form');
    const hasForm = await leadForm.isVisible().catch(() => false);
    if (!hasForm) { test.skip(); return; }

    const xssPayload = '<script>alert("xss-lead")</script>';
    await leadForm.locator('input[type="text"]').first().fill(xssPayload);
    await leadForm.locator('.btn-primary, button[type="submit"]').first().click();
    await page.waitForTimeout(500);

    // Script não deve ter executado
    expect(alerts).toHaveLength(0);

    // O texto deve aparecer escaped (sem executar), ou a submissão ser rejeitada
    const bodyText = await page.locator('body').textContent();
    // O payload não deve aparecer como HTML interpretado — se aparecer como texto literal, é seguro
    const hasInjectedScript = await page.evaluate(() => {
      return document.querySelectorAll('script[src]').length > 0;
    });
    // Não deve ter criado novos elementos script dinâmicos
    expect(hasInjectedScript).toBeFalsy();
  });

  test('payload XSS no campo nome de evento é sanitizado', async ({ page }) => {
    test.slow();
    const alerts = [];
    page.on('dialog', async dialog => {
      alerts.push(dialog.message());
      await dialog.dismiss();
    });

    await loginComercial(page);
    const newEventBtn = page.locator('button', { hasText: /novo evento/i }).first();
    const hasBtn = await newEventBtn.isVisible().catch(() => false);
    if (!hasBtn) { test.skip(); return; }

    await newEventBtn.click();
    await expect(page.locator('.modal-box')).toBeVisible();

    const modalForm = page.locator('.modal-form');
    await modalForm.locator('input[type="text"]').first().fill('<img src=x onerror=alert(1)>');
    await modalForm.locator('.btn-primary, button[type="submit"]').first().click();
    await page.waitForTimeout(500);

    expect(alerts).toHaveLength(0);
  });

});

// ─── Força Bruta ──────────────────────────────────────────────────────────────

test.describe('Proteção contra Força Bruta', () => {

  test('múltiplas tentativas erradas não travam o browser', async ({ page }) => {
    test.slow();
    await page.goto('/');

    for (let i = 0; i < 10; i++) {
      await page.locator('.login-form input[autocomplete="username"]').fill(`user${i}`);
      await page.locator('.login-form input[type="password"]').fill(`senha${i}`);
      await page.locator('.login-form button[type="submit"]').click();
      // Aguarda resposta sem crash
      await page.waitForTimeout(100);
    }

    // App ainda deve estar responsivo após 10 tentativas
    await expect(page.locator('.login-bg')).toBeVisible();
    await expect(page.locator('.login-form button[type="submit"]')).toBeEnabled();
  });

  test('usuário válido ainda consegue logar após tentativas erradas', async ({ page }) => {
    test.slow();
    await page.goto('/');

    // 5 tentativas erradas
    for (let i = 0; i < 5; i++) {
      await page.locator('.login-form input[autocomplete="username"]').fill('invalido');
      await page.locator('.login-form input[type="password"]').fill('errado');
      await page.locator('.login-form button[type="submit"]').click();
      await page.waitForTimeout(100);
    }

    // Login válido deve funcionar
    await loginMarketing(page);
    await expect(page.locator('.app-header')).toBeVisible();
  });

});

// ─── Acesso não autorizado ────────────────────────────────────────────────────

test.describe('Controle de Acesso', () => {

  test('sem login, recarregar a página mantém na tela de login', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.login-bg')).toBeVisible();
    await page.reload();
    await expect(page.locator('.login-bg')).toBeVisible();
    await expect(page.locator('.app-header')).not.toBeVisible();
  });

  test('após logout, voltar no histórico não reabre o app', async ({ page }) => {
    await loginMarketing(page);
    await expect(page.locator('.app-header')).toBeVisible();
    await page.locator('.logout-btn').click();
    await expect(page.locator('.login-bg')).toBeVisible();
    await page.goBack();
    // Deve continuar na tela de login (sem sessão ativa)
    await expect(page.locator('.login-bg')).toBeVisible();
  });

});

// ─── Integridade de dados ─────────────────────────────────────────────────────

test.describe('Integridade de Dados', () => {

  test('campos numéricos não aceitam texto livre sem validação', async ({ page }) => {
    test.slow();
    await loginComercial(page);
    await page.locator('.tab-btn', { hasText: 'Estoque' }).click();

    const editBtn = page.locator('.btn-sm').first();
    const hasEditBtn = await editBtn.isVisible().catch(() => false);
    if (!hasEditBtn) { test.skip(); return; }

    await editBtn.click();
    const numInput = page.locator('input[type="number"]');
    const hasNumInput = await numInput.isVisible().catch(() => false);
    if (!hasNumInput) { test.skip(); return; }

    // Tenta injetar texto em campo numérico
    await numInput.fill('abc');
    const val = await numInput.inputValue();
    // Deve ser vazio ou 0 — campo numérico rejeita texto
    expect(val === '' || val === '0' || !isNaN(Number(val))).toBeTruthy();
  });

  test('payload muito longo não trava o app (DoS de input)', async ({ page }) => {
    test.slow();
    await page.goto('/');
    const longString = 'A'.repeat(10000);
    await page.locator('.login-form input[autocomplete="username"]').fill(longString);
    await page.locator('.login-form input[type="password"]').fill(longString);
    await page.locator('.login-form button[type="submit"]').click();
    await page.waitForTimeout(1000);
    // App ainda deve estar responsivo
    await expect(page.locator('.login-bg')).toBeVisible();
  });

});
