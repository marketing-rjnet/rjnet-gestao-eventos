// Helpers compartilhados entre os cenários k6
import http from 'k6/http';
import { check, fail } from 'k6';
import { BASE_URL, ANON_KEY, restHeaders, rpcHeaders, makeFakeLead } from './config.js';

// Autentica um usuário e retorna { token, userId, role }
// Falha o VU inteiro se o login não funcionar (pré-requisito de todos os cenários)
export function login(email, password) {
  const res = http.post(
    `${BASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email, password }),
    {
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
      },
      tags: { type: 'auth' },
    }
  );

  const ok = check(res, {
    'login 200': (r) => r.status === 200,
    'login tem access_token': (r) => {
      try { return !!JSON.parse(r.body).access_token; } catch { return false; }
    },
  });

  if (!ok) fail(`Login falhou para ${email}: HTTP ${res.status} — ${res.body}`);

  const body = JSON.parse(res.body);
  return {
    token: body.access_token,
    userId: body.user?.id,
    role: body.user?.app_metadata?.role,
  };
}

// Busca o primeiro evento com status 'ativo'
// Retorna o id do evento ou null se não houver evento ativo
export function getEventoAtivo(token) {
  const res = http.get(
    `${BASE_URL}/rest/v1/eventos?status=eq.ativo&select=id,nome&limit=1`,
    { headers: restHeaders(token), tags: { type: 'setup' } }
  );

  check(res, { 'getEventoAtivo 200': (r) => r.status === 200 });

  try {
    const data = JSON.parse(res.body);
    return data.length > 0 ? data[0].id : null;
  } catch { return null; }
}

// Cria um evento de teste e retorna seu id
// Requer token de usuário marketing
export function criarEventoTeste(token) {
  const body = JSON.stringify({
    nome: `[TESTE] Evento Carga ${Date.now()}`,
    local: 'Ambiente k6',
    data_inicio: new Date().toISOString(),
    data_fim: new Date(Date.now() + 8 * 3600_000).toISOString(),
    status: 'ativo',
    tipo: 'presenca_comercial',
    observacoes: '[REMOVER] Criado por teste de carga k6',
    materiais: [],
    criado_em: new Date().toISOString(),
  });

  const res = http.post(
    `${BASE_URL}/rest/v1/eventos`,
    body,
    { headers: restHeaders(token), tags: { type: 'setup' } }
  );

  check(res, { 'criarEvento 201': (r) => r.status === 201 });

  try {
    const data = JSON.parse(res.body);
    return Array.isArray(data) ? data[0]?.id : data?.id;
  } catch { return null; }
}

// Insere um lead fictício — operação principal dos vendedores
// Retorna true se a inserção foi bem-sucedida
export function saveLead(token, eventoId, vendedorNome, vendedorId) {
  const res = http.post(
    `${BASE_URL}/rest/v1/leads`,
    makeFakeLead(eventoId, vendedorNome, vendedorId),
    {
      headers: { ...restHeaders(token), 'Prefer': 'return=minimal' },
      tags: { type: 'saveLead' },
    }
  );

  return check(res, {
    'saveLead 201': (r) => r.status === 201,
  });
}

// Consulta o ranking do evento via RPC
// Retorna o array de ranking ou null em caso de erro
export function getRanking(token, eventoId) {
  const res = http.post(
    `${BASE_URL}/rest/v1/rpc/ranking_evento`,
    JSON.stringify({ eid: eventoId }),
    {
      headers: rpcHeaders(token),
      tags: { type: 'ranking' },
    }
  );

  check(res, { 'ranking 200': (r) => r.status === 200 });

  try { return JSON.parse(res.body); } catch { return null; }
}

// Executa um fetchAll simulando o marketing (4 queries paralelas)
export function fetchAll(token) {
  const params = { headers: restHeaders(token), tags: { type: 'fetchAll' } };

  const responses = http.batch([
    ['GET', `${BASE_URL}/rest/v1/materiais?select=*&order=nome`, null, params],
    ['GET', `${BASE_URL}/rest/v1/perfis?select=*&order=nome`, null, params],
    ['GET', `${BASE_URL}/rest/v1/eventos?select=*&order=data_inicio`, null, params],
    ['GET', `${BASE_URL}/rest/v1/leads?select=*&deletado=eq.false&order=criado_em`, null, params],
  ]);

  return check(responses[0], { 'fetchAll materiais 200': (r) => r.status === 200 }) &&
         check(responses[2], { 'fetchAll eventos 200': (r) => r.status === 200 }) &&
         check(responses[3], { 'fetchAll leads 200': (r) => r.status === 200 });
}

// Exportação CSV: busca todos os leads do evento (simula o click em "Exportar CSV")
export function exportarLeads(token, eventoId) {
  const res = http.get(
    `${BASE_URL}/rest/v1/leads?evento_id=eq.${eventoId}&deletado=eq.false&select=*`,
    {
      headers: restHeaders(token),
      tags: { type: 'exportCSV' },
    }
  );

  return check(res, {
    'exportCSV 200': (r) => r.status === 200,
    'exportCSV tem dados': (r) => {
      try { return JSON.parse(r.body).length > 0; } catch { return false; }
    },
  });
}

// Remove todos os dados de teste identificados pelo marcador [REMOVER]
// DEVE ser chamado pelo script de cleanup após cada execução
export function cleanup(serviceToken, eventoId) {
  if (!eventoId) return;

  // Remove leads do evento de teste
  http.del(
    `${BASE_URL}/rest/v1/leads?evento_id=eq.${eventoId}`,
    null,
    {
      headers: { ...restHeaders(serviceToken), 'Prefer': 'return=minimal' },
      tags: { type: 'cleanup' },
    }
  );

  // Remove o evento de teste
  http.del(
    `${BASE_URL}/rest/v1/eventos?id=eq.${eventoId}`,
    null,
    {
      headers: { ...restHeaders(serviceToken), 'Prefer': 'return=minimal' },
      tags: { type: 'cleanup' },
    }
  );
}
