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

async function escolherPerfil(page, label = 'Gamer / Casa Conectada') {
  // match exato no label do perfil (não na descrição, que às vezes cita o
  // nome de outro perfil dentro do texto — ex: "Gamer" descreve "streaming")
  await page.locator('.sim-opcao-perfil')
    .filter({ has: page.locator('.sim-opcao-perfil-label', { hasText: label, exact: true }) })
    .click();
}

async function responderQuiz(page, { perfil = 'Gamer / Casa Conectada' } = {}) {
  await escolherPerfil(page, perfil);
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

  test('wizard exibe a escolha de perfil primeiro, com barra de progresso', async ({ page }) => {
    await abrirSimulador(page);
    await expect(page.locator('.sim-progress')).toBeVisible();
    await expect(page.locator('.card')).toContainText('Qual desses combina mais com você?');
    await expect(page.locator('.card')).toContainText('Pergunta 1 de');
    // cada opção de perfil mostra label + descrição
    await expect(page.locator('.sim-opcao-perfil', { hasText: 'Gamer / Casa Conectada' })).toContainText('jogos, streaming, vários dispositivos');
  });

  test('após escolher o perfil, a primeira pergunta do quiz aparece como passo 2', async ({ page }) => {
    await abrirSimulador(page);
    await escolherPerfil(page, 'Básico');
    await expect(page.locator('.card')).toContainText('Quantas pessoas moram com você?');
    await expect(page.locator('.card')).toContainText('Pergunta 2 de');
  });

  test('pergunta condicional: com internet aparece a dificuldade', async ({ page }) => {
    await abrirSimulador(page);
    await escolherPerfil(page, 'Home Office');
    await page.locator('.sim-opcao', { hasText: 'Moro sozinho' }).click();
    await page.locator('.sim-opcao', { hasText: 'Redes sociais' }).click();
    await page.getByRole('button', { name: 'Continuar →' }).click();
    await page.locator('.sim-opcao', { hasText: 'Celulares' }).click();
    await page.getByRole('button', { name: 'Continuar →' }).click();
    await page.locator('.sim-opcao', { hasText: 'Sim, já tenho' }).click();
    await expect(page.locator('.card')).toContainText('Qual a sua maior dificuldade hoje?');
  });

  test('fluxo completo: perfil → quiz → combo → contato → lead gravado', async ({ page }) => {
    await abrirSimulador(page, { query: '?utm_source=meta&utm_campaign=teste-e2e' });
    await responderQuiz(page, { perfil: 'Gamer / Casa Conectada' });

    // Resultado antes do contato (valor primeiro): pacote FIXO do perfil escolhido
    await expect(page.locator('.card')).toContainText('420 Mega ⭐');
    await expect(page.locator('.card')).toContainText('R$ 99,90/mês');
    await expect(page.locator('.sim-combo-total')).toContainText('R$ 99,90/mês');

    // Marca Yellow (+15) e o upgrade pro próximo pacote (+20) — total ao vivo
    await page.locator('.sim-combo-check', { hasText: 'Adicione Apps Yellow' }).locator('input').check();
    await expect(page.locator('.sim-combo-total')).toContainText('R$ 114,90/mês');
    await page.locator('.sim-combo-check', { hasText: 'Upgrade para 680 Mega' }).locator('input').check();
    await expect(page.locator('.sim-combo-total')).toContainText('R$ 134,90/mês');

    await page.getByRole('button', { name: /Quero receber essa oferta/ }).click();

    // Contato
    await page.locator('.big-field', { hasText: 'Nome *' }).locator('input').fill('Maria E2E');
    await page.locator('.big-field', { hasText: 'WhatsApp *' }).locator('input').fill('24999887766');
    await page.locator('.big-field', { hasText: 'Cidade' }).locator('input').fill('Itaguaí');
    await page.locator('.big-field', { hasText: 'Bairro' }).locator('input').fill('Centro');
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Receber minha oferta' }).click();

    await expect(page.locator('.card')).toContainText('Recebemos seus dados!');

    // Lead no localStorage com origem, perfil, combo, pontuação e UTM
    const lead = await page.evaluate(() => {
      const leads = JSON.parse(localStorage.getItem('rjnet_leads')) || [];
      return leads.find((l) => l.origem === 'simulador');
    });
    expect(lead).toBeTruthy();
    expect(lead.nome).toBe('Maria E2E');
    expect(lead.simuladorId).toBe('sim-teste-e2e');
    expect(lead.vendedorId).toBeNull();
    // 2_4(+5) + streaming/jogos(+16) + sem internet(+30) = 51 → morno (pontuação
    // de intenção continua vindo das perguntas gerais, não do perfil escolhido)
    expect(lead.pontuacao).toBe(51);
    expect(lead.temperatura).toBe('morno');
    expect(lead.perfilConsumo.respostas.tem_internet).toBe('nao');
    expect(lead.perfilConsumo.perfil).toBe('gamer');
    expect(lead.perfilConsumo.combo.pacoteMega).toBe(420);
    expect(lead.perfilConsumo.combo.yellow).toBe(true);
    expect(lead.perfilConsumo.combo.black).toBe(false);
    expect(lead.perfilConsumo.combo.upgrade).toBe(true);
    expect(lead.perfilConsumo.combo.pacoteFinalMega).toBe(680);
    expect(lead.perfilConsumo.combo.valorTotal).toBe(134.90);
    expect(lead.servicoInteresse).toContain('internet_residencial');
    expect(lead.servicoInteresse).toContain('streamings');
    expect(lead.utm.utm_source).toBe('meta');
    expect(lead.utm.utm_campaign).toBe('teste-e2e');
    expect(lead.versaoTermo).toBe('simulador-v1');
  });

  test('apps black ganha destaque quando streaming foi declarado no quiz', async ({ page }) => {
    await abrirSimulador(page);
    await responderQuiz(page, { perfil: 'Streaming' }); // responderQuiz já marca "Streaming" em usos
    await expect(page.locator('.sim-combo-check.sim-combo-destaque')).toContainText('Apps Black');
    await expect(page.locator('.sim-combo-check.sim-combo-destaque')).toContainText('combina com seu perfil');
  });

  test('territorial: cidade/bairro/interesse → contato → lead pra demanda', async ({ page }) => {
    await page.addInitScript((campanha) => {
      localStorage.setItem('rjnet_simuladores', JSON.stringify([{ ...campanha, id: 'sim-terr', slug: 'demanda-itaguai', tipo: 'territorial' }]));
    }, CAMPANHA);
    await page.goto('/s/demanda-itaguai');

    // Sem quiz: vai direto pra localização + interesse
    await expect(page.locator('.card')).toContainText('Quer internet RJNet na sua região?');
    await page.locator('.big-field', { hasText: 'Cidade *' }).locator('input').fill('Paraty');
    await page.locator('.big-field', { hasText: 'Bairro *' }).locator('input').fill('Jabaquara');
    await page.locator('.sim-opcao', { hasText: 'Internet Residencial' }).click();
    await page.getByRole('button', { name: 'Continuar →' }).click();

    // Contato sem repetir cidade/bairro
    await expect(page.locator('.card')).toContainText('Quase lá!');
    await expect(page.locator('.big-field', { hasText: 'Cidade' })).toHaveCount(0);
    await page.locator('.big-field', { hasText: 'Nome *' }).locator('input').fill('José Territorial');
    await page.locator('.big-field', { hasText: 'WhatsApp *' }).locator('input').fill('24988776655');
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Receber minha oferta' }).click();
    await expect(page.locator('.card')).toContainText('Recebemos seus dados!');

    const lead = await page.evaluate(() => (JSON.parse(localStorage.getItem('rjnet_leads')) || []).find((l) => l.origem === 'simulador'));
    expect(lead.cidade).toBe('Paraty');
    expect(lead.bairro).toBe('Jabaquara');
    expect(lead.servicoInteresse).toEqual(['internet_residencial']);
    expect(lead.temperatura).toBe('morno');
    expect(lead.pontuacao).toBeUndefined(); // territorial não tem score
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
