// Cenário D — Estresse
// Ramp-up de 10 a 100 VUs para identificar o ponto de degradação
// Dados fictícios, ambiente de homologação
//
// ATENÇÃO: Execute somente após aprovação explícita.
// Este cenário pode atingir os limites do Free Tier do Supabase.
//
// Execução:
//   k6 run tests/load/scenario-d-estresse.js

import { sleep } from 'k6';
import {
  MARKETING_EMAIL, MARKETING_PASS,
  vendedorEmail, VENDEDOR_PASS,
  EVENTO_ID_ENV,
} from './config.js';
import {
  login, getEventoAtivo, criarEventoTeste,
  saveLead, getRanking, fetchAll,
} from './helpers.js';

export const options = {
  stages: [
    { duration: '2m', target: 10 },   // baseline — deve ser estável
    { duration: '2m', target: 25 },   // aumento moderado
    { duration: '2m', target: 50 },   // carga pesada
    { duration: '2m', target: 75 },   // estresse
    { duration: '2m', target: 100 },  // limite esperado
    { duration: '2m', target: 0 },    // ramp-down
  ],
  // Thresholds mais permissivos: objetivo é observar degradação, não reprovar
  thresholds: {
    http_req_failed: ['rate<0.20'],   // parar se erro > 20%
    'http_req_duration{type:saveLead}': ['p(99)<5000'],
  },
  // Parada de emergência automática
  summaryTrendStats: ['min', 'med', 'avg', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export function setup() {
  const { token } = login(MARKETING_EMAIL, MARKETING_PASS);

  let eventoId = EVENTO_ID_ENV || getEventoAtivo(token);
  if (!eventoId) {
    console.log('[setup] Criando evento para Cenário D...');
    eventoId = criarEventoTeste(token);
  }
  if (!eventoId) throw new Error('[setup] Falha ao obter evento ativo.');

  console.log(`[setup] Cenário D — Estresse — Evento: ${eventoId}`);
  console.log('[setup] ATENÇÃO: Monitorar Supabase Dashboard durante execução.');
  return { eventoId };
}

// Todos os VUs executam o mesmo fluxo simplificado
export default function (data) {
  const vuNum = __VU % 20; // rotaciona entre 20 usuários de teste
  const isMarketing = vuNum === 0;

  const email = isMarketing ? MARKETING_EMAIL : vendedorEmail(vuNum || 1);
  const pass  = isMarketing ? MARKETING_PASS  : VENDEDOR_PASS;
  const { token, userId } = login(email, pass);

  let tick = 0;

  while (true) {
    tick++;

    if (isMarketing) {
      // Marketing: fetchAll a cada iteração
      fetchAll(token);
      sleep(5);
    } else {
      // Vendedor: saveLead a cada 3s, ranking a cada 30s
      saveLead(token, data.eventoId, `Vendedor Estresse ${__VU}`, userId);
      sleep(3);

      if (tick % 10 === 0) {
        getRanking(token, data.eventoId);
      }
    }
  }
}

export function teardown(data) {
  console.log(`[teardown] Cenário D concluído. Evento: ${data.eventoId}`);
  console.log('[teardown] Analisar o relatório para identificar o ponto de degradação.');
  console.log('[teardown] Execute cleanup.js para remover dados de teste.');
}
