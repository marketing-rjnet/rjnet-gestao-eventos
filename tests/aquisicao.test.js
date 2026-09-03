// @ts-check
const { test, expect } = require('@playwright/test');
const { loginMarketing } = require('./helpers/auth');

// E2E do módulo de Aquisição / Landing Pages (D-104):
//  1. Tela do marketing em modo local — LP cadastrada sem código, dashboard,
//     funil, campanhas, conversões e detalhe com dados REAIS semeados no
//     localStorage (mesma regra da RPC, via calcularFunil()).
//  2. SDK público (public/rjnet-lp.js) numa "LP" sintética — intercepta as
//     Edge Functions e valida sessão, UTM, page_view, cta_click, form_start,
//     form_submit → lead, whatsapp_click vinculado ao lead.

const LP_FIBRA = {
  id: 'lp-fibra', nome: 'LP Fibra', slug: 'fibra', descricao: '', dominio: 'fibra.rjnet.com.br',
  servico: 'internet_residencial', status: 'ativa', campanhaPadrao: '', whatsappEnabled: true,
  whatsappNumber: null, whatsappLabel: 'Falar no WhatsApp', whatsappMensagem: '', tracking: {},
  criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString(),
};

const agora = Date.now();
const ts = (h) => new Date(agora - h * 3600_000).toISOString();
const SESSIONS = [
  { id: 's1', landingPageId: 'lp-fibra', utmSource: 'meta', utmMedium: 'paid', utmCampaign: 'fibra_setembro', utmContent: 'criativo_01', device: 'mobile', criadoEm: ts(5) },
  { id: 's2', landingPageId: 'lp-fibra', utmSource: 'meta', utmMedium: 'paid', utmCampaign: 'fibra_setembro', utmContent: 'criativo_02', device: 'desktop', criadoEm: ts(4) },
  { id: 's3', landingPageId: 'lp-fibra', utmSource: null, utmMedium: null, utmCampaign: null, device: 'mobile', criadoEm: ts(3) },
];
const EVENTS = [
  { id: 1, nome: 'page_view', sessionId: 's1', landingPageId: 'lp-fibra', propriedades: { path: '/' }, criadoEm: ts(5) },
  { id: 2, nome: 'cta_click', sessionId: 's1', landingPageId: 'lp-fibra', propriedades: { cta: 'hero' }, criadoEm: ts(5) },
  { id: 3, nome: 'form_start', sessionId: 's1', landingPageId: 'lp-fibra', propriedades: {}, criadoEm: ts(5) },
  { id: 4, nome: 'lead_created', sessionId: 's1', landingPageId: 'lp-fibra', leadId: 'l-lp-1', propriedades: {}, criadoEm: ts(5) },
  { id: 5, nome: 'whatsapp_click', sessionId: 's1', landingPageId: 'lp-fibra', leadId: 'l-lp-1', propriedades: { origem: 'cta' }, criadoEm: ts(4.9) },
  { id: 6, nome: 'page_view', sessionId: 's2', landingPageId: 'lp-fibra', propriedades: { path: '/' }, criadoEm: ts(4) },
  { id: 7, nome: 'page_view', sessionId: 's3', landingPageId: 'lp-fibra', propriedades: { path: '/' }, criadoEm: ts(3) },
];
const LEADS = [
  { id: 'l-lp-1', nome: 'Maria da LP', telefone: '(24) 99999-0001', origem: 'landing_page', landingPageId: 'lp-fibra', lpSessionId: 's1', utm: { utm_source: 'meta', utm_medium: 'paid', utm_campaign: 'fibra_setembro', utm_content: 'criativo_01' }, servicoInteresse: ['internet_residencial'], temperatura: 'morno', vendedorId: null, vendedorNome: '', consentimentoColetado: true, criadoEm: ts(5), eventoId: null, mesReferencia: null },
];

// Google Fonts é externo e pode ser lento/indisponível no CI — não faz parte do que é testado aqui.
async function bloquearFontes(page) {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
}

async function abrirAquisicao(page) {
  await loginMarketing(page);
  await page.locator('.header-nav .nav-tab', { hasText: 'Mais' }).click();
  await page.locator('.nav-more-item', { hasText: 'Landing Pages' }).click();
  await expect(page.locator('.page-title', { hasText: 'Aquisição' })).toBeVisible();
}

