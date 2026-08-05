// @ts-check
const { test, expect } = require('@playwright/test');
const { loginMarketing } = require('./helpers/auth');

// Desafio RJNet — Acerte 00:03:33 (D-089, D-090)
async function goToDesafio(page) {
  await loginMarketing(page);
  await page.locator('.header-nav .nav-tab', { hasText: 'Mais' }).click();
  await page.locator('.nav-more-item', { hasText: 'Desafio' }).click();
  await expect(page.locator('.page-title')).toHaveText('Desafio RJNet');
}

test.describe('Desafio RJNet — Acerte 00:03:33', () => {

  test('cria um dia com o alvo padrão 00:03:33', async ({ page }) => {
    await goToDesafio(page);
    await page.locator('input[placeholder="Ex: Sexta-feira"]').fill('Sexta-feira E2E');
    await page.locator('button', { hasText: 'Criar dia' }).click();
    // Ao criar, abre direto a gestão do dia (Cadastro)
    await expect(page.locator('.page-title')).toHaveText('Sexta-feira E2E');
  });

  test('cadastra participante com acerto exato — vai para Ganhadores, não pro Ranking', async ({ page }) => {
    await goToDesafio(page);
    await page.locator('input[placeholder="Ex: Sexta-feira"]').fill('Dia Ganhador');
    await page.locator('button', { hasText: 'Criar dia' }).click();

    await page.locator('input[placeholder="Nome completo"]').fill('João Silva');
    await page.locator('input[placeholder="00:03:33"]').fill('00:03:33');
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
    await page.locator('input[placeholder="00:03:33"]').fill('00:03:35');
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
    await page.locator('input[placeholder="00:03:33"]').fill('00:03:40');
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
    await page.locator('input[placeholder="00:03:33"]').fill('00:03:33');
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

});
