/**
 * Testes unitários da fila offline (offline sync queue).
 * Espelha a lógica de src/lib/dataService.js sem depender do Supabase real.
 *
 * Para rodar: node tests/offline.unit.test.js
 */

let passed = 0;
let failed = 0;

function assert(desc, cond) {
  if (cond) { console.log(`  ✓ ${desc}`); passed++; }
  else       { console.error(`  ✗ ${desc}`); failed++; }
}

// ─── Mock localStorage ────────────────────────────────────────────────────────

let store = {};
const localStorage = {
  getItem:    (k) => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
  setItem:    (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
function resetStore() { store = {}; }

// ─── Replicação fiel das funções de fila (espelha dataService.js) ────────────

const QUEUE_KEY = 'rjnet_pending_queue';

function getQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function addToQueue(op) {
  const queue = getQueue();
  queue.push({ ...op, queuedAt: new Date().toISOString() });
  saveQueue(queue);
}

// Versão testável de flushPendingQueue: aceita mocks de Supabase e lista de
// eventos ativos, retorna contadores para inspeção nos testes.
async function flushPendingQueue(supabaseMock, activeEventIds = new Set()) {
  const queue = getQueue();
  if (queue.length === 0) return { sent: 0, discarded: 0, remaining: 0 };

  const remaining = [];
  let sent = 0;
  let discarded = 0;

  for (const op of queue) {
    try {
      if (op.type === 'saveLead') {
        if (activeEventIds.size > 0 && op.data.evento_id && !activeEventIds.has(op.data.evento_id)) {
          discarded++;
          continue;
        }
        const error = await supabaseMock(op.data);
        if (error) throw error;
        sent++;
      }
    } catch {
      remaining.push(op);
    }
  }

  saveQueue(remaining);
  return { sent, discarded, remaining: remaining.length };
}

// ─── Testes: armazenamento da fila ───────────────────────────────────────────

console.log('\ngetQueue — leitura do localStorage');

resetStore();
assert('fila vazia retorna array vazio', getQueue().length === 0);
assert('fila inexistente não lança exceção', Array.isArray(getQueue()));

resetStore();
saveQueue([{ type: 'saveLead', data: { evento_id: 'e1' } }]);
assert('fila com um item retorna um elemento', getQueue().length === 1);
assert('tipo do item é preservado', getQueue()[0].type === 'saveLead');
assert('data do item é preservada', getQueue()[0].data.evento_id === 'e1');

resetStore();
localStorage.setItem(QUEUE_KEY, 'json inválido {{{');
assert('JSON inválido retorna array vazio sem lançar', getQueue().length === 0);

// ─── Testes: addToQueue ───────────────────────────────────────────────────────

console.log('\naddToQueue — acumulação de operações');

resetStore();
addToQueue({ type: 'saveLead', data: { nome: 'João', evento_id: 'e1' } });
assert('primeiro item adicionado', getQueue().length === 1);
assert('item tem timestamp queuedAt', typeof getQueue()[0].queuedAt === 'string');
assert('queuedAt é ISO 8601 válido', !isNaN(Date.parse(getQueue()[0].queuedAt)));

addToQueue({ type: 'saveLead', data: { nome: 'Maria', evento_id: 'e1' } });
assert('segundo item acumulado', getQueue().length === 2);
assert('ordem FIFO preservada', getQueue()[0].data.nome === 'João');
assert('segundo item correto', getQueue()[1].data.nome === 'Maria');

addToQueue({ type: 'saveLead', data: { nome: 'Carlos', evento_id: 'e2' } });
assert('três itens de eventos diferentes', getQueue().length === 3);
assert('evento_id do terceiro preservado', getQueue()[2].data.evento_id === 'e2');

// ─── Testes: flushPendingQueue — fila vazia ───────────────────────────────────

console.log('\nflushPendingQueue — fila vazia');

resetStore();
let supabaseChamado = false;
const mockSucesso = async () => { supabaseChamado = true; return null; };

(async () => {

const r0 = await flushPendingQueue(mockSucesso, new Set(['e1']));
assert('fila vazia não faz requisição', !supabaseChamado);
assert('fila vazia retorna sent=0', r0.sent === 0);
assert('fila vazia retorna discarded=0', r0.discarded === 0);
assert('fila vazia retorna remaining=0', r0.remaining === 0);

// ─── Testes: flushPendingQueue — sucesso ─────────────────────────────────────

console.log('\nflushPendingQueue — sincronização com sucesso');

resetStore();
addToQueue({ type: 'saveLead', data: { nome: 'João', evento_id: 'e1' } });

let dadosRecebidos = null;
const mockCaptura = async (data) => { dadosRecebidos = data; return null; };

const r1 = await flushPendingQueue(mockCaptura, new Set(['e1']));
assert('item enviado ao Supabase', dadosRecebidos !== null);
assert('dados corretos enviados', dadosRecebidos.nome === 'João');
assert('sent=1 após sucesso', r1.sent === 1);
assert('fila esvaziada após sucesso', getQueue().length === 0);
assert('remaining=0 após sucesso', r1.remaining === 0);

// ─── Testes: flushPendingQueue — falha de rede ───────────────────────────────

console.log('\nflushPendingQueue — falha de rede (item permanece na fila)');

resetStore();
addToQueue({ type: 'saveLead', data: { nome: 'Ana', evento_id: 'e1' } });

const mockFalha = async () => new Error('network error');

const r2 = await flushPendingQueue(mockFalha, new Set(['e1']));
assert('sent=0 quando Supabase falha', r2.sent === 0);
assert('item permanece na fila após falha', getQueue().length === 1);
assert('remaining=1 após falha', r2.remaining === 1);
assert('dados do item preservados na fila', getQueue()[0].data.nome === 'Ana');

// ─── Testes: flushPendingQueue — evento encerrado ────────────────────────────

console.log('\nflushPendingQueue — descarte de lead com evento encerrado');

resetStore();
addToQueue({ type: 'saveLead', data: { nome: 'Carlos', evento_id: 'e_encerrado' } });

let mockChamado = false;
const mockNaoChamado = async () => { mockChamado = true; return null; };

// evento_id 'e_encerrado' não está no Set de ativos
const r3 = await flushPendingQueue(mockNaoChamado, new Set(['e_ativo']));
assert('Supabase não é chamado para evento encerrado', !mockChamado);
assert('item descartado (discarded=1)', r3.discarded === 1);
assert('fila esvaziada (item descartado, não mantido)', getQueue().length === 0);
assert('remaining=0 (descartado, não em falha)', r3.remaining === 0);

// ─── Testes: flushPendingQueue — sem validação de evento ─────────────────────

console.log('\nflushPendingQueue — sem lista de eventos ativos (sem validação)');

resetStore();
addToQueue({ type: 'saveLead', data: { nome: 'Marcos', evento_id: 'e_qualquer' } });

let enviadoSemValidacao = false;
const mockSemValidacao = async () => { enviadoSemValidacao = true; return null; };

// Set vazio = sem validação (como quando o fetch de eventos falha)
const r4 = await flushPendingQueue(mockSemValidacao, new Set());
assert('sem lista de ativos, envia sem validar evento', enviadoSemValidacao);
assert('sent=1 sem validação', r4.sent === 1);

// ─── Testes: flushPendingQueue — múltiplos itens, falha parcial ──────────────

console.log('\nflushPendingQueue — múltiplos itens com falha parcial');

resetStore();
addToQueue({ type: 'saveLead', data: { nome: 'Lead A', evento_id: 'e1' } });
addToQueue({ type: 'saveLead', data: { nome: 'Lead B', evento_id: 'e1' } });
addToQueue({ type: 'saveLead', data: { nome: 'Lead C', evento_id: 'e1' } });

let contadorChamadas = 0;
// Falha apenas na segunda chamada
const mockFalhaParcial = async (data) => {
  contadorChamadas++;
  if (data.nome === 'Lead B') return new Error('timeout');
  return null;
};

const r5 = await flushPendingQueue(mockFalhaParcial, new Set(['e1']));
assert('3 chamadas feitas', contadorChamadas === 3);
assert('sent=2 (A e C com sucesso)', r5.sent === 2);
assert('remaining=1 (B com falha)', r5.remaining === 1);
assert('Lead B permanece na fila', getQueue()[0].data.nome === 'Lead B');
assert('Lead A e C removidos da fila', getQueue().length === 1);

// ─── Testes: flushPendingQueue — mix de eventos ativos e encerrados ──────────

console.log('\nflushPendingQueue — mix de eventos ativos e encerrados');

resetStore();
addToQueue({ type: 'saveLead', data: { nome: 'Lead Ativo',    evento_id: 'e_ativo' } });
addToQueue({ type: 'saveLead', data: { nome: 'Lead Encerrado', evento_id: 'e_encerrado' } });
addToQueue({ type: 'saveLead', data: { nome: 'Lead Ativo 2',  evento_id: 'e_ativo' } });

const r6 = await flushPendingQueue(mockSucesso, new Set(['e_ativo']));
assert('sent=2 (dois de evento ativo)', r6.sent === 2);
assert('discarded=1 (um de evento encerrado)', r6.discarded === 1);
assert('fila vazia após processamento', getQueue().length === 0);

// ─── Resultado ────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Resultado: ${passed} passou | ${failed} falhou`);
if (failed > 0) process.exit(1);

})();
