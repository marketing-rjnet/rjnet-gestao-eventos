// @ts-check
const { test, expect } = require('@playwright/test');

// E2E do Simulador — página pública /s/:slug em modo local (sem
// Supabase): campanha semeada em localStorage, wizard completo e lead
// gravado em rjnet_leads com origem='simulador'.
//
// D-076: 2 fluxos independentes por campanha, nunca mais encadeados na
// mesma sessão:
// - 'oferta': perfil de uso → pacote fixo + combo de upsell → contato.
// - 'demanda': perguntas configuráveis da campanha → mensagem de
//   resultado personalizada → contato. Substitui o antigo tipo
//   'territorial' (removido).

const CAMPANHA_OFERTA = {
  id: 'sim-oferta-e2e',
  nome: 'Campanha Oferta E2E',
  slug: 'campanha-oferta-e2e',
  tipo: 'oferta',
  campanha: '',
  versaoPerguntas: 2,
  ativo: true,
  criadoEm: new Date().toISOString(),
};

const CAMPANHA_DEMANDA = {
  id: 'sim-demanda-e2e',
  nome: 'Campanha Demanda E2E',
  slug: 'campanha-demanda-e2e',
  tipo: 'demanda',
  campanha: '',
  versaoPerguntas: 2,
  mensagemResultado: 'Show! Baseado nas suas respostas, um consultor da RJNet vai entrar em contato com a melhor solução pra você.',
  ativo: true,
  criadoEm: new Date().toISOString(),
  // sem `perguntas` seedada — usa o molde padrão (perguntasPadrao())
};

async function abrirSimulador(page, campanha, { query = '' } = {}) {
  await page.addInitScript((c) => {
    localStorage.setItem('rjnet_simuladores', JSON.stringify([c]));
  }, campanha);
  await page.goto(`/s/${campanha.slug}${query}`);
}

async function escolherPerfil(page, label = 'Gamer / Casa Conectada') {
  // match exato no label do perfil (não na descrição, que às vezes cita o
  // nome de outro perfil dentro do texto — ex: "Gamer" descreve "streaming")
  await page.locator('.sim-opcao-perfil')
    .filter({ has: page.locator('.sim-opcao-perfil-label', { hasText: label, exact: true }) })
    .click();
}

