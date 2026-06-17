// Cenário A — Operação Normal
// 5 vendedores + 1 marketing, 10 minutos
// Dados fictícios, ambiente de homologação
//
// Pré-requisitos:
//   export TEST_SUPABASE_URL="..."
//   export TEST_SUPABASE_ANON_KEY="..."
//   export TEST_EVENTO_ID="[uuid do evento ativo no banco de homologação]"
//   (ou omitir TEST_EVENTO_ID para criação automática — requer TEST_MARKETING_EMAIL)
//
// Execução:
//   k6 run tests/load/scenario-a-normal.js

import { sleep } from 'k6';
import {
  MARKETING_EMAIL, MARKETING_PASS,
  vendedorEmail, VENDEDOR_PASS,
  EVENTO_ID_ENV, DEFAULT_THRESHOLDS,
} from './config.js';
import {
  login, getEventoAtivo, criarEventoTeste,
  saveLead, getRanking, fetchAll, exportarLeads,
} from './helpers.js';

export const options = {
  scenarios: {
    vendedores: {
      executor: 'constant-vus',
      vus: 5,
      duration: '10m',
      exec: 'vendedorFlow',
      env: { ROLE: 'vendedor' },
    },
    marketing: {
      executor: 'constant-vus',
      vus: 1,
      duration: '10m',
      exec: 'marketingFlow',
      env: { ROLE: 'marketing' },
    },
  },
  thresholds: {
    ...DEFAULT_THRESHOLDS,
    'http_req_duration{type:saveLead}': ['p(95)<800', 'avg<400'],
    'http_req_duration{type:fetchAll}': ['p(95)<1500'],
    'http_req_duration{type:ranking}': ['p(95)<1000'],
    'http_req_duration{type:auth}': ['p(95)<2000'],
  },
};

// Estado compartilhado via init context (executado 1x antes dos VUs)
let _sharedEventoId = null;

export function setup() {
  // Login como marketing para garantir evento ativo
  const { token } = login(MARKETING_EMAIL, MARKETING_PASS);

  let eventoId = EVENTO_ID_ENV || getEventoAtivo(token);
  if (!eventoId) {
    console.log('[setup] Nenhum evento ativo encontrado — criando evento de teste...');
    eventoId = criarEventoTeste(token);
  }

  if (!eventoId) throw new Error('[setup] Falha ao obter ou criar evento ativo. Abortando.');

  console.log(`[setup] Evento de teste: ${eventoId}`);
  return { eventoId, setupToken: token };
}

// Fluxo do vendedor virtual
export function vendedorFlow(data) {
  const vuNum = __VU;
  const { token, userId } = login(vendedorEmail(vuNum), VENDEDOR_PASS);
  const eventoId = data.eventoId;
  const vendedorNome = `Vendedor Teste ${vuNum}`;

  // Inserir lead a cada ~7 segundos
  let iteration = 0;
  while (true) {
    iteration++;

    saveLead(token, eventoId, vendedorNome, userId);
    sleep(7);

    // A cada ~60s (aprox a cada 8 iterações), consultar ranking
    if (iteration % 8 === 0) {
      getRanking(token, eventoId);
    }

    // k6 para o VU quando a duration expira — não precisamos de break explícito
    // O sleep de 7s garante que o loop seja interrompido no limite de duration
  }
}

// Fluxo do marketing virtual
export function marketingFlow(data) {
  const { token } = login(MARKETING_EMAIL, MARKETING_PASS);

  // Carga inicial completa
  fetchAll(token);
  sleep(5);

  // Simular dashboard ativo: atualização a cada 10s
  let tick = 0;
  while (true) {
    tick++;
    fetchAll(token);
    sleep(10);

    // Uma exportação CSV aos 5 minutos
    if (tick === 30) {
      exportarLeads(token, data.eventoId);
    }
  }
}

export function teardown(data) {
  console.log(`[teardown] Cenário A concluído. Evento de teste: ${data.eventoId}`);
  console.log('[teardown] Execute o script cleanup.js para remover dados de teste.');
}
