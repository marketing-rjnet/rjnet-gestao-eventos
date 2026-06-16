/**
 * Captura screenshots reais do sistema RJNET para a apresentação executiva.
 * Usa o Playwright com o Chromium local.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = 'http://localhost:3000';
const OUT  = path.join(__dirname, 'screenshots');

fs.mkdirSync(OUT, { recursive: true });

// Dados de seed para tornar o sistema rico visualmente
const SEED_DATA = {
  eventos: [
    { id:'e001', nome:'Ação Centro — Junho', local:'Av. Central, 1200 — Centro', dataInicio:'2026-06-15', dataFim:'2026-06-18', tipo:'presenca_comercial', status:'ativo',     observacoes:'Pico de atendimento esperado no sábado.', materiais:[{materialId:'m001',quantidade:20,retornado:false},{materialId:'m002',quantidade:50,retornado:false}], criadoEm:'2026-06-01T10:00:00Z' },
    { id:'e002', nome:'Shopping Sul',         local:'Av. das Américas, 450 — Barra', dataInicio:'2026-06-22', dataFim:'2026-06-23', tipo:'sinalizacao',        status:'planejado', observacoes:'', materiais:[{materialId:'m001',quantidade:10,retornado:false}], criadoEm:'2026-06-05T10:00:00Z' },
    { id:'e003', nome:'Terminal Norte',        local:'Rua Norte, 88 — Madureira',    dataInicio:'2026-06-28', dataFim:'2026-06-29', tipo:'ativacao_especial',  status:'planejado', observacoes:'', materiais:[], criadoEm:'2026-06-08T10:00:00Z' },
    { id:'e004', nome:'Feira de TI',           local:'Riocentro — Pavilhão 5',       dataInicio:'2026-05-10', dataFim:'2026-05-12', tipo:'presenca_comercial', status:'encerrado', observacoes:'Evento muito bem-sucedido.', materiais:[{materialId:'m002',quantidade:30,retornado:true}], criadoEm:'2026-04-20T10:00:00Z' },
  ],
  materiais: [
    { id:'m001', nome:'Banner 3x2m',     quantidade:8,  descricao:'Banner vertical impresso' },
    { id:'m002', nome:'Flyer A4',        quantidade:200, descricao:'Folder informativo' },
    { id:'m003', nome:'Brinde Kit',      quantidade:3,  descricao:'Caneta + bloco + squeeze' },
    { id:'m004', nome:'Totem Display',   quantidade:12, descricao:'Totem retráctil 2m' },
    { id:'m005', nome:'Camiseta P',      quantidade:0,  descricao:'Camiseta polo tamanho P' },
    { id:'m006', nome:'Camiseta M',      quantidade:2,  descricao:'Camiseta polo tamanho M' },
  ],
  leads: [
    { id:'l001', nome:'João da Silva',    telefone:'(21) 98765-4321', cpf:'123.456.789-00', endereco:'Rua das Flores, 10 — Centro', servicoInteresse:'internet_residencial', temperatura:'quente',    observacao:'Mora em área coberta. Quer 120 Mega.', jaClienteRjnet:false, eventoId:'e001', vendedorNome:'Ana Lima',  criadoEm:'2026-06-15T10:30:00Z' },
    { id:'l002', nome:'Maria Oliveira',   telefone:'(21) 99234-5678', cpf:'987.654.321-00', endereco:'Av. Brasil, 500 — Tijuca',    servicoInteresse:'internet_residencial', temperatura:'morno',    observacao:'Aguardando visita técnica.',           jaClienteRjnet:false, eventoId:'e001', vendedorNome:'Ana Lima',  criadoEm:'2026-06-15T11:00:00Z' },
    { id:'l003', nome:'Carlos Pereira',   telefone:'(21) 91234-5678', cpf:'',               endereco:'Rua A, 33 — Copacabana',      servicoInteresse:'internet_empresarial', temperatura:'convertido',observacao:'Fechou plano empresa 240 Mega.',        jaClienteRjnet:true,  eventoId:'e001', vendedorNome:'Carlos M.', criadoEm:'2026-06-15T12:00:00Z' },
    { id:'l004', nome:'Patricia Santos',  telefone:'(21) 97654-3210', cpf:'',               endereco:'Rua B, 22 — Botafogo',        servicoInteresse:'rjnet_movel',          temperatura:'frio',     observacao:'',                                     jaClienteRjnet:false, eventoId:'e001', vendedorNome:'Marcos V.', criadoEm:'2026-06-15T13:00:00Z' },
    { id:'l005', nome:'Roberto Lima',     telefone:'(21) 96543-2109', cpf:'',               endereco:'Av. C, 100 — Leme',           servicoInteresse:'internet_residencial', temperatura:'quente',    observacao:'Quer portabilidade.',                  jaClienteRjnet:false, eventoId:'e001', vendedorNome:'Ana Lima',  criadoEm:'2026-06-15T14:00:00Z' },
    { id:'l006', nome:'Fernanda Costa',   telefone:'(21) 95432-1098', cpf:'',               endereco:'Rua D, 5 — Ipanema',          servicoInteresse:'streamings',           temperatura:'morno',    observacao:'Interesse em combo.',                  jaClienteRjnet:false, eventoId:'e001', vendedorNome:'Carlos M.', criadoEm:'2026-06-15T14:30:00Z' },
    { id:'l007', nome:'André Souza',      telefone:'(21) 94321-0987', cpf:'',               endereco:'',                            servicoInteresse:'internet_residencial', temperatura:'quente',    observacao:'',                                     jaClienteRjnet:false, eventoId:'e004', vendedorNome:'Ana Lima',  criadoEm:'2026-05-10T10:00:00Z' },
    { id:'l008', nome:'Lucia Mendes',     telefone:'(21) 93210-9876', cpf:'',               endereco:'',                            servicoInteresse:'internet_empresarial', temperatura:'convertido',observacao:'',                                     jaClienteRjnet:false, eventoId:'e004', vendedorNome:'Marcos V.', criadoEm:'2026-05-10T11:00:00Z' },
  ],
  vendedores: [
    { id:'v001', nome:'Ana Lima',  ativo:true  },
    { id:'v002', nome:'Carlos M.', ativo:true  },
    { id:'v003', nome:'Marcos V.', ativo:true  },
    { id:'v004', nome:'Juliana P.', ativo:true },
  ],
};

async function seedData(page) {
  await page.evaluate((data) => {
    localStorage.setItem('rjnet_eventos',    JSON.stringify(data.eventos));
    localStorage.setItem('rjnet_materiais',  JSON.stringify(data.materiais));
    localStorage.setItem('rjnet_leads',      JSON.stringify(data.leads));
    localStorage.setItem('rjnet_vendedores', JSON.stringify(data.vendedores));
  }, SEED_DATA);
}

async function shot(page, name, opts = {}) {
  await page.waitForTimeout(opts.wait || 800);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false, ...opts });
  console.log(`📸 ${name}.png`);
  return file;
}

async function clickNavTab(page, label) {
  const tab = page.locator('button.nav-tab').filter({ hasText: label }).first();
  const count = await tab.count();
  if (count > 0) {
    await tab.click();
    await page.waitForTimeout(800);
    console.log(`✓ Navegou para: ${label}`);
  } else {
    console.warn(`⚠ Aba não encontrada: "${label}"`);
  }
}

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  // ─── DESKTOP SCREENSHOTS (marketing) ─────────────────────────────────────
  const desktop = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1.5,
  });
  const dp = await desktop.newPage();

  // Login page
  await dp.goto(BASE, { waitUntil: 'networkidle' });
  await shot(dp, '00_login', { wait: 400 });

  // Seed data into localStorage
  await seedData(dp);

  // Login as marketing
  const formInputs = dp.locator('.login-form input');
  await formInputs.nth(0).fill('marketing');
  await formInputs.nth(1).fill('marketing123');
  await dp.keyboard.press('Enter');
  await dp.waitForTimeout(1500);
  try { await dp.waitForLoadState('networkidle', { timeout: 3000 }); } catch {}
  await dp.waitForTimeout(500);

  // Dashboard (default first tab is Eventos, but the app may show dashboard-like content)
  await shot(dp, '01_dashboard');

  // Eventos tab (click to ensure we're there)
  await clickNavTab(dp, 'Eventos');
  await shot(dp, '02_eventos_lista');

  // Click first event card to see detail
  const eventCard = dp.locator('.event-card').first();
  if (await eventCard.count() > 0) {
    await eventCard.click();
    await dp.waitForTimeout(1000);
    await shot(dp, '03_evento_detalhe');
    // Go back via the Voltar button
    const backBtn = dp.locator('button').filter({ hasText: /Voltar/i }).first();
    if (await backBtn.count() > 0) {
      await backBtn.click();
      await dp.waitForTimeout(600);
    }
  }

  // Estoque tab
  await clickNavTab(dp, 'Estoque');
  await shot(dp, '04_estoque');

  // Leads tab
  await clickNavTab(dp, 'Leads');
  await shot(dp, '05_leads');

  // Check-in tab
  await clickNavTab(dp, 'Check-in');
  await shot(dp, '06_checkin_vazio');

  // Type a CPF to simulate search
  const evSelect = dp.locator('select').first();
  if (await evSelect.count() > 0) await evSelect.selectOption({ index: 0 });
  await dp.waitForTimeout(300);
  const cpfInput = dp.locator('input[inputmode="numeric"], input[placeholder*="CPF"], input[placeholder*="cpf"]').first();
  if (await cpfInput.count() > 0) {
    await cpfInput.fill('123.456.789-00');
    await dp.waitForTimeout(800);
    await shot(dp, '06_checkin_encontrado');
    await cpfInput.fill('999.000.000-00');
    await dp.waitForTimeout(800);
    await shot(dp, '06_checkin_nao_encontrado');
  }

  // Equipe tab
  await clickNavTab(dp, 'Equipe');
  await shot(dp, '07_equipe');

  await desktop.close();

  // ─── MOBILE SCREENSHOTS (vendedor app) ───────────────────────────────────
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    isMobile: true,
    hasTouch: true,
  });
  const mp = await mobile.newPage();

  await mp.goto(BASE, { waitUntil: 'networkidle' });
  await seedData(mp);
  // Inject a vendedor session directly — local mode reads from sessionStorage
  await mp.evaluate(() => {
    const session = { role: 'vendedor', vendedorNome: 'Ana Lima', userId: 'v001' };
    sessionStorage.setItem('rjnet_session', JSON.stringify(session));
  });
  await mp.reload({ waitUntil: 'networkidle' });
  await mp.waitForTimeout(1000);

  await shot(mp, '08_app_registrar');

  // Try navigating mobile tabs
  const mobileTabLabels = ['Meus Leads', 'Evento', 'Pacotes'];
  const mobileFileNames = ['09_app_meus_leads', '10_app_evento', '11_app_pacotes'];

  for (let i = 0; i < mobileTabLabels.length; i++) {
    const mTab = mp.locator('button.vend-nav-btn, button').filter({ hasText: mobileTabLabels[i] }).first();
    if (await mTab.count() > 0) {
      await mTab.click();
      await mp.waitForTimeout(600);
      console.log(`✓ Mobile: ${mobileTabLabels[i]}`);
    } else {
      console.warn(`⚠ Mobile tab não encontrada: "${mobileTabLabels[i]}"`);
    }
    await shot(mp, mobileFileNames[i]);
  }

  await mobile.close();
  await browser.close();

  console.log('\n✅ Screenshots capturadas em:', OUT);
  const files = fs.readdirSync(OUT).filter(f => f.endsWith('.png'));
  console.log(`   ${files.length} arquivos: ${files.join(', ')}`);
})();
