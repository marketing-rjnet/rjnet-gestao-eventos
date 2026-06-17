// Cenário B — Pico Operacional
// 15 vendedores + 2 marketing, ramp-up/down de 18 minutos total
// Dados fictícios, ambiente de homologação
//
// Execução:
//   k6 run tests/load/scenario-b-pico.js

import { sleep } from 'k6';
import {
  MARKETING_EMAIL, MARKETING_PASS,
  vendedorEmail, VENDEDOR_PASS,
  EVENTO_ID_ENV,
} from './config.js';
import {
  login, getEventoAtivo, criarEventoTeste,
  saveLead, getRanking, fetchAll, exportarLeads,
} from './helpers.js';

export const options = {
  scenarios: {
    vendedores: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 15 },   // ramp-up
        { duration: '15m', target: 15 },   // sustentado
        { duration: '2m', target: 0 },     // ramp-down
      ],
      exec: 'vendedorFlow',
    },
    marketing: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 2 },
        { duration: '15m', target: 2 },
        { duration: '2m', target: 0 },
      ],
      exec: 'marketingFlow',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000', 'avg<500'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{type:saveLead}': ['p(95)<800', 'avg<400'],
    'http_req_duration{type:fetchAll}': ['p(95)<2000'],
    'http_req_duration{type:ranking}': ['p(95)<1000'],
    'http_req_duration{type:exportCSV}': ['p(95)<3000'],
  },
};

export function setup() {
  const { token } = login(MARKETING_EMAIL, MARKETING_PASS);

  let eventoId = EVENTO_ID_ENV || getEventoAtivo(token);
  if (!eventoId) {
    console.log('[setup] Criando evento de teste para Cenário B...');
    eventoId = criarEventoTeste(token);
  }
  if (!eventoId) throw new Error('[setup] Falha ao obter evento ativo.');

  console.log(`[setup] Cenário B — Evento: ${eventoId}`);
  return { eventoId };
}

export function vendedorFlow(data) {
  const vuNum = __VU;
  const { token, userId } = login(vendedorEmail(vuNum), VENDEDOR_PASS);
  const vendedorNome = `Vendedor Pico ${vuNum}`;
  let iteration = 0;

  while (true) {
    iteration++;
    saveLead(token, data.eventoId, vendedorNome, userId);
    sleep(5); // lead a cada 5s → ~12 leads/min por vendedor

    if (iteration % 12 === 0) {
      getRanking(token, data.eventoId);
    }
  }
}

export function marketingFlow(data) {
  const { token } = login(MARKETING_EMAIL, MARKETING_PASS);
  fetchAll(token);
  sleep(3);

  let tick = 0;
  while (true) {
    tick++;
    fetchAll(token);
    sleep(8); // atualização a cada 8s (maior frequência no pico)

    // Exportação CSV aos ~8 minutos
    if (tick === 60) {
      exportarLeads(token, data.eventoId);
    }
  }
}

export function teardown(data) {
  console.log(`[teardown] Cenário B concluído. Evento: ${data.eventoId}`);
}
