// Cenário C — Evento Crítico
// 20 vendedores (10 ficam offline e fazem flush simultâneo) + 3 marketing
// Dados fictícios, ambiente de homologação
//
// Execução:
//   k6 run tests/load/scenario-c-evento-critico.js

import { sleep } from 'k6';
import { check } from 'k6';
import http from 'k6/http';
import {
  MARKETING_EMAIL, MARKETING_PASS,
  vendedorEmail, VENDEDOR_PASS,
  EVENTO_ID_ENV, BASE_URL, ANON_KEY,
  makeFakeLead, restHeaders,
} from './config.js';
import {
  login, getEventoAtivo, criarEventoTeste,
  saveLead, getRanking, fetchAll,
} from './helpers.js';

export const options = {
  scenarios: {
    // 10 vendedores que permanecem online durante todo o teste
    vendedores_online: {
      executor: 'constant-vus',
      vus: 10,
      duration: '8m',
      exec: 'vendedorOnlineFlow',
      startTime: '30s', // aguarda setup
    },
    // 10 vendedores que simulam offline e fazem flush simultâneo aos 6m30s
    vendedores_flush: {
      executor: 'shared-iterations',
      vus: 10,
      iterations: 200, // 10 VUs × 20 leads cada
      maxDuration: '3m',
      exec: 'vendedorFlushFlow',
      startTime: '6m30s', // flush começa aqui
    },
    // 3 usuários marketing acompanhando o evento
    marketing: {
      executor: 'constant-vus',
      vus: 3,
      duration: '8m',
      exec: 'marketingFlow',
      startTime: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1500', 'avg<700'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{type:saveLead}': ['p(95)<1000'],
    'http_req_duration{type:flush}': ['p(95)<2000'],
    'http_req_duration{type:fetchAll}': ['p(95)<2500'],
    'http_req_duration{type:ranking}': ['p(95)<1500'],
  },
};

export function setup() {
  const { token } = login(MARKETING_EMAIL, MARKETING_PASS);

  let eventoId = EVENTO_ID_ENV || getEventoAtivo(token);
  if (!eventoId) {
    console.log('[setup] Criando evento para Cenário C...');
    eventoId = criarEventoTeste(token);
  }
  if (!eventoId) throw new Error('[setup] Falha ao obter evento ativo.');

  console.log(`[setup] Cenário C — Evento Crítico: ${eventoId}`);
  return { eventoId };
}

// Vendedor que permanece online — fluxo normal de captura
export function vendedorOnlineFlow(data) {
  const vuNum = __VU;
  const { token, userId } = login(vendedorEmail(vuNum), VENDEDOR_PASS);
  const vendedorNome = `Vendedor Online ${vuNum}`;
  let iteration = 0;

  while (true) {
    iteration++;
    saveLead(token, data.eventoId, vendedorNome, userId);
    sleep(4);

    if (iteration % 15 === 0) {
      getRanking(token, data.eventoId);
    }
  }
}

// Vendedor que "ficou offline" e agora faz flush de 20 leads acumulados
// Simula o burst de reconexão (todos os 10 VUs executam suas 20 iterações simultaneamente)
export function vendedorFlushFlow(data) {
  const vuNum = __VU + 10; // IDs 11-20 para não conflitar
  const { token, userId } = login(vendedorEmail(vuNum), VENDEDOR_PASS);
  const vendedorNome = `Vendedor Flush ${vuNum}`;

  // Cada iteração = 1 lead do "flush" (shared-iterations distribui entre os 10 VUs)
  const res = http.post(
    `${BASE_URL}/rest/v1/leads`,
    makeFakeLead(data.eventoId, vendedorNome, userId),
    {
      headers: { ...restHeaders(token), 'Prefer': 'return=minimal' },
      tags: { type: 'flush' },
    }
  );

  check(res, {
    'flush lead 201': (r) => r.status === 201,
  });

  // Sem sleep — simulamos o burst real da fila offline (sem intervalo entre itens)
  sleep(0.1); // mínimo para evitar sobrecarregar o executor k6
}

// Marketing acompanhando o dashboard
export function marketingFlow(data) {
  const { token } = login(MARKETING_EMAIL, MARKETING_PASS);
  fetchAll(token);
  sleep(5);

  let tick = 0;
  while (true) {
    tick++;
    fetchAll(token);
    sleep(6);

    if (tick % 20 === 0) {
      getRanking(token, data.eventoId);
    }
  }
}

export function teardown(data) {
  console.log(`[teardown] Cenário C concluído. Evento: ${data.eventoId}`);
  console.log('[teardown] IMPORTANTE: Execute cleanup.js para remover os ~200+ leads de teste.');
}
