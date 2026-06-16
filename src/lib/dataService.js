// Camada de dados Supabase — converte entre o formato do app (camelCase)
// e as colunas do banco (snake_case). Schema em supabase/schema.sql e
// autenticação/papéis em supabase/migracao-auth.sql.
import { supabase, supabaseConfig } from './supabase';
import { isSupabaseMode } from './mode';
import { cache } from './cache';

/* ─── Fila offline ───────────────────────────────────────────────── */

const QUEUE_KEY = 'rjnet_pending_queue';

function getQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('[rjnet] Falha ao salvar fila offline:', err.message);
  }
}

function addToQueue(op) {
  const queue = getQueue();
  queue.push({ ...op, queuedAt: new Date().toISOString() });
  saveQueue(queue);
}

// Envia todos os leads pendentes ao Supabase. Descarta itens cujo evento
// não está mais ativo (ex: marketing encerrou o evento enquanto vendedor
// estava offline). Itens com falha permanecem na fila para próxima tentativa.
export async function flushPendingQueue() {
  if (!isSupabaseMode()) return;
  const queue = getQueue();
  if (queue.length === 0) return;

  let activeEventIds = new Set();
  try {
    const { data } = await supabase.from('eventos').select('id').eq('status', 'ativo');
    if (data) activeEventIds = new Set(data.map((e) => e.id));
  } catch { /* sem validação de evento se fetch falhar */ }

  const remaining = [];
  for (const op of queue) {
    try {
      if (op.type === 'saveLead') {
        if (activeEventIds.size > 0 && op.data.evento_id && !activeEventIds.has(op.data.evento_id)) {
          console.warn('[rjnet] Lead offline descartado: evento encerrado', op.data.evento_id);
          continue;
        }
        const { error } = await supabase.from('leads').upsert(op.data);
        if (error) throw error;
      }
    } catch (err) {
      console.error('[rjnet] Falha ao sincronizar da fila:', err.message);
      remaining.push(op);
    }
  }
  saveQueue(remaining);
}

/* ─── Utilitários de resiliência ─────────────────────────────────── */

// Tenta `fn` até `maxAttempts` vezes com backoff exponencial.
async function withRetry(fn, { maxAttempts = 3, baseDelayMs = 800 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
      }
    }
  }
  throw lastErr;
}

// Loga requisições lentas (> 1 s) e erros com o tempo decorrido.
async function trackPerf(label, fn) {
  const t0 = performance.now();
  try {
    const result = await fn();
    const ms = Math.round(performance.now() - t0);
    if (ms > 1000) console.warn(`[rjnet:perf] ${label} demorou ${ms}ms`);
    return result;
  } catch (err) {
    const ms = Math.round(performance.now() - t0);
    console.error(`[rjnet:perf] ${label} falhou em ${ms}ms`, err.message || err);
    throw err;
  }
}

/* ─── Mapeadores app ↔ banco ─────────────────────────────────────── */

const materialFromDb = (r) => ({
  id: r.id, nome: r.nome, quantidade: r.quantidade, descricao: r.descricao ?? undefined,
});
const materialToDb = (m) => ({
  id: m.id, nome: m.nome, quantidade: m.quantidade, descricao: m.descricao ?? null,
});

const vendedorFromDb = (r) => ({ id: r.id, nome: r.nome, ativo: r.ativo });
const vendedorToDb = (v) => ({ id: v.id, nome: v.nome, ativo: v.ativo });

const eventoFromDb = (r) => ({
  id: r.id, nome: r.nome, local: r.local ?? "",
  dataInicio: r.data_inicio, dataFim: r.data_fim,
  status: r.status, tipo: r.tipo,
  observacoes: r.observacoes ?? undefined,
  materiais: r.materiais ?? [],
  criadoEm: r.criado_em,
});
const eventoToDb = (e) => ({
  id: e.id, nome: e.nome, local: e.local ?? null,
  data_inicio: e.dataInicio || null, data_fim: e.dataFim || null,
  status: e.status, tipo: e.tipo ?? null,
  observacoes: e.observacoes ?? null,
  materiais: e.materiais ?? [],
  criado_em: e.criadoEm || new Date().toISOString(),
});

const leadFromDb = (r) => ({
  id: r.id, eventoId: r.evento_id, vendedorNome: r.vendedor_nome ?? "",
  vendedorId: r.vendedor_id ?? null,
  nome: r.nome, telefone: r.telefone ?? "", cpf: r.cpf ?? "",
  endereco: r.endereco ?? "", servicoInteresse: r.servico_interesse,
  temperatura: r.temperatura, observacao: r.observacao ?? "",
  jaClienteRjnet: r.ja_cliente_rjnet ?? false,
  criadoEm: r.criado_em,
});
const leadToDb = (l) => ({
  id: l.id, evento_id: l.eventoId, vendedor_nome: l.vendedorNome ?? null,
  vendedor_id: l.vendedorId ?? null,
  nome: l.nome, telefone: l.telefone || null, cpf: l.cpf || null,
  endereco: l.endereco || null, servico_interesse: l.servicoInteresse ?? null,
  temperatura: l.temperatura ?? 'morno', observacao: l.observacao || null,
  ja_cliente_rjnet: l.jaClienteRjnet ?? false,
  criado_em: l.criadoEm || new Date().toISOString(),
});

