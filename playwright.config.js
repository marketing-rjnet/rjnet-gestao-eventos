// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const fs = require('fs');

// Em ambientes sem acesso ao CDN do Playwright, usa um Chromium já presente
// na máquina (ex: /opt/pw-browsers) em vez do download automático.
function chromiumLocal() {
  const candidatos = [
    '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  ];
  return candidatos.find((p) => fs.existsSync(p));
}
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH ||
  (process.env.CI ? undefined : chromiumLocal());

module.exports = defineConfig({
  testDir: './tests',
  // Run tests sequentially — the app uses in-memory React state, so parallel
  // tests against the same server can interfere with each other.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3000',
    // Keep a trace on first retry for debugging
    trace: 'on-first-retry',
    // Slightly longer timeout for React rendering
    actionTimeout: 10_000,
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /supabase/,
    },
    {
      // Simula o app com Supabase ativo (REST mockado via page.route)
      name: 'supabase-sim',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3001' },
      testMatch: /supabase/,
    },
  ],

  webServer: [
    {
      // Modo 100% local (localStorage + dados mock)
      command: 'npx vite --port 3000 --strictPort',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      // Modo Supabase ativo: env vars apontam para um projeto fake; os testes
      // interceptam as chamadas REST com page.route
      command: 'npx vite --port 3001 --strictPort',
      url: 'http://localhost:3001',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        VITE_SUPABASE_URL: 'https://mock-projeto.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'mock-anon-key',
      },
    },
  ],
});