test.describe('Aquisição — tela do marketing (modo local)', () => {
  test.beforeEach(async ({ page }) => {
    await bloquearFontes(page);
    await page.addInitScript(({ lp, sessions, events, leads }) => {
      localStorage.setItem('rjnet_landing_pages', JSON.stringify([lp]));
      localStorage.setItem('rjnet_lp_sessions', JSON.stringify(sessions));
      localStorage.setItem('rjnet_lp_events', JSON.stringify(events));
      localStorage.setItem('rjnet_leads', JSON.stringify(leads));
    }, { lp: LP_FIBRA, sessions: SESSIONS, events: EVENTS, leads: LEADS });
  });

  test('dashboard mostra KPIs, funil e card da LP com dados reais', async ({ page }) => {
    await abrirAquisicao(page);
    await expect(page.locator('[data-testid="funil-visitas"]')).toHaveText('3');
    await expect(page.locator('[data-testid="funil-interacoes"]')).toHaveText('1');
    await expect(page.locator('[data-testid="funil-leads"]')).toHaveText('1');
    await expect(page.locator('[data-testid="funil-whatsapp"]')).toHaveText('1');
    const card = page.locator('[data-testid="lp-card"]', { hasText: 'LP Fibra' });
    await expect(card).toBeVisible();
    await expect(card.locator('.badge')).toHaveText('Ativa');
    await expect(card.locator('.lp-card-stat').nth(3)).toContainText('33,33%');
  });

  test('filtro por campanha recalcula o funil', async ({ page }) => {
    await abrirAquisicao(page);
    await page.locator('[data-testid="aq-filtros"] select').nth(2).selectOption('fibra_setembro');
    await expect(page.locator('[data-testid="funil-visitas"]')).toHaveText('2');
    await expect(page.locator('[data-testid="funil-leads"]')).toHaveText('1');
  });

  test('campanhas e conversões cruzam UTM ↔ lead ↔ WhatsApp', async ({ page }) => {
    await abrirAquisicao(page);
    await page.locator('.seg-btn', { hasText: 'Campanhas' }).click();
    const tabela = page.locator('[data-testid="tabela-campanhas"]');
    await expect(tabela.locator('tbody tr')).toHaveCount(3);
    const linha = tabela.locator('tbody tr', { hasText: 'criativo_01' });
    await expect(linha).toContainText('fibra_setembro');
    await expect(linha.locator('td').nth(5)).toHaveText('1');
    await page.locator('.seg-btn', { hasText: 'Conversões' }).click();
    const conv = page.locator('[data-testid="tabela-conversoes"]');
    await expect(conv.locator('tbody tr')).toHaveCount(1);
    await expect(conv).toContainText('Maria da LP');
    await expect(conv).toContainText('fibra_setembro');
  });

  test('detalhe da LP: eventos, leads e snippet de integração', async ({ page }) => {
    await abrirAquisicao(page);
    await page.locator('.seg-btn', { hasText: 'Landing Pages' }).click();
    await page.locator('[data-testid="lp-card"]', { hasText: 'LP Fibra' }).getByRole('button', { name: /Abrir/ }).click();
    await expect(page.locator('.page-title', { hasText: 'LP Fibra' })).toBeVisible();
    await expect(page.locator('[data-testid="funil-visitas"]')).toHaveText('3');
    await page.locator('.seg-btn', { hasText: 'Eventos' }).click();
    const ev = page.locator('[data-testid="tabela-eventos"]');
    await expect(ev.locator('tbody tr')).toHaveCount(7);
    await expect(ev).toContainText('Clique no WhatsApp');
    await expect(ev).toContainText('meta / paid / fibra_setembro');
    await page.locator('.seg-btn', { hasText: 'Leads' }).click();
    await expect(page.locator('[data-testid="tabela-leads-lp"] tbody tr')).toHaveCount(1);
    await page.locator('.seg-btn', { hasText: 'Integração' }).click();
    const snippet = page.locator('[data-testid="lp-snippet"]');
    await expect(snippet).toContainText('rjnet-lp.js');
    await expect(snippet).toContainText('data-lp="fibra"');
  });

  test('nova landing page é cadastrada sem código e o slug fica único', async ({ page }) => {
    await abrirAquisicao(page);
    await page.locator('.seg-btn', { hasText: 'Landing Pages' }).click();
    await page.getByRole('button', { name: /Nova landing page/ }).click();
    const form = page.locator('[data-testid="lp-form"]');
    await form.locator('input').first().fill('LP TV');
    await expect(form.locator('input.mono').first()).toHaveValue('lp-tv');
    await form.locator('select').first().selectOption('streamings');
    await form.locator('.seg-btn', { hasText: /^Ativa$/ }).click();
    await form.getByRole('button', { name: 'Criar landing page' }).click();
    await expect(page.locator('.page-title', { hasText: 'LP TV' })).toBeVisible();
    await expect(page.locator('.page-title .badge')).toHaveText('Ativa');
    const salvas = await page.evaluate(() => JSON.parse(localStorage.getItem('rjnet_landing_pages') || '[]'));
    expect(salvas.map((l) => l.slug).sort()).toEqual(['fibra', 'lp-tv']);
    expect(salvas.find((l) => l.slug === 'lp-tv').whatsappNumber).toBeNull();
  });

  test('lead de landing page aparece na fila de distribuição com a origem rotulada', async ({ page }) => {
    await loginMarketing(page);
    await page.locator('.header-nav .nav-tab', { hasText: 'Relatórios' }).click();
    await page.getByRole('button', { name: /Leads sem vendedor/ }).click();
    await expect(page.locator('table', { hasText: 'Maria da LP' })).toContainText('Landing Page — LP Fibra — fibra_setembro');
  });
});