const perfilFromDb = (r) => ({
  id: r.id, email: r.email ?? "", nome: r.nome,
  papel: r.papel, ativo: r.ativo,
});

/* ─── Leitura ────────────────────────────────────────────────────── */

// Busca as tabelas em paralelo. Cancela via AbortController quando o
// componente desmonta. Retorna null se o Supabase estiver indisponível.
export async function fetchAll(signal) {
  if (!isSupabaseMode()) return null;
  return trackPerf('fetchAll', () =>
    withRetry(async () => {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const [materiais, perfis, eventos, leads] = await Promise.all([
        supabase.from('materiais').select('*').order('nome').abortSignal(signal),
        supabase.from('perfis').select('*').order('nome').abortSignal(signal),
        supabase.from('eventos').select('*').order('data_inicio').abortSignal(signal),
        // Exclui leads marcados como deletados (soft delete via protecao-dados.sql)
        supabase.from('leads').select('*').eq('deletado', false).order('criado_em').abortSignal(signal),
      ]);

      const erro = materiais.error || eventos.error || leads.error;
      if (erro) throw erro;

      // Antes da migração de auth a tabela perfis não existe — cai para a
      // tabela legada de vendedores
      let vendedores;
      if (perfis.error) {
        const legado = await supabase.from('vendedores').select('*').order('nome').abortSignal(signal);
        if (legado.error) throw legado.error;
        vendedores = legado.data.map(vendedorFromDb);
      } else {
        vendedores = perfis.data.map(perfilFromDb);
      }

      return {
        materiais: materiais.data.map(materialFromDb),
        vendedores,
        eventos: eventos.data.map(eventoFromDb),
        leads: leads.data.map(leadFromDb),
      };
    }, { maxAttempts: 3, baseDelayMs: 800 })
  ).catch((err) => {
    if (err.name === 'AbortError') return null;
    console.error('[rjnet] Falha ao carregar dados do Supabase:', err.message || err);
    return null;
  });
}

// Placar do evento com cache de 30 s — evita RPC redundante quando o
// vendedor adiciona vários leads em sequência rápida.
export async function rankingEvento(eventoId) {
  if (!isSupabaseMode() || !eventoId) return null;

  const cacheKey = `ranking:${eventoId}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  return trackPerf(`rankingEvento(${eventoId})`, () =>
    withRetry(async () => {
      const { data, error } = await supabase.rpc('ranking_evento', { eid: eventoId });
      if (error) throw error;
      return data.map((r) => ({ nome: r.vendedor_nome, total: Number(r.total) }));
    }, { maxAttempts: 2, baseDelayMs: 500 })
  ).then((result) => {
    cache.set(cacheKey, result, 30_000); // TTL 30 s
    return result;
  }).catch((err) => {
    console.error('[rjnet] Falha ao carregar o placar:', err.message);
    return null;
  });
}

// Invalida o cache do placar de um evento (chamar após salvar lead)
export function invalidarRanking(eventoId) {
  cache.invalidate(`ranking:${eventoId}`);
}

/* ─── Escrita (fire-and-forget com log de erro e retry) ──────────── */

function exec(promise, acao, onFail) {
  if (!isSupabaseMode()) return;
  // Retry uma vez após 1 s em caso de falha transitória
  const tentativa = (p) => p.then(({ error }) => {
    if (error) throw error;
  });
  tentativa(promise).catch(() =>
    new Promise((r) => setTimeout(r, 1000))
      .then(() => tentativa(promise))
      .catch((err) => {
        console.error(`[rjnet] Supabase: falha ao ${acao}:`, err.message);
        window.dispatchEvent(new CustomEvent('rjnet:sync-error', { detail: { acao, message: err.message } }));
        if (onFail) onFail();
      })
  );
}

export const db = {
  saveMaterial: (m) => exec(supabase?.from('materiais').upsert(materialToDb(m)), 'salvar material'),
  saveVendedor: (v) => exec(supabase?.from('vendedores').upsert(vendedorToDb(v)), 'salvar vendedor'),
  saveEvento:   (e) => exec(supabase?.from('eventos').upsert(eventoToDb(e)), 'salvar evento'),
  saveLead: (l) => {
    const dbData = leadToDb(l);
    exec(
      supabase?.from('leads').upsert(dbData),
      'salvar lead',
      () => addToQueue({ type: 'saveLead', data: dbData }),
    );
  },
  removeEvento: (id) => exec(supabase?.from('eventos').delete().eq('id', id), 'remover evento'),
  removeLead:   (id) => exec(supabase?.from('leads').update({ deletado: true }).eq('id', id), 'remover lead'),
};

/* ─── Autenticação (Supabase Auth + perfis por papel) ────────────── */

// Helper: busca sessão uma vez e reutiliza no mesmo tick via micro-cache
let _sessionPromise = null;
async function getSessionOnce() {
  if (_sessionPromise) return _sessionPromise;
  _sessionPromise = supabase.auth.getSession().then((r) => r.data?.session ?? null);
  // Descarta após o tick para não reutilizar sessão stale
  _sessionPromise.finally(() => { _sessionPromise = null; });
  return _sessionPromise;
}

// Helper compartilhado para chamadas à Edge Function
async function callEdgeFunction(action, payload) {
  const session = await getSessionOnce();
  const fnUrl = `${supabaseConfig.url}/functions/v1/atualizar-email-usuario`;
  return trackPerf(`edgeFn:${action}`, () =>
    withRetry(async () => {
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': supabaseConfig.anonKey,
        },
        body: JSON.stringify({ action, ...payload }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Falha na ação ${action}.`);
      return body;
    }, { maxAttempts: 2, baseDelayMs: 1000 })
  );
}

