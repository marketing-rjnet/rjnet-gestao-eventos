// @ts-check
/**
 * Simula o app com Supabase ativo (Auth + REST mockados via page.route):
 * - login individual por e-mail/senha e roteamento por papel
 * - fluxo do vendedor com dados chegando DEPOIS da tela montar (regressão
 *   do bug "Selecione um evento")
 * - área comercial somente leitura
 *
 * Roda no projeto `supabase-sim` (porta 3001, env VITE_SUPABASE_* fake).
 */
const { test, expect } = require('@playwright/test');

const REF = 'mock-projeto';

const EVENTO_DB = {
  id: 'ev-sup-1', nome: 'Evento Vindo do Banco', local: 'Centro, Angra dos Reis',
  data_inicio: '2026-06-10', data_fim: '2026-06-12',
  status: 'ativo', tipo: 'presenca_comercial', observacoes: null,
  materiais: [], criado_em: '2026-06-01T10:00:00Z',
};

const USERS = {
  vendedor: {
    user: {
      id: 'u-vend-1', aud: 'authenticated', role: 'authenticated',
      email: 'vendedora@rjnet.com', email_confirmed_at: '2026-01-01T00:00:00Z',
      app_metadata: { provider: 'email' }, user_metadata: { nome: 'Vendedora Supabase' },
      created_at: '2026-01-01T00:00:00Z',
    },
    perfil: { id: 'u-vend-1', email: 'vendedora@rjnet.com', nome: 'Vendedora Supabase', papel: 'vendedor', ativo: true, criado_em: '2026-01-01T00:00:00Z' },
  },
  comercial: {
    user: {
      id: 'u-com-1', aud: 'authenticated', role: 'authenticated',
      email: 'comercial@rjnet.com', email_confirmed_at: '2026-01-01T00:00:00Z',
      app_metadata: { provider: 'email' }, user_metadata: { nome: 'Análise Comercial' },
      created_at: '2026-01-01T00:00:00Z',
    },
    perfil: { id: 'u-com-1', email: 'comercial@rjnet.com', nome: 'Análise Comercial', papel: 'comercial', ativo: true, criado_em: '2026-01-01T00:00:00Z' },
  },
};

const sessionJson = (user) => ({
  access_token: 'mock-token', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'mock-refresh', user,
});

/**
 * Intercepta Auth e REST do Supabase. GETs de dados respondem com `delayMs`
 * de atraso para simular a chegada assíncrona.
 */
async function mockSupabase(page, { delayMs = 600, papel = 'vendedor', leads = [] } = {}) {
  const conta = USERS[papel];
  /** @type {any[]} */
  const leadsInseridos = [];

  await page.route('**/auth/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/token')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessionJson(conta.user)) });
    }
    if (url.includes('/logout')) return route.fulfill({ status: 204, body: '' });
    if (url.includes('/user')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(conta.user) });
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
        body: JSON.stringify(single ? conta.perfil : [conta.perfil]),
      });
    }

    if (req.method() === 'GET') {
      await new Promise((r) => setTimeout(r, delayMs));
      const dados =
        tabela === 'eventos' ? [EVENTO_DB] :
        tabela === 'leads' ? [...leads, ...leadsInseridos] :
        [];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(dados) });
    }
    if (req.method() === 'POST' && tabela === 'leads') {
      leadsInseridos.push(req.postDataJSON());
      return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    }
    // Demais escritas (upserts de eventos/materiais/perfis)
    return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
  });

  return leadsInseridos;
}

/** Grava uma sessão Auth válida antes do app carregar (usuário que reabre o app). */
async function sessaoSalva(page, papel = 'vendedor') {
  await page.addInitScript(([key, sessao]) => {
    localStorage.setItem(key, sessao);
  }, [`sb-${REF}-auth-token`, JSON.stringify(sessionJson(USERS[papel].user))]);
}

async function loginPorEmail(page, papel) {
  const conta = USERS[papel];
  await page.goto('/');
  await page.locator('.login-form input[type="email"]').fill(conta.user.email);
  await page.locator('.login-form input[type="password"]').fill('senha-mock-123');
  await page.locator('.login-form button[type="submit"]').click();
}

