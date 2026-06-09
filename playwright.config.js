// @ts-check
const { defineConfig, devices } = require('@playwright/test');

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
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Serve index.html with `npx serve` before running tests.
  // Make sure `serve` is available: npx serve is zero-install.
  webServer: {
    command: 'npx serve . -p 3000 --no-clipboard',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
