// @ts-check
/**
 * Simula o app com Supabase ativo (REST mockado via page.route) para testar
 * o fluxo comercial quando os dados chegam DEPOIS da tela montar — regressão
 * do bug "Selecione um evento" com evento visível no seletor.
 *
 * Roda no projeto `supabase-sim` (porta 3001, env VITE_SUPABASE_* fake).
 */
const { test, expect } = require('@playwright/test');

const EVENTO_DB = {
  id: 'ev-sup-1', nome: 'Evento Vindo do Banco', local: 'Centro, Angra dos Reis',
  data_inicio: '2026-06-10', data_fim: '2026-06-12',
  status: 'ativo', tipo: 'presenca_comercial', observacoes: null,
  materiais: [], criado_em: '2026-06-01T10:00:00Z',
};

const VENDEDOR_DB = { id: 'v-sup-1', nome: 'Vendedora Supabase', ativo: true };

/**
 * Intercepta a API REST do Supabase. GETs respondem com `delayMs` de atraso
 * para simular a chegada assíncrona dos dados.
 */
async function mockSupabase(page, { delayMs = 600 } = {}) {
  /** @type {any[]} */
  const leadsInseridos = [];
  await page.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const url = req.url();
    const tabela = (url.match(/rest\/v1\/(\w+)/) || [])[1];

    if (req.method() === 'GET') {
      await new Promise((r) => setTimeout(r, delayMs));
      const dados =
        tabela === 'eventos' ? [EVENTO_DB] :
        tabela === 'vendedores' ? [VENDEDOR_DB] :
        [];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(dados) });
    }
    if (req.method() === 'POST' && tabela === 'leads') {
      leadsInseridos.push(req.postDataJSON());
      return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    }
    // Demais escritas (upserts de eventos/materiais/vendedores)
    return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
  });
  return leadsInseridos;
}

test.describe('Comercial com Supabase (dados assíncronos)', () => {

  test('vendedor já logado registra lead assim que o evento carrega do banco', async ({ page }) => {
    const leadsInseridos = await mockSupabase(page);

    // Sessão comercial já existente (cenário real: vendedor reabre o app)
    await page.addInitScript(() => {
      sessionStorage.setItem('rjnet_session', JSON.stringify({ role: 'comercial', vendedorNome: 'Vendedora Supabase' }));
    });
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

    // O lead foi enviado ao banco com o evento correto
    await expect.poll(() => leadsInseridos.length).toBeGreaterThan(0);
    expect(leadsInseridos[0].evento_id).toBe('ev-sup-1');
    expect(leadsInseridos[0].vendedor_nome).toBe('Vendedora Supabase');
    expect(leadsInseridos[0].nome).toBe('Cliente Pós-Fetch');
  });

  test('dados fictícios não aparecem enquanto o banco carrega', async ({ page }) => {
    await mockSupabase(page, { delayMs: 800 });
    await page.goto('/');

    // Login comercial: a lista de vendedores só pode conter os do banco
    const COM_USER = process.env.TEST_COMERCIAL_USER || 'comercial';
    const COM_PASS = process.env.TEST_COMERCIAL_PASS || 'com2025';
    await page.locator('.login-form input[autocomplete="username"]').fill(COM_USER);
    await page.locator('.login-form input[type="password"]').fill(COM_PASS);
    await page.locator('.login-form button[type="submit"]').click();

    await expect(page.locator('.vendedor-btn')).toHaveCount(1);
    await expect(page.locator('.vendedor-btn')).toContainText('Vendedora Supabase');

    await page.locator('.vendedor-btn').click();
    // Nenhum vestígio dos eventos mock
    await expect(page.locator('.big-select option', { hasText: 'Festa do Pescador' })).toHaveCount(0);
    await expect(page.locator('.big-select option', { hasText: 'Evento Vindo do Banco' })).toHaveCount(1);
  });

  test('marketing encerra o evento em outro dispositivo — seletor reage sem travar', async ({ page }) => {
    const leadsInseridos = await mockSupabase(page);
    await page.addInitScript(() => {
      sessionStorage.setItem('rjnet_session', JSON.stringify({ role: 'comercial', vendedorNome: 'Vendedora Supabase' }));
    });
    await page.goto('/');
    await expect(page.locator('.big-select select')).toHaveValue('ev-sup-1');

    // Simula refetch trazendo o evento encerrado (como o realtime faria)
    EVENTO_DB.status = 'encerrado';
    try {
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      // Força um novo fetch recarregando os dados via reload (o realtime não
      // funciona com REST mockado); o estado não pode travar a tela
      await page.reload();
      await expect(page.locator('text=Nenhum evento ativo no momento.')).toBeVisible();
      await expect(page.locator('.lead-submit')).not.toBeVisible();
    } finally {
      EVENTO_DB.status = 'ativo';
    }
  });

});
