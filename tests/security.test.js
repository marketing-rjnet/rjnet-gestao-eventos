// @ts-check
/**
 * Testes de segurança: SQL Injection, XSS, força bruta, e outras superfícies de ataque.
 * Estes testes verificam que payloads maliciosos não causam comportamento inesperado.
 */
const { test, expect } = require('@playwright/test');
const { loginMarketing } = require('./helpers/auth');

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

  // Cada teste faz vários page.goto() em sequência; a fonte do Google
  // carregada por index.html é bloqueante e não deveria ser uma dependência
  // de rede externa para um teste E2E — bloquear deixa o teste mais rápido
  // e hermético, independente da rede do ambiente onde roda.
  test.beforeEach(async ({ page }) => {
    await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
    await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  });

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
// O teste de XSS no nome do lead (registrado pelo vendedor) está em
// security-supabase.test.js — precisa de uma sessão de vendedor real, e o
// modo legado (esta suíte) não tem mais caminho de UI para autenticar como
// vendedor (tela de seleção removida do app).

test.describe('XSS — Formulário de Lead', () => {

  test('payload XSS no campo nome de evento é sanitizado', async ({ page }) => {
    test.slow();
    const alerts = [];
    page.on('dialog', async dialog => {
      alerts.push(dialog.message());
      await dialog.dismiss();
    });

    // Criar evento é ação de marketing — loginComercial() aqui era engano de
    // copy-paste. O botão "Novo Evento" só existe na aba Eventos (EventosTab),
    // não na aba padrão (Início) — o teste nunca navegava até lá e sempre
    // pulava silenciosamente via test.skip() antes desta correção.
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Eventos' }).click();
    const newEventBtn = page.locator('button', { hasText: /novo evento/i }).first();
    await expect(newEventBtn).toBeVisible();

    await newEventBtn.click();
    await expect(page.locator('.modal-box')).toBeVisible();

    const modalForm = page.locator('.modal-form');
    // O campo "nome" não tem type="text" explícito no JSX (browsers tratam
    // <input> sem type como texto, mas o seletor CSS exige o atributo literal).
    await modalForm.locator('input').first().fill('<img src=x onerror=alert(1)>');
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
    await page.locator('.app-header button', { hasText: 'Sair' }).click();
    await expect(page.locator('.login-bg')).toBeVisible();
    // O app é uma SPA: voltar leva à entrada anterior do histórico.
    // Em nenhuma hipótese a área logada pode reaparecer.
    await page.goBack();
    await expect(page.locator('.app-header')).not.toBeVisible();
    await page.goForward();
    await expect(page.locator('.app-header')).not.toBeVisible();
  });

});

// ─── Integridade de dados ─────────────────────────────────────────────────────

test.describe('Integridade de Dados', () => {

  test('campos numéricos não aceitam texto livre sem validação', async ({ page }) => {
    test.slow();
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Estoque' }).click();
    await page.locator('button', { hasText: 'Adicionar Material' }).click();

    const numInput = page.locator('.modal-box input[type="number"]');
    await expect(numInput).toBeVisible();

    // Tenta injetar texto em campo numérico
    await numInput.click();
    await numInput.pressSequentially('abc');
    const val = await numInput.inputValue();
    // Deve ser vazio ou numérico — campo rejeita texto
    expect(val === '' || !isNaN(Number(val))).toBeTruthy();
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