// Responde o molde padrão completo de 'demanda' (5 perguntas): moradores →
// usos → equipamentos → tem_internet → dificuldade. pontuacao resultante =
// 5+16+2+30+20 = 73 de 102 máximo (71,6%) → quente.
async function responderQuizDemanda(page) {
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
  // 5. dificuldade
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
    }, CAMPANHA_OFERTA);
    await page.goto(`/s/${CAMPANHA_OFERTA.slug}`);
    await expect(page.locator('.card')).toContainText('Simulação não encontrada');
  });

  test.describe('tipo Oferta', () => {
    test('wizard exibe a escolha de perfil, sem perguntas de intenção depois', async ({ page }) => {
      await abrirSimulador(page, CAMPANHA_OFERTA);
      await expect(page.locator('.card')).toContainText('Qual desses combina mais com você?');
      // cada opção de perfil mostra label + descrição
      await expect(page.locator('.sim-opcao-perfil', { hasText: 'Gamer / Casa Conectada' })).toContainText('jogos, streaming, vários dispositivos');
    });

    test('após escolher o perfil, vai direto pro resultado (sem etapa de perguntas)', async ({ page }) => {
      await abrirSimulador(page, CAMPANHA_OFERTA);
      await escolherPerfil(page, 'Básico');
      await expect(page.locator('.sim-resultado-badge')).toBeVisible({ timeout: 5_000 });
      await expect(page.locator('.card')).not.toContainText('Quantas pessoas moram com você?');
    });

    test('fluxo completo: perfil → combo → contato → lead gravado quente', async ({ page }) => {
      await abrirSimulador(page, CAMPANHA_OFERTA, { query: '?utm_source=meta&utm_campaign=teste-e2e' });
      await escolherPerfil(page, 'Gamer / Casa Conectada');
      await expect(page.locator('.sim-resultado-badge')).toBeVisible({ timeout: 5_000 });

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

      const lead = await page.evaluate(() => {
        const leads = JSON.parse(localStorage.getItem('rjnet_leads')) || [];
        return leads.find((l) => l.origem === 'simulador');
      });
      expect(lead).toBeTruthy();
      expect(lead.nome).toBe('Maria E2E');
      expect(lead.simuladorId).toBe('sim-oferta-e2e');
      expect(lead.vendedorId).toBeNull();
      // 'oferta' não tem quiz — sempre quente, sem pontuação
      expect(lead.temperatura).toBe('quente');
      expect(lead.pontuacao).toBeFalsy();
      expect(lead.perfilConsumo.perguntas).toBeUndefined();
      expect(lead.perfilConsumo.perfil).toBe('gamer');
      expect(lead.perfilConsumo.combo.pacoteMega).toBe(420);
      expect(lead.perfilConsumo.combo.yellow).toBe(true);
      expect(lead.perfilConsumo.combo.black).toBe(false);
      expect(lead.perfilConsumo.combo.upgrade).toBe(true);
      expect(lead.perfilConsumo.combo.pacoteFinalMega).toBe(680);
      expect(lead.perfilConsumo.combo.valorTotal).toBe(134.90);
      // servicoInteresse deriva do PERFIL escolhido — 'gamer' não inclui 'streamings'.
      expect(lead.servicoInteresse).toEqual(['internet_residencial']);
      expect(lead.utm.utm_source).toBe('meta');
      expect(lead.utm.utm_campaign).toBe('teste-e2e');
      expect(lead.versaoTermo).toBe('simulador-v1');
    });

    test('apps black ganha destaque quando o PERFIL escolhido é Streaming', async ({ page }) => {
      await abrirSimulador(page, CAMPANHA_OFERTA);
      await escolherPerfil(page, 'Streaming');
      await expect(page.locator('.sim-resultado-badge')).toBeVisible({ timeout: 5_000 });
      await expect(page.locator('.sim-combo-check.sim-combo-destaque')).toContainText('Apps Black');
      await expect(page.locator('.sim-combo-check.sim-combo-destaque')).toContainText('combina com seu perfil');
    });

    test('popup de apps mostra a lista de apps inclusos no combo (Yellow e Black)', async ({ page }) => {
      await abrirSimulador(page, CAMPANHA_OFERTA);
      await escolherPerfil(page, 'Básico');
      await expect(page.locator('.sim-resultado-badge')).toBeVisible({ timeout: 5_000 });

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

    test('validação do contato: telefone inválido e consentimento obrigatórios', async ({ page }) => {
      await abrirSimulador(page, CAMPANHA_OFERTA);
      await escolherPerfil(page, 'Básico');
      await expect(page.locator('.sim-resultado-badge')).toBeVisible({ timeout: 5_000 });
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

  test.describe('tipo Demanda', () => {
    test('wizard vai direto pra primeira pergunta, sem etapa de perfil', async ({ page }) => {
      await abrirSimulador(page, CAMPANHA_DEMANDA);
      await expect(page.locator('.card')).toContainText('Quantas pessoas moram com você?');
      await expect(page.locator('.card')).toContainText('Pergunta 1 de 5');
      await expect(page.locator('.card')).not.toContainText('Qual desses combina mais com você?');
    });

    test('campanha com questionário próprio usa SUAS perguntas, não o molde padrão', async ({ page }) => {
      const custom = {
        ...CAMPANHA_DEMANDA, id: 'sim-custom', slug: 'campanha-custom',
        perguntas: [
          { id: 'futebol', texto: 'Você gosta de futebol?', tipo: 'single', opcoes: [
            { id: 'sim', texto: 'Sim, muito', peso: 25 },
            { id: 'nao', texto: 'Não curto', peso: 0 },
          ] },
        ],
      };
      await page.addInitScript((c) => { localStorage.setItem('rjnet_simuladores', JSON.stringify([c])); }, custom);
      await page.goto('/s/campanha-custom');

      await expect(page.locator('.card')).toContainText('Você gosta de futebol?');
      await expect(page.locator('.card')).toContainText('Pergunta 1 de 1');
      await expect(page.locator('.card')).not.toContainText('Quantas pessoas moram com você?'); // molde padrão não aparece

      await page.locator('.sim-opcao', { hasText: 'Sim, muito' }).click();
      await expect(page.locator('.sim-resultado-badge')).toBeVisible({ timeout: 5_000 });
      await page.getByRole('button', { name: 'Quero ser contatado →' }).click();
      await page.locator('.big-field', { hasText: 'Nome *' }).locator('input').fill('Custom E2E');
      await page.locator('.big-field', { hasText: 'WhatsApp *' }).locator('input').fill('24999112233');
      await page.locator('input[type="checkbox"]').check();
      await page.getByRole('button', { name: 'Receber minha oferta' }).click();
      await expect(page.locator('.card')).toContainText('Recebemos seus dados!');

      const lead = await page.evaluate(() => (JSON.parse(localStorage.getItem('rjnet_leads')) || []).find((l) => l.origem === 'simulador'));
      expect(lead.perfilConsumo.respostas.futebol).toBe('sim');
      expect(lead.perfilConsumo.perguntas[0].texto).toBe('Você gosta de futebol?');
      expect(lead.perfilConsumo.perfil).toBeUndefined();
      expect(lead.pontuacao).toBe(25); // única pergunta, peso máximo escolhido
      expect(lead.temperatura).toBe('quente'); // 25/25 = 100%
    });

    test('fluxo completo: perguntas → mensagem personalizada → contato → lead gravado', async ({ page }) => {
      await abrirSimulador(page, CAMPANHA_DEMANDA, { query: '?utm_source=meta&utm_campaign=teste-e2e' });
      await responderQuizDemanda(page);

      // Resultado antes do contato: mensagem PERSONALIZADA da campanha (não pacote)
      await expect(page.locator('.card')).toContainText('Obrigado por responder!');
      await expect(page.locator('.card')).toContainText(CAMPANHA_DEMANDA.mensagemResultado);
      await expect(page.locator('.card')).not.toContainText('Mega');

      await page.getByRole('button', { name: 'Quero ser contatado →' }).click();

      await page.locator('.big-field', { hasText: 'Nome *' }).locator('input').fill('João Demanda');
      await page.locator('.big-field', { hasText: 'WhatsApp *' }).locator('input').fill('24988776655');
      await page.locator('.big-field', { hasText: 'Cidade' }).locator('input').fill('Paraty');
      await page.locator('.big-field', { hasText: 'Bairro' }).locator('input').fill('Jabaquara');
      await page.locator('input[type="checkbox"]').check();
      await page.getByRole('button', { name: 'Receber minha oferta' }).click();
      await expect(page.locator('.card')).toContainText('Recebemos seus dados!');

      const lead = await page.evaluate(() => (JSON.parse(localStorage.getItem('rjnet_leads')) || []).find((l) => l.origem === 'simulador'));
      expect(lead.nome).toBe('João Demanda');
      expect(lead.simuladorId).toBe('sim-demanda-e2e');
      expect(lead.vendedorId).toBeNull();
      expect(lead.cidade).toBe('Paraty');
      expect(lead.bairro).toBe('Jabaquara');
      // moradores 2_4(+5) + usos streaming/jogos(+8+8) + equipamentos smart_tv(+2)
      // + sem internet(+30) + dificuldade lenta(+20) = 73 de 102 máximo (71,6%) → quente
      expect(lead.pontuacao).toBe(73);
      expect(lead.temperatura).toBe('quente');
      expect(lead.perfilConsumo.respostas.tem_internet).toBe('nao');
      expect(lead.perfilConsumo.respostas.dificuldade).toBe('lenta');
      expect(Array.isArray(lead.perfilConsumo.perguntas)).toBe(true); // snapshot gravado na submissão
      expect(lead.perfilConsumo.perfil).toBeUndefined(); // 'demanda' não escolhe perfil/pacote
      expect(lead.perfilConsumo.combo).toBeUndefined();
      expect(lead.servicoInteresse).toEqual(['internet_residencial']);
      expect(lead.utm.utm_source).toBe('meta');
      expect(lead.utm.utm_campaign).toBe('teste-e2e');
      expect(lead.versaoTermo).toBe('simulador-v1');
    });

    test('campanha sem perguntas configuradas mostra aviso em vez de quebrar', async ({ page }) => {
      const vazia = { ...CAMPANHA_DEMANDA, id: 'sim-vazia', slug: 'campanha-vazia', perguntas: [] };
      await page.addInitScript((c) => { localStorage.setItem('rjnet_simuladores', JSON.stringify([c])); }, vazia);
      await page.goto('/s/campanha-vazia');
      await expect(page.locator('.card')).toContainText('ainda está sendo preparada');
    });
  });
});
