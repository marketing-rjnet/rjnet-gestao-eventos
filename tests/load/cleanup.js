// Script de cleanup — remove todos os dados de teste criados pelos cenários k6
// DEVE ser executado após cada sessão de teste
//
// Requer a service_role key (nunca exposta no frontend):
//   export TEST_SUPABASE_URL="..."
//   export TEST_SUPABASE_SERVICE_KEY="[service-role-key]"
//   export TEST_EVENTO_ID="[uuid do evento de teste]"
//
// Execução:
//   k6 run tests/load/cleanup.js

import http from 'k6/http';
import { check } from 'k6';

const BASE_URL    = __ENV.TEST_SUPABASE_URL || '';
const SERVICE_KEY = __ENV.TEST_SUPABASE_SERVICE_KEY || '';
const EVENTO_ID   = __ENV.TEST_EVENTO_ID || '';

export const options = {
  vus: 1,
  iterations: 1,
};

export default function () {
  if (!BASE_URL || !SERVICE_KEY) {
    console.error('[cleanup] TEST_SUPABASE_URL e TEST_SUPABASE_SERVICE_KEY são obrigatórios.');
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'apikey': SERVICE_KEY,
    'Prefer': 'return=minimal',
  };

  if (EVENTO_ID) {
    // Remove leads do evento de teste
    const r1 = http.del(
      `${BASE_URL}/rest/v1/leads?evento_id=eq.${EVENTO_ID}`,
      null,
      { headers }
    );
    check(r1, { 'cleanup leads': (r) => r.status === 204 || r.status === 200 });

    // Remove o evento de teste
    const r2 = http.del(
      `${BASE_URL}/rest/v1/eventos?id=eq.${EVENTO_ID}`,
      null,
      { headers }
    );
    check(r2, { 'cleanup evento': (r) => r.status === 204 || r.status === 200 });

    console.log(`[cleanup] Evento ${EVENTO_ID} e seus leads removidos.`);
  }

  // Remove qualquer evento marcado com [REMOVER] que possa ter sobrado
  const r3 = http.del(
    `${BASE_URL}/rest/v1/eventos?observacoes=like.*%5BREMOVER%5D*`,
    null,
    { headers }
  );
  check(r3, { 'cleanup eventos [REMOVER]': (r) => r.status === 204 || r.status === 200 });

  // Remove qualquer lead com observacao de teste
  const r4 = http.del(
    `${BASE_URL}/rest/v1/leads?observacao=eq.Lead gerado automaticamente por teste de carga k6`,
    null,
    { headers }
  );
  check(r4, { 'cleanup leads de teste': (r) => r.status === 204 || r.status === 200 });

  console.log('[cleanup] Concluído. Ambiente de homologação limpo.');
}
