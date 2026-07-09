// @ts-check
const { test, expect } = require('@playwright/test');

// E2E do Simulador — página pública /s/:slug em modo local (sem
// Supabase): campanha semeada em localStorage, wizard completo e lead
// gravado em rjnet_leads com origem='simulador'.
//
// D-076/D-077: 2 fluxos independentes por campanha, nunca mais encadeados
// na mesma sessão:
// - 'oferta': quiz FIXO de qualificação → perfil DEDUZIDO das respostas →
//   pacote fixo + combo de upsell (apps, upgrade, plano Móvel) → contato.
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

// Responde o quiz FIXO de qualificação do Simulador de Oferta (D-077): 5
// perguntas — dispositivos → usos → equipamentos → tem_internet →
// dificuldade. O perfil (e portanto o pacote) é DEDUZIDO das respostas,
// nunca escolhido direto. Default cai em 'básico' (uso leve, sem jogos/
// home office/streaming declarados).
async function responderQuizOferta(page, {
  dispositivos = 'Poucos (1 a 3)',
  usos = ['Redes sociais'],
  equipamentos = ['Celulares'],
  temInternet = 'Sim, já tenho',
  dificuldade = 'Estou satisfeito(a) com o serviço atual',
} = {}) {
  // 1. dispositivos (single → avança sozinho)
  await page.locator('.sim-opcao', { hasText: dispositivos }).click();
  // 2. usos (multi → precisa de Continuar)
  for (const u of usos) await page.locator('.sim-opcao', { hasText: u }).click();
  await page.getByRole('button', { name: 'Continuar →' }).click();
  // 3. equipamentos (multi)
  for (const e of equipamentos) await page.locator('.sim-opcao', { hasText: e }).click();
  await page.getByRole('button', { name: 'Continuar →' }).click();
  // 4. tem_internet (single)
  await page.locator('.sim-opcao', { hasText: temInternet }).click();
  // 5. dificuldade (single)
  await page.locator('.sim-opcao', { hasText: dificuldade }).click();
  // Tela "Analisando..." → resultado
  await expect(page.locator('.sim-resultado-badge')).toBeVisible({ timeout: 5_000 });
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
    test('wizard vai direto pro quiz de qualificação, sem escolha direta de perfil', async ({ page }) => {
      await abrirSimulador(page, CAMPANHA_OFERTA);
      await expect(page.locator('.card')).toContainText('Quantos dispositivos estão conectados na sua rede atual?');
      await expect(page.locator('.card')).toContainText('Pergunta 1 de 5');
      await expect(page.locator('.card')).not.toContainText('Qual desses combina mais com você?');
    });

    test('jogos declarado deduz perfil Gamer, mesmo sem escolha direta', async ({ page }) => {
      await abrirSimulador(page, CAMPANHA_OFERTA);
      await responderQuizOferta(page, { usos: ['Jogos online'] });
      await expect(page.locator('.card')).toContainText('420 Mega');
      await expect(page.locator('.card')).toContainText('Gamer / Casa Conectada');
    });

    test('trabalho/home office (sem jogos) deduz perfil Home Office', async ({ page }) => {
      await abrirSimulador(page, CAMPANHA_OFERTA);
      await responderQuizOferta(page, { usos: ['Trabalho / home office'] });
      await expect(page.locator('.card')).toContainText('240 Mega');
      await expect(page.locator('.card')).toContainText('Home Office:');
    });

    test('só streaming declarado (sem jogos/home office) deduz perfil Streaming', async ({ page }) => {
      await abrirSimulador(page, CAMPANHA_OFERTA);
      await responderQuizOferta(page, { usos: ['Streaming'] });
      await expect(page.locator('.card')).toContainText('240 Mega');
      await expect(page.locator('.card')).toContainText('Streaming:');
    });

    test('uso leve (só redes sociais) deduz perfil Básico', async ({ page }) => {
      await abrirSimulador(page, CAMPANHA_OFERTA);
      await responderQuizOferta(page, { usos: ['Redes sociais'] });
      await expect(page.locator('.card')).toContainText('120 Mega');
      await expect(page.locator('.card')).toContainText('Básico:');
    });

    test('fluxo completo: quiz → combo (apps + upgrade + Móvel) → contato → lead gravado quente', async ({ page }) => {
      await abrirSimulador(page, CAMPANHA_OFERTA, { query: '?utm_source=meta&utm_campaign=teste-e2e' });
      await responderQuizOferta(page, { usos: ['Jogos online'], dispositivos: 'Muitos (8 ou mais)' });

      // Resultado antes do contato (valor primeiro): pacote do perfil DEDUZIDO
      await expect(page.locator('.card')).toContainText('420 Mega ⭐');
      await expect(page.locator('.card')).toContainText('R$ 99,90/mês');
      await expect(page.locator('.sim-combo-total')).toContainText('R$ 99,90/mês');

      // Marca Yellow (+15) e o upgrade pro próximo pacote (+20) — total ao vivo
      await page.locator('.sim-combo-check', { hasText: 'Adicione Apps Yellow' }).locator('input').check();
      await expect(page.locator('.sim-combo-total')).toContainText('R$ 114,90/mês');
      await page.locator('.sim-combo-check', { hasText: 'Upgrade para 680 Mega' }).locator('input').check();
      await expect(page.locator('.sim-combo-total')).toContainText('R$ 134,90/mês');

      // Plano Móvel (D-077): Controle 10GB (+39,90)
      await page.locator('.sim-movel-chip', { hasText: 'Controle 10 GB' }).click();
      await expect(page.locator('.sim-combo-total')).toContainText('R$ 174,80/mês');

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
      // 'oferta' não tem score de intenção — sempre quente, sem pontuação
      expect(lead.temperatura).toBe('quente');
      expect(lead.pontuacao).toBeFalsy();
      expect(Array.isArray(lead.perfilConsumo.perguntas)).toBe(true); // snapshot do quiz fixo (D-077)
      expect(lead.perfilConsumo.respostas.usos).toEqual(['jogos']);
      expect(lead.perfilConsumo.perfil).toBe('gamer'); // DEDUZIDO, não escolhido
      expect(lead.perfilConsumo.combo.pacoteMega).toBe(420);
      expect(lead.perfilConsumo.combo.yellow).toBe(true);
      expect(lead.perfilConsumo.combo.black).toBe(false);
      expect(lead.perfilConsumo.combo.upgrade).toBe(true);
      expect(lead.perfilConsumo.combo.movel).toBe('controle_10gb');
      expect(lead.perfilConsumo.combo.pacoteFinalMega).toBe(680);
      expect(lead.perfilConsumo.combo.valorTotal).toBe(174.80);
      // servicoInteresse deriva do PERFIL deduzido — 'gamer' não inclui 'streamings'.
      expect(lead.servicoInteresse).toEqual(['internet_residencial']);
      expect(lead.utm.utm_source).toBe('meta');
      expect(lead.utm.utm_campaign).toBe('teste-e2e');
      expect(lead.versaoTermo).toBe('simulador-v1');
    });

    test('apps black ganha destaque quando o perfil deduzido é Streaming', async ({ page }) => {
      await abrirSimulador(page, CAMPANHA_OFERTA);
      await responderQuizOferta(page, { usos: ['Streaming'] });
      await expect(page.locator('.sim-combo-check.sim-combo-destaque')).toContainText('Apps Black');
      await expect(page.locator('.sim-combo-check.sim-combo-destaque')).toContainText('combina com seu perfil');
    });

    test('popup de apps mostra a lista de apps inclusos no combo (Yellow e Black)', async ({ page }) => {
      await abrirSimulador(page, CAMPANHA_OFERTA);
      await responderQuizOferta(page);

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
      await responderQuizOferta(page);
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