test.describe('Supabase Auth — papéis e dados assíncronos', () => {

  test('vendedor loga com e-mail e cai direto na tela de registro', async ({ page }) => {
    await mockSupabase(page, { papel: 'vendedor' });
    await loginPorEmail(page, 'vendedor');

    await expect(page.locator('.user-badge .ub-name')).toHaveText('Vendedora Supabase');
    await expect(page.locator('.lead-submit')).toBeVisible();
    // Não existe mais a tela "Selecione seu perfil"
    await expect(page.locator('.vendedor-list')).not.toBeVisible();
  });

  test('vendedor já logado registra lead assim que o evento carrega do banco', async ({ page }) => {
    const leadsInseridos = await mockSupabase(page, { papel: 'vendedor' });
    await sessaoSalva(page, 'vendedor');
    await page.goto('/');

    // A tela monta ANTES dos dados chegarem; o evento aparece depois
    await expect(page.locator('.big-select option', { hasText: 'Evento Vindo do Banco' })).toHaveCount(1);
    await expect(page.locator('.big-select select')).toHaveValue('ev-sup-1');

    // Regressão: registrar sem recarregar a página deve funcionar
    await page.getByPlaceholder('Nome do cliente').fill('Cliente Pós-Fetch');
    await page.getByPlaceholder('(24) 99999-9999').fill('24999112233');
    await page.locator('.lead-submit').click();

    await expect(page.locator('text=Selecione um evento')).not.toBeVisible();
    await expect(page.locator('.toast')).toContainText('Cliente Pós-Fetch');

    // O lead foi ao banco amarrado ao usuário autenticado
    await expect.poll(() => leadsInseridos.length).toBeGreaterThan(0);
    expect(leadsInseridos[0].evento_id).toBe('ev-sup-1');
    expect(leadsInseridos[0].vendedor_id).toBe('u-vend-1');
    expect(leadsInseridos[0].vendedor_nome).toBe('Vendedora Supabase');
  });

  test('placar da equipe aparece sem expor leads dos colegas', async ({ page }) => {
    // O servidor devolve só os leads da própria vendedora; o placar vem da RPC
    await mockSupabase(page, {
      papel: 'vendedor',
      leads: [{
        id: 'l-x', evento_id: 'ev-sup-1', vendedor_nome: 'Vendedora Supabase', vendedor_id: 'u-vend-1',
        nome: 'Cliente Próprio', telefone: '(24) 99999-0000', cpf: null, endereco: null,
        servico_interesse: 'internet_residencial', temperatura: 'morno', observacao: null,
        ja_cliente_rjnet: false, criado_em: '2026-06-10T12:00:00Z',
      }],
    });
    await sessaoSalva(page, 'vendedor');
    await page.goto('/');
    await expect(page.locator('.big-select select')).toHaveValue('ev-sup-1');

    await page.locator('.vend-nav-btn', { hasText: 'Evento' }).click();
    await expect(page.locator('.ranking-item.me')).toContainText('Vendedora Supabase');
    await expect(page.locator('.ranking-count').first()).toHaveText('1');
  });

  test('dados fictícios não aparecem enquanto o banco carrega', async ({ page }) => {
    await mockSupabase(page, { papel: 'vendedor', delayMs: 800 });
    await loginPorEmail(page, 'vendedor');

    await expect(page.locator('.big-select option', { hasText: 'Festa do Pescador' })).toHaveCount(0);
    await expect(page.locator('.big-select option', { hasText: 'Evento Vindo do Banco' })).toHaveCount(1);
  });

  test('perfil comercial cai na área de observação, somente leitura', async ({ page }) => {
    await mockSupabase(page, {
      papel: 'comercial',
      leads: [{
        id: 'l-1', evento_id: 'ev-sup-1', vendedor_nome: 'Vendedora Supabase', vendedor_id: 'u-vend-1',
        nome: 'Lead Observado', telefone: '(24) 98888-7777', cpf: null, endereco: 'Rua A, 1',
        servico_interesse: 'internet_residencial', temperatura: 'quente', observacao: null,
        ja_cliente_rjnet: false, criado_em: '2026-06-09T15:00:00Z',
      }],
    });
    await loginPorEmail(page, 'comercial');

    // Dashboard de leads com filtros, sem abas administrativas
    await expect(page.locator('.page-title')).toHaveText('Leads');
    await expect(page.locator('.tbl-wrap table')).toContainText('Lead Observado');
    await expect(page.locator('.header-nav')).not.toBeVisible();
    await expect(page.locator('.lead-submit')).not.toBeVisible();
  });

  test('marketing encerra o evento em outro dispositivo — seletor reage sem travar', async ({ page }) => {
    await mockSupabase(page, { papel: 'vendedor' });
    await sessaoSalva(page, 'vendedor');
    await page.goto('/');
    await expect(page.locator('.big-select select')).toHaveValue('ev-sup-1');

    // Simula refetch trazendo o evento encerrado (como o realtime faria)
    EVENTO_DB.status = 'encerrado';
    try {
      await page.reload();
      await expect(page.locator('text=Nenhum evento ativo no momento.')).toBeVisible();
      await expect(page.locator('.lead-submit')).not.toBeVisible();
    } finally {
      EVENTO_DB.status = 'ativo';
    }
  });

});