// ─── SDK público ─────────────────────────────────────────────────
const SUPA = 'https://mock-projeto.supabase.co';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Content-Type': 'application/json' };

const LP_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>RJNET Fibra</title>
<script src="/rjnet-lp.js" data-lp="fibra" data-supabase-url="${SUPA}" data-anon-key="mock-anon-key" defer></script>
</head><body>
<a href="#form" id="cta" data-rjnet-cta="hero_assinar">Quero assinar</a>
<form id="form" data-rjnet-form="principal">
  <input name="nome" id="nome"><input name="telefone" id="telefone">
  <input name="bairro" id="bairro">
  <label><input type="checkbox" name="consentimento" id="consent"> Autorizo</label>
  <input name="website" style="display:none">
  <div data-rjnet-erro hidden id="erro"></div>
  <button type="submit" id="enviar">Enviar</button>
</form>
<a href="#fallback-da-lp" id="wa" data-rjnet-whatsapp="cta_final">WhatsApp</a>
</body></html>`;

test.describe('Aquisição — SDK rjnet-lp.js numa landing page', () => {
  test('sessão + UTM + eventos + lead + clique no WhatsApp chegam nas Edge Functions', async ({ page }) => {
    /** @type {any[]} */ const lotes = [];
    /** @type {any[]} */ const leadsEnviados = [];
    await page.addInitScript(() => { window.__aberturas = []; window.open = (u) => { window.__aberturas.push(u); return null; }; });
    await bloquearFontes(page);
    await page.route(/\/lp-teste(\?|$)/, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: LP_HTML }));
    await page.route(`${SUPA}/**`, async (route) => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: CORS, body: '' });
      const url = req.url();
      const body = req.postDataJSON();
      if (url.includes('/rest/v1/rpc/landing_page_publica')) {
        return route.fulfill({ status: 200, headers: CORS, body: JSON.stringify({ id: 'lp-fibra', nome: 'LP Fibra', slug: 'fibra', servico: 'internet_residencial', whatsapp_enabled: true, whatsapp_number: '5524999999999', whatsapp_mensagem: 'Olá RJNET', tracking: {} }) });
      }
      if (url.includes('/functions/v1/rastrear-lp')) { lotes.push(body); return route.fulfill({ status: 200, headers: CORS, body: JSON.stringify({ ok: true, recebidos: body.events.length }) }); }
      if (url.includes('/functions/v1/submeter-lp')) { leadsEnviados.push(body); return route.fulfill({ status: 200, headers: CORS, body: JSON.stringify({ ok: true, leadId: 'l-lp-e2e' }) }); }
      return route.fulfill({ status: 404, headers: CORS, body: '{}' });
    });

    await page.goto('/lp-teste?utm_source=meta&utm_medium=paid&utm_campaign=fibra_setembro&utm_content=criativo_01');
    await page.waitForFunction(() => Boolean(window.RJNetLP));

    // page_view com sessão + UTM (first touch)
    await expect.poll(() => lotes.flatMap((l) => l.events.map((e) => e.nome))).toContain('page_view');
    const primeiro = lotes[0];
    expect(primeiro.slug).toBe('fibra');
    expect(primeiro.session.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(primeiro.session.utm).toEqual({ utm_source: 'meta', utm_medium: 'paid', utm_campaign: 'fibra_setembro', utm_content: 'criativo_01' });
    expect(['mobile', 'desktop', 'tablet']).toContain(primeiro.session.device);
    const sessionId = primeiro.session.id;

    // interações
    await page.locator('#cta').click();
    await page.locator('#nome').fill('Cliente E2E');
    await expect.poll(() => lotes.flatMap((l) => l.events.map((e) => e.nome))).toContain('cta_click');
    await expect.poll(() => lotes.flatMap((l) => l.events.map((e) => e.nome))).toContain('form_start');

    // lead
    await page.locator('#telefone').fill('(24) 99999-1234');
    await page.locator('#bairro').fill('Centro');
    await page.locator('#consent').check();
    await page.locator('#enviar').click();
    await expect.poll(() => leadsEnviados.length).toBe(1);
    expect(leadsEnviados[0]).toMatchObject({ slug: 'fibra', sessionId, nome: 'Cliente E2E', telefone: '(24) 99999-1234', bairro: 'Centro', consentimentoColetado: true, utm: { utm_campaign: 'fibra_setembro' } });
    await expect(page.locator('#form')).toHaveClass(/rjnet-enviado/);
    await expect.poll(() => page.evaluate(() => window.RJNetLP.getSession().leadId)).toBe('l-lp-e2e');
    await expect.poll(() => lotes.flatMap((l) => l.events.map((e) => e.nome))).toContain('form_submit');

    // WhatsApp: rastreado COM leadId e aberto com o número configurado (nunca hardcoded)
    await page.locator('#wa').click();
    await expect.poll(() => lotes.flatMap((l) => l.events).filter((e) => e.nome === 'whatsapp_click').length).toBe(1);
    const wa = lotes.flatMap((l) => l.events).find((e) => e.nome === 'whatsapp_click');
    expect(wa.leadId).toBe('l-lp-e2e');
    const aberturas = await page.evaluate(() => window.__aberturas);
    expect(aberturas[0]).toBe('https://wa.me/5524999999999?text=Ol%C3%A1%20RJNET');
    expect(page.url()).not.toContain('#fallback-da-lp');
    // toda chamada carregou a sessão inteira (upsert idempotente no servidor)
    expect(lotes.every((l) => l.session.id === sessionId)).toBe(true);
  });

  test('sem consentimento o lead é recusado e a página segue funcionando; sem número, o WhatsApp usa o link da LP', async ({ page }) => {
    /** @type {any[]} */ const lotes = [];
    await page.addInitScript(() => { window.__aberturas = []; window.open = (u) => { window.__aberturas.push(u); return null; }; });
    await bloquearFontes(page);
    await page.route(/\/lp-teste(\?|$)/, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: LP_HTML }));
    await page.route(`${SUPA}/**`, async (route) => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: CORS, body: '' });
      const url = req.url();
      if (url.includes('landing_page_publica')) return route.fulfill({ status: 200, headers: CORS, body: JSON.stringify({ id: 'lp-fibra', slug: 'fibra', whatsapp_enabled: true, whatsapp_number: null, tracking: {} }) });
      if (url.includes('rastrear-lp')) { lotes.push(req.postDataJSON()); return route.fulfill({ status: 200, headers: CORS, body: '{"ok":true}' }); }
      if (url.includes('submeter-lp')) return route.fulfill({ status: 400, headers: CORS, body: JSON.stringify({ error: 'É necessário confirmar o consentimento para uso dos dados.' }) });
      return route.fulfill({ status: 404, headers: CORS, body: '{}' });
    });
    await page.goto('/lp-teste');
    await page.waitForFunction(() => Boolean(window.RJNetLP));
    await page.locator('#nome').fill('Sem Consentimento');
    await page.locator('#telefone').fill('24999990000');
    await page.locator('#enviar').click();
    await expect(page.locator('#erro')).toHaveText(/consentimento/);
    await expect(page.locator('#enviar')).toBeEnabled();

    // sem número configurado: evento rastreado, sem window.open — o href da LP segue
    await page.locator('#wa').click();
    await expect.poll(() => lotes.flatMap((l) => l.events).some((e) => e.nome === 'whatsapp_click' && e.leadId === null)).toBe(true);
    expect(await page.evaluate(() => window.__aberturas.length)).toBe(0);
    expect(page.url()).toContain('#fallback-da-lp');
  });
});
