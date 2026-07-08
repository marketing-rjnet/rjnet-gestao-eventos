// @ts-check
const { test, expect } = require('@playwright/test');

// E2E do Simulador de Perfil de Consumo — página pública /s/:slug em modo
// local (sem Supabase): campanha semeada em localStorage, wizard completo
// (perguntas → resultado → contato) e lead gravado em rjnet_leads com
// origem='simulador', perfil e pontuação.

const CAMPANHA = {
  id: 'sim-teste-e2e',
  nome: 'Campanha Teste E2E',
  slug: 'campanha-teste-e2e',
  tipo: 'perfil_consumo',
  campanha: '',
  versaoPerguntas: 1,
  ativo: true,
  criadoEm: new Date().toISOString(),
};

async function abrirSimulador(page, { query = '' } = {}) {
  await page.addInitScript((campanha) => {
    localStorage.setItem('rjnet_simuladores', JSON.stringify([campanha]));
  }, CAMPANHA);
  await page.goto(`/s/${CAMPANHA.slug}${query}`);
}

async function responderQuiz(page) {
  // 1. moradores (single → avança sozinho)
  await page.locator('.sim-opcao', { hasText: '2 a 4 pessoas' }).click();
  // 2. usos (multi → precisa de Continuar)
  await page.locator('.sim-opcao', { hasText: 'Streaming' }).click();
  await page.locator('.sim-opcao', { hasText: 'Jogos online' }).click();
  await page.getByRole('button', { name: 'Continuar →' }).click();
  // 3. equipamentos (multi)
  await page.locator('.sim-opcao', { hasText: 'Smart TV' }).click();
  await page.getByRole('button', { name: 'Continuar →' }).click();
  // 4. tem_internet → "Ainda não tenho" encerra o quiz (dificuldade é condicional)
  await page.locator('.sim-opcao', { hasText: 'Ainda não tenho' }).click();
  // Tela "Analisando..." → resultado
  await expect(page.locator('.sim-resultado-badge')).toBeVisible({ timeout: 5_000 });
}

test.describe('Simulador — página pública', () => {

  test('slug inexistente mostra indisponível', async ({ page }) => {
    await page.goto('/s/nao-existe');
    await expect(page.locator('.card')).toContainText('Simulação não encontrada');
  });

  test('campanha inativa não renderiza o quiz', async ({ page }) => {
    await page.addInitScript((campanha) => {
      localStorage.setItem('rjnet_simuladores', JSON.stringify([{ ...campanha, ativo: false }]));
    }, CAMPANHA);
    await page.goto(`/s/${CAMPANHA.slug}`);
    await expect(page.locator('.card')).toContainText('Simulação não encontrada');
  });

  test('wizard exibe primeira pergunta com barra de progresso', async ({ page }) => {
    await abrirSimulador(page);
    await expect(page.locator('.sim-progress')).toBeVisible();
    await expect(page.locator('.card')).toContainText('Quantas pessoas moram com você?');
    await expect(page.locator('.card')).toContainText('Pergunta 1 de');
  });

  test('pergunta condicional: com internet aparece a dificuldade', async ({ page }) => {
    await abrirSimulador(page);
    await page.locator('.sim-opcao', { hasText: 'Moro sozinho' }).click();
    await page.locator('.sim-opcao', { hasText: 'Redes sociais' }).click();
    await page.getByRole('button', { name: 'Continuar →' }).click();
    await page.locator('.sim-opcao', { hasText: 'Celulares' }).click();
    await page.getByRole('button', { name: 'Continuar →' }).click();
    await page.locator('.sim-opcao', { hasText: 'Sim, já tenho' }).click();
    await expect(page.locator('.card')).toContainText('Qual a sua maior dificuldade hoje?');
  });

  test('fluxo completo: quiz → resultado → contato → lead gravado', async ({ page }) => {
    await abrirSimulador(page, { query: '?utm_source=meta&utm_campaign=teste-e2e' });
    await responderQuiz(page);

    // Resultado antes do contato (valor primeiro)
    await expect(page.locator('.card')).toContainText('Resultado do seu perfil');
    await page.getByRole('button', { name: /Quero receber essa oferta/ }).click();

    // Contato
    await page.locator('.big-field', { hasText: 'Nome *' }).locator('input').fill('Maria E2E');
    await page.locator('.big-field', { hasText: 'WhatsApp *' }).locator('input').fill('24999887766');
    await page.locator('.big-field', { hasText: 'Cidade' }).locator('input').fill('Itaguaí');
    await page.locator('.big-field', { hasText: 'Bairro' }).locator('input').fill('Centro');
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Receber minha oferta' }).click();

    await expect(page.locator('.card')).toContainText('Recebemos seus dados!');

    // Lead no localStorage com origem, perfil, pontuação e UTM
    const lead = await page.evaluate(() => {
      const leads = JSON.parse(localStorage.getItem('rjnet_leads')) || [];
      return leads.find((l) => l.origem === 'simulador');
    });
    expect(lead).toBeTruthy();
    expect(lead.nome).toBe('Maria E2E');
    expect(lead.simuladorId).toBe('sim-teste-e2e');
    expect(lead.vendedorId).toBeNull();
    // 2_4(+5) + streaming/jogos(+16) + sem internet(+30) = 51 → morno
    expect(lead.pontuacao).toBe(51);
    expect(lead.temperatura).toBe('morno');
    expect(lead.perfilConsumo.respostas.tem_internet).toBe('nao');
    expect(lead.servicoInteresse).toContain('internet_residencial');
    expect(lead.servicoInteresse).toContain('streamings');
    expect(lead.utm.utm_source).toBe('meta');
    expect(lead.utm.utm_campaign).toBe('teste-e2e');
    expect(lead.versaoTermo).toBe('simulador-v1');
  });

  test('validação do contato: telefone inválido e consentimento obrigatórios', async ({ page }) => {
    await abrirSimulador(page);
    await responderQuiz(page);
    await page.getByRole('button', { name: /Quero receber essa oferta/ }).click();

    await page.locator('.big-field', { hasText: 'Nome *' }).locator('input').fill('Teste');
    await page.locator('.big-field', { hasText: 'WhatsApp *' }).locator('input').fill('123');
    await page.getByRole('button', { name: 'Receber minha oferta' }).click();
    await expect(page.locator('.form-erro')).toContainText('Telefone inválido');

    await page.locator('.big-field', { hasText: 'WhatsApp *' }).locator('input').fill('24999887766');
    await page.getByRole('button', { name: 'Receber minha oferta' }).click();
    await expect(page.locator('.form-erro')).toContainText('confirmar o uso dos seus dados');
  });
});
