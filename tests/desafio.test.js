// @ts-check
const { test, expect } = require('@playwright/test');
const { loginMarketing } = require('./helpers/auth');

// Desafio RJNet — Acerte 00:03:33 (D-089, D-090, D-098)
async function goToDesafio(page) {
  await loginMarketing(page);
  await page.locator('.header-nav .nav-tab', { hasText: 'Mais' }).click();
  await page.locator('.nav-more-item', { hasText: 'Desafio' }).click();
  await expect(page.locator('.page-title')).toHaveText('Desafio RJNET');
}

// D-098: digita só números no campo de cronômetro (CronometroInput) e
// confia na máscara automática — nunca digita os ":" manualmente.
async function digitarCronometro(locator, digitos) {
  await locator.click();
  await locator.pressSequentially(digitos);
}

test.describe('Desafio RJNet — Acerte 00:03:33', () => {

  test('cria um dia com o alvo padrão 00:03:33', async ({ page }) => {
    await goToDesafio(page);
    await page.locator('input[placeholder="Ex: Sexta-feira"]').fill('Sexta-feira E2E');
    await page.locator('button', { hasText: 'Criar dia' }).click();
    // Ao criar, abre direto a gestão do dia (Cadastro)
    await expect(page.locator('.page-title')).toHaveText('Sexta-feira E2E');
  });

  test('campo de cronômetro formata automaticamente (D-098) — sem digitar os dois-pontos', async ({ page }) => {
    await goToDesafio(page);
    await page.locator('input[placeholder="Ex: Sexta-feira"]').fill('Dia Mascara');
    await page.locator('button', { hasText: 'Criar dia' }).click();

    const campo = page.locator('input[placeholder="00:03:33"]').first();
    await digitarCronometro(campo, '0333');
    await expect(campo).toHaveValue('00:03:33');

    // Backspace remove só o último dígito digitado, sem comportamento estranho
    await campo.press('Backspace');
    await expect(campo).toHaveValue('00:00:33');

    // Continua digitando sobre o mesmo buffer (preenche da direita pra esquerda,
    // "033" + "3456" = últimos 6 dígitos "333456")
    await digitarCronometro(campo, '3456');
    await expect(campo).toHaveValue('33:34:56');

    // Letras/caracteres inválidos são ignorados — o valor não muda
    await digitarCronometro(campo, 'ab-cd');
    await expect(campo).toHaveValue('33:34:56');
  });

  test('cadastra participante com prêmio e 1ª tentativa — UI de tentativas é progressiva', async ({ page }) => {
    await goToDesafio(page);
    await page.locator('input[placeholder="Ex: Sexta-feira"]').fill('Dia Progressivo');
    await page.locator('button', { hasText: 'Criar dia' }).click();

    await page.locator('input[placeholder="Nome completo"]').fill('Maria Souza');
    await page.locator('.seg-btn', { hasText: 'HBO Max' }).click();
    await digitarCronometro(page.locator('input[placeholder="00:03:33"]').first(), '0351');
    await page.locator('button', { hasText: 'Salvar participante' }).click();

    const cardUltimo = page.locator('.card', { hasText: 'Último cadastrado' });
    await expect(cardUltimo).toContainText('Maria Souza');
    await expect(cardUltimo).toContainText('HBO Max');
    await expect(cardUltimo).toContainText('Tentativa 1');
    await expect(cardUltimo).toContainText('00:03:51');
    // Só o botão de adicionar a PRÓXIMA tentativa aparece — nunca 3 espaços vazios.
    // A lista de tentativas já registradas mostra só a linha "Tentativa 1";
    // "Tentativa 2"/"Tentativa 3" só existem dentro do texto do botão "+ Adicionar
    // tentativa N", nunca como uma linha própria de resultado.
    await expect(cardUltimo).toContainText('Adicionar tentativa 2');
    await expect(cardUltimo.locator('button', { hasText: 'Adicionar tentativa 3' })).toHaveCount(0);
  });

  test('até 3 tentativas por participante — 4ª não é permitida', async ({ page }) => {
    await goToDesafio(page);
    await page.locator('input[placeholder="Ex: Sexta-feira"]').fill('Dia Tentativas');
    await page.locator('button', { hasText: 'Criar dia' }).click();

    await page.locator('input[placeholder="Nome completo"]').fill('João Silva');
    await digitarCronometro(page.locator('input[placeholder="00:03:33"]').first(), '0412'); // 00:04:12
    await page.locator('button', { hasText: 'Salvar participante' }).click();

    const cardUltimo = page.locator('.card', { hasText: 'Último cadastrado' });

    // Tentativa 2
    await cardUltimo.locator('button', { hasText: 'Adicionar tentativa 2' }).click();
    await digitarCronometro(cardUltimo.locator('input[placeholder="00:03:33"]'), '0351'); // 00:03:51
    await cardUltimo.locator('button', { hasText: 'Salvar' }).click();
    await expect(cardUltimo).toContainText('Tentativa 2');
    await expect(cardUltimo).toContainText('00:03:51');

    // Tentativa 3
    await cardUltimo.locator('button', { hasText: 'Adicionar tentativa 3' }).click();
    await digitarCronometro(cardUltimo.locator('input[placeholder="00:03:33"]'), '0333'); // 00:03:33 (acerto exato)
    await cardUltimo.locator('button', { hasText: 'Salvar' }).click();
    await expect(cardUltimo).toContainText('Tentativa 3');
    await expect(cardUltimo).toContainText('Acertou exatamente');

    // Sem 4ª tentativa disponível
    await expect(cardUltimo.locator('button', { hasText: 'Adicionar tentativa 4' })).toHaveCount(0);
  });

  test('melhor tentativa é calculada pelo valor numérico — exemplo da especificação', async ({ page }) => {
    await goToDesafio(page);
    await page.locator('input[placeholder="Ex: Sexta-feira"]').fill('Dia Melhor Tentativa');
    await page.locator('button', { hasText: 'Criar dia' }).click();

    await page.locator('input[placeholder="Nome completo"]').fill('Carlos Teste');
    await digitarCronometro(page.locator('input[placeholder="00:03:33"]').first(), '0328'); // 00:03:28
    await page.locator('button', { hasText: 'Salvar participante' }).click();

    const cardUltimo = page.locator('.card', { hasText: 'Último cadastrado' });
    await cardUltimo.locator('button', { hasText: 'Adicionar tentativa 2' }).click();
    await digitarCronometro(cardUltimo.locator('input[placeholder="00:03:33"]'), '0341'); // 00:03:41
    await cardUltimo.locator('button', { hasText: 'Salvar' }).click();
    await cardUltimo.locator('button', { hasText: 'Adicionar tentativa 3' }).click();
    await digitarCronometro(cardUltimo.locator('input[placeholder="00:03:33"]'), '0410'); // 00:04:10
    await cardUltimo.locator('button', { hasText: 'Salvar' }).click();

    // Melhor tentativa é a 1ª (00:03:28, diferença de 5 centésimos)
    await page.locator('.seg-btn', { hasText: 'Ranking' }).click();
    const row = page.locator('tbody tr').first();
    await expect(row).toContainText('Carlos Teste');
    await expect(row).toContainText('00:03:28');
    await expect(row).toContainText('3'); // coluna Tentativas = 3
  });

  test('edição rápida do participante preserva as tentativas (não recadastra)', async ({ page }) => {
    await goToDesafio(page);
    await page.locator('input[placeholder="Ex: Sexta-feira"]').fill('Dia Edicao');
    await page.locator('button', { hasText: 'Criar dia' }).click();

    await page.locator('input[placeholder="Nome completo"]').fill('Joao Silva');
    await page.locator('input[placeholder="(00) 00000-0000"]').fill('(24) 99999-9999');
    await digitarCronometro(page.locator('input[placeholder="00:03:33"]').first(), '0412'); // 00:04:12
    await page.locator('button', { hasText: 'Salvar participante' }).click();

    const cardUltimo = page.locator('.card', { hasText: 'Último cadastrado' });
    await cardUltimo.locator('button', { hasText: 'Adicionar tentativa 2' }).click();
    await digitarCronometro(cardUltimo.locator('input[placeholder="00:03:33"]'), '0351'); // 00:03:51
    await cardUltimo.locator('button', { hasText: 'Salvar' }).click();
    await expect(cardUltimo).toContainText('Tentativa 2');

    // Edita nome e telefone
    await cardUltimo.locator('button', { hasText: 'Editar' }).click();
    const modal = page.locator('.modal-box', { hasText: 'Editar participante' });
    await modal.locator('input').first().fill('João da Silva');
    await modal.locator('input').nth(1).fill('(24) 98888-8888');
    await modal.locator('button', { hasText: 'Salvar' }).click();

    // Nome/telefone atualizados, tentativas continuam intactas — sem duplicar participante
    await expect(cardUltimo).toContainText('João da Silva');
    await expect(cardUltimo).toContainText('(24) 98888-8888');
    await expect(cardUltimo).toContainText('Tentativa 1');
    await expect(cardUltimo).toContainText('00:04:12');
    await expect(cardUltimo).toContainText('Tentativa 2');
    await expect(cardUltimo).toContainText('00:03:51');
    await expect(page.locator('text=Joao Silva')).toHaveCount(0);

    // Lista de participantes não duplicou o cadastro
    await expect(page.locator('.card', { hasText: 'Participantes cadastrados' }).locator('.strong', { hasText: 'João da Silva' })).toHaveCount(1);
  });

  test('corrige o valor de uma tentativa já registrada, sem criar tentativa nova', async ({ page }) => {
    await goToDesafio(page);
    await page.locator('input[placeholder="Ex: Sexta-feira"]').fill('Dia Correcao');
    await page.locator('button', { hasText: 'Criar dia' }).click();

    await page.locator('input[placeholder="Nome completo"]').fill('Ana Paula');
    await digitarCronometro(page.locator('input[placeholder="00:03:33"]').first(), '0412'); // 00:04:12 (erro de leitura)
    await page.locator('button', { hasText: 'Salvar participante' }).click();

    const cardUltimo = page.locator('.card', { hasText: 'Último cadastrado' });
    await cardUltimo.locator('button', { hasText: 'Adicionar tentativa 2' }).click();
    await digitarCronometro(cardUltimo.locator('input[placeholder="00:03:33"]'), '0351'); // 00:03:51
    await cardUltimo.locator('button', { hasText: 'Salvar' }).click();
    await expect(cardUltimo).toContainText('Tentativa 2');

    // Corrige a Tentativa 1 (operador leu "00:04:12" errado, era "00:03:41") —
    // 1º botão "Corrigir tentativa" no DOM é sempre o da Tentativa 1 (ordem
    // da lista); usar um filtro por texto aqui seria ambíguo, já que o
    // container flex das tentativas também contém "Tentativa 1" como
    // substring do seu texto total (junto com "Tentativa 2").
    await cardUltimo.locator('button[title="Corrigir tentativa"]').first().click();
    await digitarCronometro(cardUltimo.locator('input[placeholder="00:03:33"]'), '0341'); // 00:03:41
    await cardUltimo.locator('button', { hasText: 'Salvar' }).click();

    // Continua sendo a Tentativa 1 (não virou uma 3ª), valor corrigido, Tentativa 2 intacta
    await expect(cardUltimo).toContainText('Tentativa 1');
    await expect(cardUltimo).toContainText('00:03:41');
    await expect(cardUltimo).toContainText('Tentativa 2');
    await expect(cardUltimo).toContainText('00:03:51');
    await expect(cardUltimo.locator('button', { hasText: 'Adicionar tentativa 3' })).toBeVisible();
    await expect(page.locator('text=00:04:12')).toHaveCount(0);
  });

  test('cadastra participante com acerto exato — vai para Ganhadores, não pro Ranking', async ({ page }) => {
    await goToDesafio(page);
    await page.locator('input[placeholder="Ex: Sexta-feira"]').fill('Dia Ganhador');
    await page.locator('button', { hasText: 'Criar dia' }).click();

    await page.locator('input[placeholder="Nome completo"]').fill('João Silva');
    await digitarCronometro(page.locator('input[placeholder="00:03:33"]').first(), '0333');
    await page.locator('button', { hasText: 'Salvar participante' }).click();

    await expect(page.locator('text=Acertou exatamente! Ganhador instantâneo.')).toBeVisible();

    await page.locator('.seg-btn', { hasText: 'Ganhadores' }).click();
    await expect(page.locator('text=João Silva')).toBeVisible();

    await page.locator('.seg-btn', { hasText: 'Ranking' }).click();
    await expect(page.locator('text=Nenhum participante no ranking ainda.')).toBeVisible();
  });

  test('cadastra participante sem acerto exato — aparece no Ranking com a diferença correta', async ({ page }) => {
    await goToDesafio(page);
    await page.locator('input[placeholder="Ex: Sexta-feira"]').fill('Dia Ranking');
    await page.locator('button', { hasText: 'Criar dia' }).click();

    await page.locator('input[placeholder="Nome completo"]').fill('Maria Souza');
    await digitarCronometro(page.locator('input[placeholder="00:03:33"]').first(), '0335'); // 00:03:35
    await page.locator('button', { hasText: 'Salvar participante' }).click();

    await expect(page.locator('text=00:00:02')).toBeVisible();

    await page.locator('.seg-btn', { hasText: 'Ranking' }).click();
    const row = page.locator('tbody tr').first();
    await expect(row).toContainText('Maria Souza');
    await expect(row).toContainText('00:00:02');
  });

  test('painel mostra estatísticas e permite exportar CSV', async ({ page }) => {
    await goToDesafio(page);
    await page.locator('input[placeholder="Ex: Sexta-feira"]').fill('Dia Painel');
    await page.locator('button', { hasText: 'Criar dia' }).click();

    await page.locator('input[placeholder="Nome completo"]').fill('Carlos Teste');
    await digitarCronometro(page.locator('input[placeholder="00:03:33"]').first(), '0340'); // 00:03:40
    await page.locator('button', { hasText: 'Salvar participante' }).click();

    await page.locator('.seg-btn', { hasText: 'Painel' }).click();
    await expect(page.locator('.grid-kpi-3').first()).toContainText('Participantes');

    const downloadPromise = page.waitForEvent('download');
    await page.locator('button', { hasText: 'Exportar CSV' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('desafio_');
  });

  test('tela de TV mostra o ranking e os KPIs (menor diferença, média, alvo) em modo local', async ({ page, context }) => {
    await goToDesafio(page);
    await page.locator('input[placeholder="Ex: Sexta-feira"]').fill('Dia TV');
    await page.locator('button', { hasText: 'Criar dia' }).click();

    await page.locator('input[placeholder="Nome completo"]').fill('Ana TV');
    await digitarCronometro(page.locator('input[placeholder="00:03:33"]').first(), '0333');
    await page.locator('button', { hasText: 'Salvar participante' }).click();

    await page.locator('.seg-btn', { hasText: 'Tela de TV' }).click();
    const url = await page.locator('.mono', { hasText: '/tv/' }).textContent();

    const tvPage = await context.newPage();
    await tvPage.goto(url.trim());
    await expect(tvPage.locator('.desafio-tv-title')).toHaveText('DESAFIO RJNET');
    await expect(tvPage.locator('.desafio-tv-winner-item', { hasText: 'Ana TV' })).toBeVisible({ timeout: 8000 });
    // D-090: KPIs do painel administrativo espelhados na tela de TV
    await expect(tvPage.locator('.desafio-tv-kpi-label')).toContainText([
      'Participantes', 'Ganhadores', 'Menor diferença', 'Média dos tempos', 'Alvo',
    ]);
  });

  test('cadastra participante marcando "já é cliente RJNET" — aparece na lista (D-099)', async ({ page }) => {
    await goToDesafio(page);
    await page.locator('input[placeholder="Ex: Sexta-feira"]').fill('Dia Ja Cliente');
    await page.locator('button', { hasText: 'Criar dia' }).click();

    await page.locator('input[placeholder="Nome completo"]').fill('Cliente Antigo');
    await page.locator('.big-field', { hasText: 'Já é cliente RJNET?' }).locator('.seg-btn', { hasText: 'Sim' }).click();
    await digitarCronometro(page.locator('input[placeholder="00:03:33"]').first(), '0340'); // 00:03:40
    await page.locator('button', { hasText: 'Salvar participante' }).click();

    const cardUltimo = page.locator('.card', { hasText: 'Último cadastrado' });
    await expect(cardUltimo).toContainText('Cliente Antigo');
    await expect(cardUltimo.locator('.badge', { hasText: 'Já cliente' })).toBeVisible();

    // Reflete também na lista "Participantes cadastrados"
    const listaCard = page.locator('.card', { hasText: 'Participantes cadastrados' });
    await expect(listaCard).toContainText('Cliente Antigo');
    await expect(listaCard.locator('.badge', { hasText: 'Já cliente' })).toBeVisible();
  });

  test('tela de TV reflete alteração do prêmio por posição sem recarregar (D-099 — fix do broadcast)', async ({ page, context }) => {
    test.setTimeout(60_000);
    await goToDesafio(page);
    await page.locator('input[placeholder="Ex: Sexta-feira"]').fill('Dia Premio TV');
    await page.locator('button', { hasText: 'Criar dia' }).click();

    // Precisa de ao menos 1 participante pra abrir a Tela de TV com dado —
    // o prêmio por posição aparece independente de ranking (D-094).
    await page.locator('input[placeholder="Nome completo"]').fill('Participante Base');
    await digitarCronometro(page.locator('input[placeholder="00:03:33"]').first(), '0340');
    await page.locator('button', { hasText: 'Salvar participante' }).click();

    await page.locator('.seg-btn', { hasText: 'Tela de TV' }).click();
    const url = (await page.locator('.mono', { hasText: '/tv/' }).textContent()).trim();
    const tvPage = await context.newPage();
    await tvPage.goto(url);
    await expect(tvPage.locator('.desafio-tv-title')).toHaveText('DESAFIO RJNET');

    // Configura o prêmio da 1ª posição do ranking — as posições são
    // renderizadas na ordem 1º..10º, então o 1º botão "HBO Max" da lista
    // corresponde à posição 1.
    await page.locator('.seg-btn', { hasText: 'Prêmio' }).click();
    await page.locator('.card', { hasText: 'Prêmios do Ranking' }).locator('button', { hasText: 'HBO Max' }).first().click();
    await page.locator('button', { hasText: 'Salvar prêmios do ranking' }).click();

    // A Tela de TV atualiza sozinha (broadcast, sem F5) — antes do fix,
    // saveDesafioPremiosRanking nunca chamava broadcastDesafioPainel.
    // .desafio-tv-ranking-row inclui o cabeçalho (Pos./Nome/...) como a
    // 1ª ocorrência — a linha da posição 1 é a 2ª (índice 1).
    await expect(tvPage.locator('.desafio-tv-ranking-row').nth(1).locator('text=HBO Max')).toBeVisible({ timeout: 8000 });
  });

  test('tela de TV reflete edição de nome sem recarregar manualmente (D-098)', async ({ page, context }) => {
    test.setTimeout(60_000);
    await goToDesafio(page);
    await page.locator('input[placeholder="Ex: Sexta-feira"]').fill('Dia TV Edicao');
    await page.locator('button', { hasText: 'Criar dia' }).click();

    await page.locator('input[placeholder="Nome completo"]').fill('Pedro Antigo');
    await digitarCronometro(page.locator('input[placeholder="00:03:33"]').first(), '0340'); // 00:03:40
    await page.locator('button', { hasText: 'Salvar participante' }).click();

    await page.locator('.seg-btn', { hasText: 'Tela de TV' }).click();
    const url = (await page.locator('.mono', { hasText: '/tv/' }).textContent()).trim();

    const tvPage = await context.newPage();
    await tvPage.goto(url);
    await expect(tvPage.locator('text=Pedro Antigo')).toBeVisible({ timeout: 8000 });

    // Corrige o nome no painel administrativo
    await page.locator('.seg-btn', { hasText: 'Ranking' }).click();
    await page.locator('tbody tr', { hasText: 'Pedro Antigo' }).locator('button').first().click();
    const modal = page.locator('.modal-box', { hasText: 'Editar participante' });
    await modal.locator('input').first().fill('Pedro Novo');
    await modal.locator('button', { hasText: 'Salvar' }).click();

    // Tela de TV atualiza sozinha (poll local de 3s em modo sem Supabase) — sem duplicar participante
    await expect(tvPage.locator('text=Pedro Novo')).toBeVisible({ timeout: 8000 });
    await expect(tvPage.locator('text=Pedro Antigo')).toHaveCount(0);
  });

});
