// @ts-check
const { test, expect } = require('@playwright/test');

// E2E do Simulador de Perfil de Consumo — página pública /s/:slug em modo
// local (sem Supabase): campanha semeada em localStorage, wizard completo
// (perfil → perguntas → resultado → contato) e lead gravado em
// rjnet_leads com origem='simulador', perfil, combo e pontuação.
//
// D-075: as perguntas de intenção agora são um questionário PRÓPRIO por
// campanha (editável na gestão) — sem `perguntas` seedada, a campanha usa
// o molde padrão (perguntasPadrao(), mesmos textos/pesos do antigo
// catálogo fixo D-072). Perguntas deixaram de ser condicionais (a
// "dificuldade" aparece sempre agora, mesmo sem internet).

const CAMPANHA = {
  id: 'sim-teste-e2e',
  nome: 'Campanha Teste E2E',
  slug: 'campanha-teste-e2e',
  tipo: 'perfil_consumo',
  campanha: '',
  versaoPerguntas: 2,
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

// Responde o molde padrão completo (5 perguntas, todas sempre visíveis
// desde o D-075): moradores → usos → equipamentos → tem_internet →
// dificuldade. pontuacao resultante = 5+16+2+30+20 = 73 de 102 máximo
// (71,6%) → quente.
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
  // 4. tem_internet
  await page.locator('.sim-opcao', { hasText: 'Ainda não tenho' }).click();
  // 5. dificuldade (D-075: sempre aparece, não é mais condicional)
  await page.locator('.sim-opcao', { hasText: 'Internet lenta' }).click();
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

  test('D-075: perguntas não são mais condicionais — dificuldade aparece mesmo sem internet', async ({ page }) => {
    await abrirSimulador(page);
    await escolherPerfil(page, 'Home Office');
    await page.locator('.sim-opcao', { hasText: 'Moro sozinho' }).click();
    await page.locator('.sim-opcao', { hasText: 'Redes sociais' }).click();
    await page.getByRole('button', { name: 'Continuar →' }).click();
    await page.locator('.sim-opcao', { hasText: 'Celulares' }).click();
    await page.getByRole('button', { name: 'Continuar →' }).click();
    await page.locator('.sim-opcao', { hasText: 'Ainda não tenho' }).click();
    // Antes do D-075 essa pergunta era pulada quando a pessoa não tinha internet
    await expect(page.locator('.card')).toContainText('Qual a sua maior dificuldade hoje?');
  });

  test('D-075: campanha com questionário próprio usa SUAS perguntas, não o molde padrão', async ({ page }) => {
    const custom = {
      ...CAMPANHA, id: 'sim-custom', slug: 'campanha-custom',
      perguntas: [
        { id: 'futebol', texto: 'Você gosta de futebol?', tipo: 'single', opcoes: [
          { id: 'sim', texto: 'Sim, muito', peso: 25 },
          { id: 'nao', texto: 'Não curto', peso: 0 },
        ] },
      ],
    };
    await page.addInitScript((c) => { localStorage.setItem('rjnet_simuladores', JSON.stringify([c])); }, custom);
    await page.goto('/s/campanha-custom');

    await escolherPerfil(page, 'Básico');
    await expect(page.locator('.card')).toContainText('Você gosta de futebol?');
    await expect(page.locator('.card')).toContainText('Pergunta 2 de 2'); // 1 pergunta custom + etapa de perfil
    await expect(page.locator('.card')).not.toContainText('Quantas pessoas moram com você?'); // molde padrão não aparece

    await page.locator('.sim-opcao', { hasText: 'Sim, muito' }).click();
    await expect(page.locator('.sim-resultado-badge')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /Quero receber essa oferta/ }).click();
    await page.locator('.big-field', { hasText: 'Nome *' }).locator('input').fill('Custom E2E');
    await page.locator('.big-field', { hasText: 'WhatsApp *' }).locator('input').fill('24999112233');
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Receber minha oferta' }).click();
    await expect(page.locator('.card')).toContainText('Recebemos seus dados!');

    const lead = await page.evaluate(() => (JSON.parse(localStorage.getItem('rjnet_leads')) || []).find((l) => l.origem === 'simulador'));
    expect(lead.perfilConsumo.respostas.futebol).toBe('sim');
    expect(lead.perfilConsumo.perguntas[0].texto).toBe('Você gosta de futebol?');
    expect(lead.pontuacao).toBe(25); // única pergunta, peso máximo escolhido
    expect(lead.temperatura).toBe('quente'); // 25/25 = 100%
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
    // moradores 2_4(+5) + usos streaming/jogos(+8+8) + equipamentos smart_tv(+2)
    // + sem internet(+30) + dificuldade lenta(+20) = 73 de 102 máximo (71,6%) → quente
    expect(lead.pontuacao).toBe(73);
    expect(lead.temperatura).toBe('quente');
    expect(lead.perfilConsumo.respostas.tem_internet).toBe('nao');
    expect(lead.perfilConsumo.respostas.dificuldade).toBe('lenta');
    expect(Array.isArray(lead.perfilConsumo.perguntas)).toBe(true); // snapshot gravado na submissão (D-075)
    expect(lead.perfilConsumo.perfil).toBe('gamer');
    expect(lead.perfilConsumo.combo.pacoteMega).toBe(420);
    expect(lead.perfilConsumo.combo.yellow).toBe(true);
    expect(lead.perfilConsumo.combo.black).toBe(false);
    expect(lead.perfilConsumo.combo.upgrade).toBe(true);
    expect(lead.perfilConsumo.combo.pacoteFinalMega).toBe(680);
    expect(lead.perfilConsumo.combo.valorTotal).toBe(134.90);
    // servicoInteresse deriva do PERFIL escolhido (D-075), não mais das
    // perguntas de intenção — perfil 'gamer' não inclui 'streamings'.
    expect(lead.servicoInteresse).toEqual(['internet_residencial']);
    expect(lead.utm.utm_source).toBe('meta');
    expect(lead.utm.utm_campaign).toBe('teste-e2e');
    expect(lead.versaoTermo).toBe('simulador-v1');
  });

  test('apps black ganha destaque quando o PERFIL escolhido é Streaming', async ({ page }) => {
    await abrirSimulador(page);
    // D-075: o destaque agora é ligado ao perfil de uso (D-074), não mais a
    // uma pergunta de intenção específica (que pode nem existir na campanha).
    await responderQuiz(page, { perfil: 'Streaming' });
    await expect(page.locator('.sim-combo-check.sim-combo-destaque')).toContainText('Apps Black');
    await expect(page.locator('.sim-combo-check.sim-combo-destaque')).toContainText('combina com seu perfil');
  });

  test('popup de apps mostra a lista de apps inclusos no combo (Yellow e Black)', async ({ page }) => {
    await abrirSimulador(page);
    await responderQuiz(page);

    await page.locator('.sim-combo-check', { hasText: 'Adicione Apps Yellow' }).locator('.sim-app-info-btn').click();
    await expect(page.locator('.sim-app-popup')).toBeVisible();
    await expect(page.locator('.sim-app-popup')).toContainText('Deezer');
    await expect(page.locator('.sim-app-popup')).toContainText('Kaspersky');
    await page.locator('.sim-app-popup-close').click();
    await expect(page.locator('.sim-app-popup')).toHaveCount(0);

    await page.locator('.sim-combo-check', { hasText: 'Adicione Apps Black' }).locator('.sim-app-info-btn').click();
    await expect(page.locator('.sim-app-popup')).toContainText('Max');
    await expect(page.locator('.sim-app-popup')).toContainText('Disney+');
    // clicar fora (overlay) também fecha
    await page.locator('.sim-app-popup-overlay').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('.sim-app-popup')).toHaveCount(0);
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
