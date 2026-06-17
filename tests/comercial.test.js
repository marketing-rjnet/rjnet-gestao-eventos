// @ts-check
/**
 * Testes E2E do fluxo Comercial (tela do vendedor):
 * seleção de evento, registro de leads, validações, meta, ranking e undo.
 */
const { test, expect } = require('@playwright/test');
const { loginComercial } = require('./helpers/auth');

async function registrarLead(page, { nome, telefone }) {
  await page.getByPlaceholder('Nome do cliente').fill(nome);
  await page.getByPlaceholder('(24) 99999-9999').fill(telefone);
  await page.locator('.lead-submit').click();
}

test.describe('Comercial — tela do vendedor', () => {

  // O modo local traz um lead fictício do primeiro vendedor; zera para que
  // contadores e listas comecem do zero em cada teste
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

  test('registra lead com nome e telefone — toast e contador atualizam', async ({ page }) => {
    await loginComercial(page);
    await registrarLead(page, { nome: 'Cliente Teste E2E', telefone: '24999887766' });

    await expect(page.locator('.toast')).toContainText('Cliente Teste E2E');
    await expect(page.locator('.count-badge')).toContainText('1/15');
    await expect(page.locator('.vend-nav-badge')).toHaveText('1');
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
    await expect(page.locator('.count-badge')).toContainText('0/15');
    await page.locator('.vend-nav-btn', { hasText: 'Meus Leads' }).click();
    await expect(page.locator('.lead-mini')).toHaveCount(0);
  });

  test('telefone inválido bloqueia o registro com mensagem de erro', async ({ page }) => {
    await loginComercial(page);
    await registrarLead(page, { nome: 'Telefone Ruim', telefone: '123' });

    await expect(page.locator('text=Telefone inválido')).toBeVisible();
    await expect(page.locator('.count-badge')).toContainText('0/15');
  });

  test('modo rápido esconde os campos opcionais', async ({ page }) => {
    await loginComercial(page);
    await expect(page.getByPlaceholder('Rua, número, bairro')).toBeVisible();

    await page.locator('.modo-rapido-toggle .toggle-switch').click();
    await expect(page.getByPlaceholder('Rua, número, bairro')).not.toBeVisible();
    await expect(page.locator('textarea')).not.toBeVisible();

    // Mesmo no modo rápido o registro funciona
    await registrarLead(page, { nome: 'Lead Rápido', telefone: '24966554433' });
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

  test('sem eventos ativos, mostra aviso e não exibe formulário', async ({ page }) => {
    // Zera os eventos antes do app carregar
    await page.addInitScript(() => {
      localStorage.setItem('rjnet_eventos', JSON.stringify([]));
    });
    await loginComercial(page);

    await expect(page.locator('text=Nenhum evento ativo no momento.')).toBeVisible();
    await expect(page.locator('.lead-submit')).not.toBeVisible();
  });

  test('evento encerrado em outra sessão não trava o vendedor', async ({ page }) => {
    // Apenas um evento, já encerrado — o seletor deve reagir e bloquear registro
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