export const auth = {
  // Login com e-mail/senha. Retorna a sessão do app:
  // { role, vendedorNome, userId, email } — ou lança erro legível.
  async signIn(email, senha) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) {
      const msg = /invalid login credentials/i.test(error.message)
        ? 'E-mail ou senha incorretos.'
        : error.message;
      throw new Error(msg);
    }
    const perfil = await auth.getPerfil(data.user.id);
    if (!perfil || !perfil.ativo) {
      await supabase.auth.signOut();
      throw new Error('Seu acesso ainda não foi ativado. Fale com o marketing.');
    }
    return { role: perfil.papel, vendedorNome: perfil.nome, userId: perfil.id, email: perfil.email };
  },

  signOut: () => supabase.auth.signOut(),

  // Sessão já existente (usuário reabrindo o app)
  async getSessao() {
    const { data } = await supabase.auth.getSession();
    const user = data?.session?.user;
    if (!user) return null;
    const perfil = await auth.getPerfil(user.id);
    if (!perfil || !perfil.ativo) return null;
    return { role: perfil.papel, vendedorNome: perfil.nome, userId: perfil.id, email: perfil.email };
  },

  async getPerfil(userId) {
    const { data, error } = await supabase.from('perfis').select('*').eq('id', userId).maybeSingle();
    if (error || !data) return null;
    return perfilFromDb(data);
  },

  onChange(callback) {
    const { data } = supabase.auth.onAuthStateChange((evento) => callback(evento));
    return () => data.subscription.unsubscribe();
  },

  // Criação de usuário via Edge Function (Admin API — sem rate limit de e-mail).
  async criarUsuario({ nome, email, senha, papel }) {
    const body = await callEdgeFunction('criar', { nome, email, senha, papel });
    return body.userId;
  },

  async atualizarPerfil(userId, patch) {
    // E-mail vai pela Edge Function (requer service_role para atualizar auth.users)
    if (patch.email !== undefined) {
      await callEdgeFunction('atualizar-email', { userId, email: patch.email });
      const { email: _email, ...restPatch } = patch;
      patch = restPatch;
    }

    const campos = {
      ...(patch.nome  !== undefined ? { nome:  patch.nome  } : {}),
      ...(patch.papel !== undefined ? { papel: patch.papel } : {}),
      ...(patch.ativo !== undefined ? { ativo: patch.ativo } : {}),
    };
    if (Object.keys(campos).length === 0) return;
    const { error } = await supabase.from('perfis').update(campos).eq('id', userId);
    if (error) throw new Error(error.message);
  },

  async excluirUsuario(userId) {
    await callEdgeFunction('excluir', { userId });
  },

  // E-mail de redefinição de senha (usa o e-mail transacional do Supabase)
  resetSenha: (email) => supabase.auth.resetPasswordForEmail(email),

  // Define a nova senha do usuário logado (fluxo de recuperação)
  async atualizarSenha(senha) {
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) throw new Error(error.message);
  },
};

/* ─── Realtime — sincronização entre dispositivos ────────────────── */

// Chama onChange sempre que qualquer tabela mudar em outro dispositivo.
// Retorna função de cleanup para usar em useEffect.
export function subscribeChanges(onChange) {
  if (!isSupabaseMode()) return () => {};
  let timer = null;
  const channel = supabase
    .channel('rjnet-sync')
    .on('postgres_changes', { event: '*', schema: 'public' }, () => {
      // debounce: várias mudanças seguidas geram um único refetch
      clearTimeout(timer);
      timer = setTimeout(onChange, 400);
    })
    .subscribe();
  return () => {
    clearTimeout(timer);
    supabase.removeChannel(channel);
  };
}
