// @ts-check
/**
 * Mock de Auth + REST do Supabase para testes E2E no projeto `supabase-sim`
 * (porta 3001, env VITE_SUPABASE_* fake — ver playwright.config.js).
 *
 * Extraído de comercial-supabase.test.js para reuso: o modo legado (porta
 * 3000) não tem mais nenhum caminho de UI para "virar" um vendedor (a tela
 * de seleção foi removida) — todo teste que precisa de uma sessão de
 * vendedor real precisa autenticar via este mock, no projeto supabase-sim.
 */
const REF = 'mock-projeto';

const EVENTO_PADRAO = {
  id: 'e1', nome: 'Festa do Pescador - Angra', local: 'Praia do Anil, Angra dos Reis',
  data_inicio: '2025-06-07', data_fim: '2025-06-08',
  status: 'ativo', tipo: 'presenca_comercial', observacoes: null,
  materiais: [], criado_em: '2025-05-28T10:00:00Z',
};

const USERS = {
  vendedor: {
    user: {
      id: 'u-vend-1', aud: 'authenticated', role: 'authenticated',
      email: 'vendedora@rjnet.com', email_confirmed_at: '2026-01-01T00:00:00Z',
      app_metadata: { provider: 'email' }, user_metadata: { nome: 'Carlos Silva' },
      created_at: '2026-01-01T00:00:00Z',
    },
    perfil: { id: 'u-vend-1', email: 'vendedora@rjnet.com', nome: 'Carlos Silva', papel: 'vendedor', ativo: true, criado_em: '2026-01-01T00:00:00Z' },
  },
  marketing: {
    user: {
      id: 'u-mkt-1', aud: 'authenticated', role: 'authenticated',
      email: 'marketing@rjnet.com', email_confirmed_at: '2026-01-01T00:00:00Z',
      app_metadata: { provider: 'email' }, user_metadata: { nome: 'Marketing' },
      created_at: '2026-01-01T00:00:00Z',
    },
    perfil: { id: 'u-mkt-1', email: 'marketing@rjnet.com', nome: 'Marketing', papel: 'marketing', ativo: true, criado_em: '2026-01-01T00:00:00Z' },
  },
};

const sessionJson = (user) => ({
  access_token: 'mock-token', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'mock-refresh', user,
});

/**
 * Intercepta Auth e REST do Supabase.
 * `eventos`: lista de eventos que o mock retorna (default: 1 evento ativo).
 * `leads`: leads pré-existentes devolvidos pelo GET; leads criados no teste
 * via POST são acumulados à parte e devolvidos junto nos GETs seguintes.
 */
async function mockSupabase(page, { delayMs = 0, papel = 'vendedor', leads = [], eventos = [EVENTO_PADRAO] } = {}) {
  // Mutável: um teste pode logar como vendedor, sair e logar como marketing
  // na mesma página — o mock precisa responder com a identidade certa em
  // cada momento, não só a inicial.
  let contaAtual = USERS[papel];
  /** @type {any[]} */
  const leadsInseridos = [];

  await page.route('**/auth/v1/**', async (route) => {
    const req = route.request();
    const url = req.url();
    if (url.includes('/token')) {
      const body = req.postDataJSON?.() ?? {};
      const encontrada = Object.values(USERS).find((u) => u.user.email === body.email);
      if (encontrada) contaAtual = encontrada;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessionJson(contaAtual.user)) });
    }
    if (url.includes('/logout')) return route.fulfill({ status: 204, body: '' });
    if (url.includes('/user')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(contaAtual.user) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const url = req.url();
    const tabela = (url.match(/rest\/v1\/(?:rpc\/)?(\w+)/) || [])[1];

    if (url.includes('/rpc/ranking_evento')) {
      const totais = {};
      [...leads, ...leadsInseridos].forEach((l) => { totais[l.vendedor_nome] = (totais[l.vendedor_nome] || 0) + 1; });
      const corpo = Object.entries(totais).map(([vendedor_nome, total]) => ({ vendedor_nome, total }));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corpo) });
    }

    if (req.method() === 'GET' && tabela === 'perfis') {
      // .maybeSingle() (busca por id) espera objeto; listagem espera array
      const single = url.includes('id=eq.');
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(single ? contaAtual.perfil : [contaAtual.perfil]),
      });
    }

    if (req.method() === 'GET') {
      await new Promise((r) => setTimeout(r, delayMs));
      const dados =
        tabela === 'eventos' ? eventos :
        tabela === 'leads' ? [...leads, ...leadsInseridos] :
        [];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(dados) });
    }
    if (req.method() === 'POST' && tabela === 'leads') {
      leadsInseridos.push(req.postDataJSON());
      return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    }
    if (req.method() === 'DELETE' && tabela === 'leads') {
      const id = (url.match(/id=eq\.([^&]+)/) || [])[1];
      const idx = leadsInseridos.findIndex((l) => l.id === id);
      if (idx >= 0) leadsInseridos.splice(idx, 1);
      return route.fulfill({ status: 204, body: '' });
    }
    // Demais escritas (upserts de eventos/materiais/perfis)
    return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
  });

  return leadsInseridos;
}

/** Grava uma sessão Auth válida antes do app carregar (usuário que reabre o app).
 *  sessionStorage, não localStorage: src/lib/supabase.js configura o client
 *  Supabase Auth com `auth: { storage: sessionStorage }`. */
async function sessaoSalva(page, papel = 'vendedor') {
  await page.addInitScript(([key, sessao]) => {
    sessionStorage.setItem(key, sessao);
  }, [`sb-${REF}-auth-token`, JSON.stringify(sessionJson(USERS[papel].user))]);
}

async function loginPorEmail(page, papel = 'vendedor') {
  const conta = USERS[papel];
  await page.goto('/');
  await page.locator('.login-form input[type="email"]').fill(conta.user.email);
  await page.locator('.login-form input[type="password"]').fill('senha-mock-123');
  await page.locator('.login-form button[type="submit"]').click();
  // .app-header existe tanto no MarketingApp quanto no VendedorApp.
  await page.locator('.app-header').waitFor({ state: 'visible' });
}

module.exports = { REF, EVENTO_PADRAO, USERS, sessionJson, mockSupabase, sessaoSalva, loginPorEmail };
