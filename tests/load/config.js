// Configuração compartilhada para todos os cenários k6
// Carregue variáveis de ambiente antes de executar:
//   export TEST_SUPABASE_URL="https://[projeto-homolog].supabase.co"
//   export TEST_SUPABASE_ANON_KEY="[anon-key-homolog]"
//   k6 run tests/load/scenario-a.js

export const BASE_URL = __ENV.TEST_SUPABASE_URL || 'http://localhost:54321';
export const ANON_KEY  = __ENV.TEST_SUPABASE_ANON_KEY || 'test-anon-key';

// Usuários de teste (devem existir no Supabase de homologação antes da execução)
// Criar via seed-usuarios-teste.sql ou manualmente no Dashboard
export const MARKETING_EMAIL = __ENV.TEST_MARKETING_EMAIL || 'test.marketing@rjnet.invalid';
export const MARKETING_PASS  = __ENV.TEST_MARKETING_PASS  || 'TestMarketing@2026!';

export function vendedorEmail(n) {
  return `test.vendedor${n}@rjnet.invalid`;
}
export const VENDEDOR_PASS = __ENV.TEST_VENDEDOR_PASS || 'TestVendedor@2026!';

// Evento de teste — deve ser criado pelo script de setup antes da execução
export const EVENTO_ID_ENV = __ENV.TEST_EVENTO_ID || null;

// Headers padrão para REST
export function restHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'apikey': ANON_KEY,
    'Prefer': 'return=representation',
  };
}

// Headers para RPC
export function rpcHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'apikey': ANON_KEY,
  };
}

// Dados de lead completamente fictícios (CPF e telefone inválidos)
let _leadCounter = 0;
export function makeFakeLead(eventoId, vendedorNome, vendedorId) {
  _leadCounter++;
  return JSON.stringify({
    evento_id: eventoId,
    vendedor_nome: vendedorNome,
    vendedor_id: vendedorId,
    nome: `Lead Teste ${_leadCounter} ${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    telefone: '(00) 00000-0000',
    cpf: null,
    endereco: `Rua Fictícia, ${_leadCounter}`,
    servico_interesse: JSON.stringify(['internet_residencial']),
    temperatura: 'morno',
    observacao: 'Lead gerado automaticamente por teste de carga k6',
    ja_cliente_rjnet: false,
    criado_em: new Date().toISOString(),
    deletado: false,
    consentimento_coletado: true,
    consentimento_em: new Date().toISOString(),
    versao_termo: 'v1.0',
  });
}

// Dado fictício de evento para setup
export function makeFakeEvento() {
  return JSON.stringify({
    nome: `Evento Teste Carga ${Date.now()}`,
    local: 'Ambiente de Teste k6',
    data_inicio: new Date().toISOString(),
    data_fim: new Date(Date.now() + 8 * 3600_000).toISOString(),
    status: 'ativo',
    tipo: 'presenca_comercial',
    observacoes: 'Criado automaticamente por teste de carga k6 — remover após o teste',
    materiais: [],
    criado_em: new Date().toISOString(),
  });
}

// Thresholds padrão aplicados a todos os cenários (sobrescrever em cada script)
export const DEFAULT_THRESHOLDS = {
  http_req_duration: ['p(95)<1000', 'avg<500'],
  http_req_failed: ['rate<0.01'],
};
