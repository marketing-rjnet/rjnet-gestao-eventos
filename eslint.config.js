// Config plana do ESLint (flat config).
// Sem "type": "module" no package.json → este arquivo é CommonJS (require).
const js = require('@eslint/js');
const globals = require('globals');
const reactHooks = require('eslint-plugin-react-hooks');
const reactRefresh = require('eslint-plugin-react-refresh').default;

const unusedVarsRule = ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }];

module.exports = [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      // TypeScript/Deno (Edge Function) — fora do escopo deste lint JS/JSX.
      'supabase/functions/**',
      // Scripts k6 (runtime próprio, globals como __ENV/__VU não existem no Node/browser).
      'tests/load/**',
    ],
  },

  js.configs.recommended,

  // Código de aplicação (browser, ESM, JSX)
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      // Apenas as regras clássicas (rules-of-hooks/exhaustive-deps) — o "recommended"
      // do plugin v7 traz regras novas voltadas ao React Compiler (purity, immutability
      // etc.) que não se aplicam a este projeto e gerariam ruído desconectado de bugs reais.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': unusedVarsRule,
      // catch {} silencioso é padrão intencional neste arquivo (ex: localStorage
      // indisponível em modo privado) — não é bloco esquecido por engano.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // Testes e config Node em CommonJS (usam require/module/process).
  // Globals de browser inclusos: testes Playwright referenciam document/window
  // dentro de callbacks de page.evaluate()/addInitScript(), que rodam no browser.
  {
    files: ['tests/**/*.js', 'config/**/*.js', 'playwright.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-unused-vars': unusedVarsRule,
    },
  },

  // vite.config.js e este próprio arquivo: Node, mas cada um com sourceType diferente
  {
    files: ['vite.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module', // Vite carrega config em ESM mesmo sem "type": "module"
      globals: { ...globals.node },
    },
  },
  {
    files: ['eslint.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },
];
