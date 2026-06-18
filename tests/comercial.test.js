// @ts-check
/**
 * Testes E2E do fluxo Comercial (tela do vendedor):
 * wizard de registro, validações, meta, ranking e undo.
 * V3: formulário convertido em wizard 3 etapas.
 */
const { test, expect } = require('@playwright/test');
const { loginComercial } = require('./helpers/auth');

/**
 * Preenche o wizard completo até o submit.
 * etapa1: nome + telefone (+ endereço opcional)
 * etapa2: seleciona o primeiro serviço da grade
 * etapa3: submit (temperatura e opcionais já têm default)
 */
async function registrarLead(page, { nome, telefone }) {
  // Etapa 1
  await page.getByPlaceholder('Nome do cliente').fill(nome);
  await page.getByPlaceholder('(24) 99999-9999').fill(telefone);
  await page.locator('.wizard-slide button', { hasText: 'Próximo →' }).click();

  // Etapa 2 — seleciona primeiro serviço da grade
  await page.locator('.servico-btn').first().click();
  await page.locator('.wizard-actions button', { hasText: 'Próximo →' }).click();

  // Etapa 3 — submit
  await page.locator('button[type="submit"]', { hasText: 'Registrar' }).click();
}

test.describe('Comercial — tela do vendedor', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('rjnet_leads', JSON.stringify([]));
    });
  });

  test('após login, evento ativo já vem selecionado', async ({ page }) => {
    await loginComercial(page);
    await expect(page.locator('.big-select select')).toBeVisible();
    await expect(page.locator('.big-select select')).toHaveValue(/.+/);
    await expect(page.locator('.big-select option', { hasText: 'Festa do Pescador' })).toHaveCount(1);
  });

  test('wizard inicia na etapa 1 com indicador de progresso', async ({ page }) => {
    await loginComercial(page);
    await expect(page.locator('.wizard-progress')).toBeVisible();
    await expect(page.locator('.wizard-step-label')).toContainText('1 de');
    await expect(page.getByPlaceholder('Nome do cliente')).toBeVisible();
    await expect(page.getByPlaceholder('(24) 99999-9999')).toBeVisible();
    await expect(page.getByPlaceholder('Rua, número, bairro')).toBeVisible();
  });

  test('botão Próximo fica desabilitado enquanto nome/telefone estão vazios', async ({ page }) => {
    await loginComercial(page);
    const btnProximo = page.locator('.wizard-slide button', { hasText: 'Próximo →' });
    await expect(btnProximo).toBeDisabled();
    await page.getByPlaceholder('Nome do cliente').fill('João');
    await expect(btnProximo).toBeDisabled();
    await page.getByPlaceholder('(24) 99999-9999').fill('24999887766');
    await expect(btnProximo).toBeEnabled();
  });

  test('avança para etapa 2 e exibe grade de serviços', async ({ page }) => {
    await loginComercial(page);
    await page.getByPlaceholder('Nome do cliente').fill('Cliente Teste');
    await page.getByPlaceholder('(24) 99999-9999').fill('24999887766');
    await page.locator('.wizard-slide button', { hasText: 'Próximo →' }).click();

    await expect(page.locator('.wizard-step-label')).toContainText('2 de');
    await expect(page.locator('.servico-grid')).toBeVisible();
    await expect(page.locator('.servico-btn')).toHaveCount(4);
  });

  test('botão Voltar na etapa 2 retorna para etapa 1 sem perder dados', async ({ page }) => {
    await loginComercial(page);
    await page.getByPlaceholder('Nome do cliente').fill('Cliente Voltar');
    await page.getByPlaceholder('(24) 99999-9999').fill('24999887766');
    await page.locator('.wizard-slide button', { hasText: 'Próximo →' }).click();

    await page.locator('.wizard-actions button', { hasText: '← Voltar' }).click();
    await expect(page.locator('.wizard-step-label')).toContainText('1 de');
    await expect(page.getByPlaceholder('Nome do cliente')).toHaveValue('Cliente Voltar');
  });

  test('avança para etapa 3 e exibe temperatura e opcionais', async ({ page }) => {
    await loginComercial(page);
    await page.getByPlaceholder('Nome do cliente').fill('Cliente E3');
    await page.getByPlaceholder('(24) 99999-9999').fill('24999887766');
    await page.locator('.wizard-slide button', { hasText: 'Próximo →' }).click();
    await page.locator('.servico-btn').first().click();
    await page.locator('.wizard-actions button', { hasText: 'Próximo →' }).click();

    await expect(page.locator('.wizard-step-label')).toContainText('3 de');
    await expect(page.locator('.temp-grid')).toBeVisible();
  });

  test('registra lead completo — toast e contador atualizam', async ({ page }) => {
    await loginComercial(page);
    await registrarLead(page, { nome: 'Cliente Teste E2E', telefone: '24999887766' });

    await expect(page.locator('.toast')).toContainText('Cliente Teste E2E');
    await expect(page.locator('.count-badge')).toContainText('1');
    await expect(page.locator('.vend-nav-badge')).toHaveText('1');
  });

  test('após submit wizard reinicia na etapa 1', async ({ page }) => {
    await loginComercial(page);
    await registrarLead(page, { nome: 'Lead Reinicio', telefone: '24999887766' });

    await expect(page.locator('.wizard-step-label')).toContainText('1 de');
    await expect(page.getByPlaceholder('Nome do cliente')).toHaveValue('');
  });

  test('lead registrado aparece na aba Meus Leads', async ({ page }) => {
    await loginComercial(page);
    await registrarLead(page, { nome: 'Maria Aparecida', telefone: '24988776655' });

    await page.locator('.vend-nav-btn', { hasText: 'Meus Leads' }).click();
    await expect(page.locator('.lead-mini')).toHaveCount(1);
    await expect(page.locator('.lm-name')).toHaveText('Maria Aparecida');
  });

  test('Desfazer no toast remove o lead recém-criado', async ({ page }) => {
    await loginComercial(page);
    await registrarLead(page, { nome: 'Lead Arrependido', telefone: '24977665544' });

    await page.locator('.toast-undo').click();
    await expect(page.locator('.count-badge')).toContainText('0');
    await page.locator('.vend-nav-btn', { hasText: 'Meus Leads' }).click();
    await expect(page.locator('.lead-mini')).toHaveCount(0);
  });

  test('telefone inválido bloqueia o avanço na etapa 1', async ({ page }) => {
    await loginComercial(page);
    await page.getByPlaceholder('Nome do cliente').fill('Telefone Ruim');
    await page.getByPlaceholder('(24) 99999-9999').fill('123');
    await page.locator('.wizard-slide button', { hasText: 'Próximo →' }).click();

    await expect(page.locator('text=Telefone inválido')).toBeVisible();
    await expect(page.locator('.wizard-step-label')).toContainText('1 de');
  });

  test('modo rápido submete direto após etapa 2', async ({ page }) => {
    await loginComercial(page);
    await page.locator('.modo-rapido-toggle .toggle-switch').click();

    // Etapa 1
    await page.getByPlaceholder('Nome do cliente').fill('Lead Rápido');
    await page.getByPlaceholder('(24) 99999-9999').fill('24966554433');
    await page.locator('.wizard-slide button', { hasText: 'Próximo →' }).click();

    // Etapa 2 — botão deve ser "Registrar" direto
    await page.locator('.servico-btn').first().click();
    await expect(page.locator('.wizard-actions button', { hasText: '✓ Registrar' })).toBeVisible();
    await page.locator('.wizard-actions button', { hasText: '✓ Registrar' }).click();

    await expect(page.locator('.toast')).toContainText('Lead Rápido');
  });

  test('aba Evento mostra informações e placar da equipe', async ({ page }) => {
    await loginComercial(page);
    await registrarLead(page, { nome: 'Lead do Placar', telefone: '24955443322' });

    await page.locator('.vend-nav-btn', { hasText: 'Evento' }).click();
    await expect(page.locator('.ev-info-card')).toContainText('Festa do Pescador');
    await expect(page.locator('.ranking-item.me')).toBeVisible();
    await expect(page.locator('.ranking-count').first()).toHaveText('1');
  });

  test('sem eventos ativos, mostra aviso e não exibe wizard', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('rjnet_eventos', JSON.stringify([]));
    });
    await loginComercial(page);

    await expect(page.locator('text=Nenhum evento ativo no momento.')).toBeVisible();
    await expect(page.locator('.wizard-progress')).not.toBeVisible();
  });

  test('evento encerrado em outra sessão não trava o vendedor', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('rjnet_eventos', JSON.stringify([{
        id: 'e99', nome: 'Evento Encerrado', local: 'Angra',
        dataInicio: '2025-01-01', dataFim: '2025-01-02',
        status: 'encerrado', tipo: 'sinalizacao', materiais: [],
        criadoEm: '2025-01-01T00:00:00Z',
      }]));
    });
    await loginComercial(page);
    await expect(page.locator('text=Nenhum evento ativo no momento.')).toBeVisible();
  });

});
