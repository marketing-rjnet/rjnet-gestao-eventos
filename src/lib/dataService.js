// Camada de dados Supabase — converte entre o formato do app (camelCase)
// e as colunas do banco (snake_case). Schema em supabase/schema.sql e
// autenticação/papéis em supabase/migracao-auth.sql.
import { supabase, supabaseConfig } from './supabase';
import { isSupabaseMode } from './mode';
import { cache } from './cache';
import { encryptQueue, decryptQueue, clearCryptoKey, cryptoSupported } from './crypto';
import { REALTIME_DEBOUNCE_MS } from './constants';
import { logActivity } from './activityLog';

/* ─── Fila offline — PA-05/LGPD: dados criptografados em repouso ─── */

const QUEUE_KEY = 'rjnet_pending_queue';

// userId da sessão ativa — necessário para derivar a chave de criptografia.
// Atualizado por setQueueUserId() chamado no login/logout.
let _queueUserId = null;

export function setQueueUserId(userId) {
  _queueUserId = userId || null;
}

export function clearQueueSession(userId) {
  clearCryptoKey(userId);
  _queueUserId = null;
}

async function getQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];

    // PA-05: se cripto disponível e usuário logado, tenta descriptografar
    if (cryptoSupported && _queueUserId && raw.includes('.')) {
      const decrypted = await decryptQueue(raw, _queueUserId);
      if (decrypted !== null) return decrypted;
      // Falha na descriptografia: dados de outro usuário ou legados — descarta
      console.warn('[rjnet/PA-05] Fila offline inacessível (chave diferente ou formato legado). Descartando.');
      localStorage.removeItem(QUEUE_KEY);
      return [];
    }

    // Fallback: formato legado sem criptografia (migração transparente)
    return JSON.parse(raw);
  } catch { return []; }
}

async function saveQueue(queue) {
  try {
    if (cryptoSupported && _queueUserId) {
      const encrypted = await encryptQueue(queue, _queueUserId);
      localStorage.setItem(QUEUE_KEY, encrypted);
    } else {
      // Fallback: sem cripto (modo local sem userId ou browser sem Web Crypto)
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }
  } catch (err) {
    console.error('[rjnet] Falha ao salvar fila offline:', err.message);
  }
}

async function addToQueue(op) {
  const queue = await getQueue();
  queue.push({ ...op, queuedAt: new Date().toISOString() });
  await saveQueue(queue);
  logActivity({ type: 'offline_queue', level: 'warn', eventoId: op.data?.evento_id, detail: 'aguardando sync' });
}

// Envia todos os leads pendentes ao Supabase. Descarta itens cujo evento
// não está mais ativo (ex: marketing encerrou o evento enquanto vendedor
// estava offline). Itens com falha permanecem na fila para próxima tentativa.
export async function flushPendingQueue() {
  if (!isSupabaseMode()) return;
  const queue = await getQueue();
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
  await saveQueue(remaining);
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
    if (ms > 1000) {
      console.warn(`[rjnet:perf] ${label} demorou ${ms}ms`);
      logActivity({ type: 'perf_warn', level: 'warn', detail: label, ms });
    }
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
  id: r.id, eventoId: r.evento_id, mesReferencia: r.mes_referencia ?? null,
  vendedorNome: r.vendedor_nome ?? "",
  vendedorId: r.vendedor_id ?? null,
  nome: r.nome, telefone: r.telefone ?? "", cpf: r.cpf ?? "",
  endereco: r.endereco ?? "", servicoInteresse: (() => {
    const v = r.servico_interesse;
    if (!v) return [];
    try { const p = JSON.parse(v); return Array.isArray(p) ? p : [v]; } catch { return [v]; }
  })(),
  temperatura: r.temperatura, observacao: r.observacao ?? "",
  jaClienteRjnet: r.ja_cliente_rjnet ?? false,
  criadoEm: r.criado_em,
  // PA-04/LGPD: campos de consentimento do titular
  consentimentoColetado: r.consentimento_coletado ?? false,
  consentimentoEm: r.consentimento_em ?? null,
  versaoTermo: r.versao_termo ?? null,
  // QR Code / Form Builder: atributos de proveniência — nunca um contexto
  // operacional novo, sempre paralelos a evento_id/mes_referencia (que
  // continuam XOR entre si)
  origem: r.origem ?? null,
  origemIp: r.origem_ip ?? null,
  qrCodeId: r.qr_code_id ?? null,
  qrCodeLabel: r.qr_code_label ?? null,
  formularioId: r.formulario_id ?? null,
  bairro: r.bairro ?? "",
  // Form Builder: respostas de campos personalizados (sempre texto livre),
  // guardadas à parte das colunas fixas — ver migracao-campos-personalizados.sql
  camposExtras: r.campos_extras ?? {},
  // Simulador: respostas do quiz + score calculado no servidor + atribuição
  // de tráfego (UTM) — ver migracao-simulador.sql e src/lib/simulador.js
  simuladorId: r.simulador_id ?? null,
  perfilConsumo: r.perfil_consumo ?? null,
  pontuacao: r.pontuacao ?? null,
  ofertaRecomendada: r.oferta_recomendada ?? null,
  cidade: r.cidade ?? "",
  utm: r.utm ?? null,
});
const leadToDb = (l) => ({
  id: l.id, evento_id: l.eventoId ?? null, mes_referencia: l.mesReferencia ?? null,
  vendedor_nome: l.vendedorNome ?? null,
  vendedor_id: l.vendedorId ?? null,
  nome: l.nome, telefone: l.telefone || null, cpf: l.cpf || null,
  endereco: l.endereco || null,
  servico_interesse: Array.isArray(l.servicoInteresse) ? JSON.stringify(l.servicoInteresse) : (l.servicoInteresse ?? null),
  temperatura: l.temperatura ?? 'morno', observacao: l.observacao || null,
  ja_cliente_rjnet: l.jaClienteRjnet ?? false,
  criado_em: l.criadoEm || new Date().toISOString(),
  // PA-04/LGPD: campos de consentimento do titular
  consentimento_coletado: l.consentimentoColetado ?? false,
  consentimento_em: l.consentimentoColetado ? (l.consentimentoEm || new Date().toISOString()) : null,
  versao_termo: l.consentimentoColetado ? (l.versaoTermo || 'v1.0') : null,
  // QR Code / Form Builder: atributos de proveniência (ver leadFromDb)
  origem: l.origem ?? null,
  origem_ip: l.origemIp ?? null,
  qr_code_id: l.qrCodeId ?? null,
  qr_code_label: l.qrCodeLabel ?? null,
  formulario_id: l.formularioId ?? null,
  bairro: l.bairro || null,
  campos_extras: l.camposExtras ?? {},
  // Simulador (ver leadFromDb)
  simulador_id: l.simuladorId ?? null,
  perfil_consumo: l.perfilConsumo ?? null,
  pontuacao: l.pontuacao ?? null,
  oferta_recomendada: l.ofertaRecomendada ?? null,
  cidade: l.cidade || null,
  utm: l.utm ?? null,
});

// Form Builder: `campos`/`campos_obrigatorios` guardam só chaves do
// catálogo fixo CAMPOS_FORMULARIO (src/lib/constants.js) — nunca schema
// arbitrário (ver comentário em supabase/migracao-form-builder.sql).
// `camposPersonalizadosIds`/`...Obrigatorios` referenciam campos_personalizados
// (sempre texto livre, ver migracao-campos-personalizados.sql) — lista
// separada de propósito, pra nunca colidir com uma chave do catálogo fixo.
const formularioFromDb = (r) => ({
  id: r.id, nome: r.nome, slug: r.slug,
  campos: r.campos ?? [], camposObrigatorios: r.campos_obrigatorios ?? [],
  camposPersonalizadosIds: r.campos_personalizados_ids ?? [],
  camposPersonalizadosObrigatorios: r.campos_personalizados_obrigatorios ?? [],
  ativo: r.ativo ?? true, criadoEm: r.criado_em,
});
const formularioToDb = (f) => ({
  id: f.id, nome: f.nome, slug: f.slug,
  campos: f.campos ?? [], campos_obrigatorios: f.camposObrigatorios ?? [],
  campos_personalizados_ids: f.camposPersonalizadosIds ?? [],
  campos_personalizados_obrigatorios: f.camposPersonalizadosObrigatorios ?? [],
  ativo: f.ativo ?? true, criado_em: f.criadoEm || new Date().toISOString(),
});

// Campo personalizado: sempre texto livre, só a legenda é definida pela
// equipe (marketing/comercial) — nunca um tipo/validação novo.
const campoPersonalizadoFromDb = (r) => ({
  id: r.id, label: r.label, key: r.key, ativo: r.ativo ?? true, criadoEm: r.criado_em,
});
const campoPersonalizadoToDb = (c) => ({
  id: c.id, label: c.label, key: c.key, ativo: c.ativo ?? true, criado_em: c.criadoEm || new Date().toISOString(),
});

// Simulador: campanha de captação gamificada — a tabela guarda só a
// identidade (nome/slug/tipo); o questionário é catálogo fixo em código
// (src/lib/simulador.js), mesmo princípio do Form Builder (D-062).
const simuladorFromDb = (r) => ({
  id: r.id, nome: r.nome, slug: r.slug,
  tipo: r.tipo ?? 'perfil_consumo', campanha: r.campanha ?? '',
  versaoPerguntas: r.versao_perguntas ?? 1,
  ativo: r.ativo ?? true, criadoEm: r.criado_em,
});
const simuladorToDb = (s) => ({
  id: s.id, nome: s.nome, slug: s.slug,
  tipo: s.tipo ?? 'perfil_consumo', campanha: s.campanha || null,
  versao_perguntas: s.versaoPerguntas ?? 1,
  ativo: s.ativo ?? true, criado_em: s.criadoEm || new Date().toISOString(),
});

const perfilFromDb = (r) => ({
  id: r.id, email: r.email ?? "", nome: r.nome,
  papel: r.papel, ativo: r.ativo,
});

// D-057: oferta pronta (imagem + copy) por serviço — servico é a própria chave.
const ofertaFromDb = (r) => ({
  servico: r.servico, copy: r.copy ?? '', imagemPath: r.imagem_path ?? null,
  imagemUrl: r.imagem_path
    ? `${supabaseConfig.url}/storage/v1/object/public/ofertas/${r.imagem_path}?v=${r.atualizado_em}`
    : null,
  atualizadoEm: r.atualizado_em,
});
const ofertaToDb = (o) => ({
  servico: o.servico, copy: o.copy ?? '', imagem_path: o.imagemPath ?? null,
  atualizado_em: new Date().toISOString(),
});

/* ─── Leitura ────────────────────────────────────────────────────── */

// Colunas de leads reutilizadas em fetchLeadsEvento e fetchLeadsEventos
const LEADS_COLS = 'id,evento_id,mes_referencia,vendedor_nome,vendedor_id,nome,telefone,cpf,endereco,servico_interesse,temperatura,observacao,ja_cliente_rjnet,criado_em,consentimento_coletado,consentimento_em,versao_termo,origem,origem_ip,qr_code_id,qr_code_label,formulario_id,bairro,campos_extras,simulador_id,perfil_consumo,pontuacao,oferta_recomendada,cidade,utm';

// TB-004: busca apenas materiais, eventos e perfis no boot.
// Leads são carregados on-demand por evento via fetchLeadsEvento / fetchLeadsEventos.
export async function fetchAll(signal) {
  if (!isSupabaseMode()) return null;
  return trackPerf('fetchAll', () =>
    withRetry(async () => {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      // QW-004: selecionar apenas colunas usadas pelos mapeadores fromDb
      const [materiais, perfis, eventos, ofertas, formularios, camposPersonalizados, simuladores] = await Promise.all([
        supabase.from('materiais').select('id,nome,quantidade,descricao').order('nome').abortSignal(signal),
        supabase.from('perfis').select('id,email,nome,papel,ativo').order('nome').abortSignal(signal),
        supabase.from('eventos').select('id,nome,local,data_inicio,data_fim,status,tipo,observacoes,materiais,criado_em').order('data_inicio').abortSignal(signal),
        // D-057: se a migração ainda não rodou nesse ambiente, cai para lista vazia (não derruba o boot)
        supabase.from('ofertas').select('servico,copy,imagem_path,atualizado_em').order('servico').abortSignal(signal),
        // Form Builder: tabela pequena e estática, mesmo tratamento de ofertas
        supabase.from('formularios').select('id,nome,slug,campos,campos_obrigatorios,campos_personalizados_ids,campos_personalizados_obrigatorios,ativo,criado_em').order('criado_em', { ascending: false }).abortSignal(signal),
        supabase.from('campos_personalizados').select('id,label,key,ativo,criado_em').order('criado_em', { ascending: false }).abortSignal(signal),
        // Simulador: mesmo tratamento gracioso — sem a migração, cai para lista vazia
        supabase.from('simuladores').select('id,nome,slug,tipo,campanha,versao_perguntas,ativo,criado_em').order('criado_em', { ascending: false }).abortSignal(signal),
      ]);

      const erro = materiais.error || eventos.error;
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
        ofertas: ofertas.error ? [] : ofertas.data.map(ofertaFromDb),
        formularios: formularios.error ? [] : formularios.data.map(formularioFromDb),
        camposPersonalizados: camposPersonalizados.error ? [] : camposPersonalizados.data.map(campoPersonalizadoFromDb),
        simuladores: simuladores.error ? [] : simuladores.data.map(simuladorFromDb),
        leads: [],
      };
    }, { maxAttempts: 3, baseDelayMs: 800 })
  ).catch((err) => {
    if (err.name === 'AbortError') return null;
    console.error('[rjnet] Falha ao carregar dados do Supabase:', err.message || err);
    return null;
  });
}

// TB-004: leads de um único evento — usado pelo vendedor e pelo EventDetail.
export async function fetchLeadsEvento(eventoId, signal) {
  if (!isSupabaseMode() || !eventoId) return null;
  return trackPerf('fetchLeadsEvento', () =>
    withRetry(async () => {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const { data, error } = await supabase
        .from('leads')
        .select(LEADS_COLS)
        .eq('evento_id', eventoId)
        .eq('deletado', false)
        .order('criado_em')
        .abortSignal(signal);
      if (error) throw error;
      return data.map(leadFromDb);
    })
  ).catch((err) => {
    if (err.name === 'AbortError') return null;
    console.error('[rjnet] Falha ao buscar leads do evento:', err.message || err);
    return null;
  });
}

// TB-004: leads de múltiplos eventos — usado pela exportação consolidada do marketing.
// Retorna leads ordenados por evento_id depois por criado_em (blocos por evento).
export async function fetchLeadsEventos(eventoIds, signal) {
  if (!isSupabaseMode() || !eventoIds?.length) return null;
  return trackPerf('fetchLeadsEventos', () =>
    withRetry(async () => {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const { data, error } = await supabase
        .from('leads')
        .select(LEADS_COLS)
        .in('evento_id', eventoIds)
        .eq('deletado', false)
        .order('evento_id')
        .order('criado_em')
        .abortSignal(signal);
      if (error) throw error;
      return data.map(leadFromDb);
    })
  ).catch((err) => {
    if (err.name === 'AbortError') return null;
    console.error('[rjnet] Falha ao buscar leads consolidados:', err.message || err);
    return null;
  });
}

// D-058: leads de um único mês de referência — mesmo modelo on-demand de
// fetchLeadsEvento, usado pelo vendedor em modo "Atividade do Mês".
export async function fetchLeadsMes(mesReferencia, signal) {
  if (!isSupabaseMode() || !mesReferencia) return null;
  return trackPerf('fetchLeadsMes', () =>
    withRetry(async () => {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const { data, error } = await supabase
        .from('leads')
        .select(LEADS_COLS)
        .eq('mes_referencia', mesReferencia)
        .eq('deletado', false)
        .order('criado_em')
        .abortSignal(signal);
      if (error) throw error;
      return data.map(leadFromDb);
    })
  ).catch((err) => {
    if (err.name === 'AbortError') return null;
    console.error('[rjnet] Falha ao buscar leads do mês:', err.message || err);
    return null;
  });
}

// D-058: leads de múltiplos meses — usado pela exportação consolidada do marketing.
export async function fetchLeadsMeses(mesesReferencia, signal) {
  if (!isSupabaseMode() || !mesesReferencia?.length) return null;
  return trackPerf('fetchLeadsMeses', () =>
    withRetry(async () => {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const { data, error } = await supabase
        .from('leads')
        .select(LEADS_COLS)
        .in('mes_referencia', mesesReferencia)
        .eq('deletado', false)
        .order('mes_referencia')
        .order('criado_em')
        .abortSignal(signal);
      if (error) throw error;
      return data.map(leadFromDb);
    })
  ).catch((err) => {
    if (err.name === 'AbortError') return null;
    console.error('[rjnet] Falha ao buscar leads mensais consolidados:', err.message || err);
    return null;
  });
}

// Form Builder: leitura pública (anon) de um formulário ativo pelo slug —
// usada pela página pública, sem sessão nenhuma. RLS restringe a
// `ativo = true` (migracao-form-builder.sql).
export async function fetchFormularioPublico(slug) {
  if (!isSupabaseMode() || !slug) return null;
  const { data, error } = await supabase
    .from('formularios')
    .select('id,nome,slug,campos,campos_obrigatorios,campos_personalizados_ids,campos_personalizados_obrigatorios,ativo')
    .eq('slug', slug)
    .eq('ativo', true)
    .maybeSingle();
  if (error || !data) return null;
  return formularioFromDb(data);
}

// Form Builder: labels dos campos personalizados referenciados por um
// formulário — leitura pública (anon), só ativo=true (mesmo padrão de
// fetchFormularioPublico). Usado pela página pública pra saber o rótulo
// de cada campo personalizado na hora de renderizar.
export async function fetchCamposPersonalizadosPublico(ids) {
  if (!isSupabaseMode() || !ids?.length) return [];
  const { data, error } = await supabase
    .from('campos_personalizados')
    .select('id,label,key,ativo')
    .in('id', ids)
    .eq('ativo', true);
  if (error || !data) return [];
  return data.map(campoPersonalizadoFromDb);
}

// Simulador: leitura pública (anon) de uma campanha ativa pelo slug —
// mesmo padrão de fetchFormularioPublico. RLS restringe a `ativo = true`
// (migracao-simulador.sql).
export async function fetchSimuladorPublico(slug) {
  if (!isSupabaseMode() || !slug) return null;
  const { data, error } = await supabase
    .from('simuladores')
    .select('id,nome,slug,tipo,campanha,versao_perguntas,ativo')
    .eq('slug', slug)
    .eq('ativo', true)
    .maybeSingle();
  if (error || !data) return null;
  return simuladorFromDb(data);
}

// Distribuição: qualquer lead "frio" (sem vendedor ainda), não importa a
// origem (QR Code, Form Builder, futuros canais) — generaliza
// fetchLeadsQrCode para a fila de distribuição do marketing/comercial.
export async function fetchLeadsSemVendedor(signal) {
  if (!isSupabaseMode()) return null;
  return trackPerf('fetchLeadsSemVendedor', () =>
    withRetry(async () => {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const { data, error } = await supabase
        .from('leads')
        .select(LEADS_COLS)
        .not('origem', 'is', null)
        .eq('deletado', false)
        .order('criado_em', { ascending: false })
        .abortSignal(signal);
      if (error) throw error;
      return data.map(leadFromDb);
    })
  ).catch((err) => {
    if (err.name === 'AbortError') return null;
    console.error('[rjnet] Falha ao buscar leads sem vendedor:', err.message || err);
    return null;
  });
}

// Captação digital: leads captados por canal público (QR Code, Form
// Builder, Simulador) — não têm evento_id nem mes_referencia (não são um
// contexto operacional, só atribuição), então não cabem em
// fetchLeadsEvento/fetchLeadsMes. RLS decide o que cada papel enxerga:
// marketing/comercial veem todos (inclusive sem vendedor_id, para a fila
// de distribuição); vendedor só vê os já distribuídos a alguém.
// (Nome mantido por compatibilidade histórica — o contexto "QR Code" do
// VendedorApp passou a cobrir todas as origens digitais no Simulador.)
export async function fetchLeadsQrCode(signal) {
  if (!isSupabaseMode()) return null;
  return trackPerf('fetchLeadsQrCode', () =>
    withRetry(async () => {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const { data, error } = await supabase
        .from('leads')
        .select(LEADS_COLS)
        .in('origem', ['qrcode', 'formulario', 'simulador'])
        .eq('deletado', false)
        .order('criado_em', { ascending: false })
        .abortSignal(signal);
      if (error) throw error;
      return data.map(leadFromDb);
    })
  ).catch((err) => {
    if (err.name === 'AbortError') return null;
    console.error('[rjnet] Falha ao buscar leads de QR Code:', err.message || err);
    return null;
  });
}

// D-057: quais ofertas já foram "enviadas" (clicadas) em um evento — mesmo
// modelo on-demand de fetchLeadsEvento; buscado sempre junto com os leads.
export async function fetchOfertasEnviadasEvento(eventoId, signal) {
  if (!isSupabaseMode() || !eventoId) return null;
  return trackPerf('fetchOfertasEnviadasEvento', () =>
    withRetry(async () => {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const { data, error } = await supabase
        .from('oferta_envios')
        .select('lead_id,servico')
        .eq('evento_id', eventoId)
        .abortSignal(signal);
      if (error) throw error;
      return data.map((r) => ({ leadId: r.lead_id, servico: r.servico }));
    })
  ).catch((err) => {
    if (err.name === 'AbortError') return null;
    console.error('[rjnet] Falha ao buscar ofertas enviadas:', err.message || err);
    return null;
  });
}

// D-058: mesmo indicador de "enviada" (clique), só que para leads de mês.
export async function fetchOfertasEnviadasMes(mesReferencia, signal) {
  if (!isSupabaseMode() || !mesReferencia) return null;
  return trackPerf('fetchOfertasEnviadasMes', () =>
    withRetry(async () => {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const { data, error } = await supabase
        .from('oferta_envios')
        .select('lead_id,servico')
        .eq('mes_referencia', mesReferencia)
        .abortSignal(signal);
      if (error) throw error;
      return data.map((r) => ({ leadId: r.lead_id, servico: r.servico }));
    })
  ).catch((err) => {
    if (err.name === 'AbortError') return null;
    console.error('[rjnet] Falha ao buscar ofertas enviadas do mês:', err.message || err);
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

// D-058: mesmo placar com cache de 30s, só que por mês de referência.
export async function rankingMes(mesReferencia) {
  if (!isSupabaseMode() || !mesReferencia) return null;

  const cacheKey = `ranking_mes:${mesReferencia}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  return trackPerf(`rankingMes(${mesReferencia})`, () =>
    withRetry(async () => {
      const { data, error } = await supabase.rpc('ranking_mes', { mref: mesReferencia });
      if (error) throw error;
      return data.map((r) => ({ nome: r.vendedor_nome, total: Number(r.total) }));
    }, { maxAttempts: 2, baseDelayMs: 500 })
  ).then((result) => {
    cache.set(cacheKey, result, 30_000); // TTL 30 s
    return result;
  }).catch((err) => {
    console.error('[rjnet] Falha ao carregar o placar do mês:', err.message);
    return null;
  });
}

// Invalida o cache do placar de um mês (chamar após salvar lead)
export function invalidarRankingMes(mesReferencia) {
  cache.invalidate(`ranking_mes:${mesReferencia}`);
}

/* ─── Escrita (fire-and-forget com log de erro e retry) ──────────── */

function exec(promise, acao, onFail, onSuccess, meta = {}) {
  if (!isSupabaseMode()) {
    if (onSuccess) onSuccess();
    return;
  }
  // Retry uma vez após 1 s em caso de falha transitória; timeout de 15 s por tentativa
  const tentativa = (p) => Promise.race([
    p.then(({ error }) => { if (error) throw error; }),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout após 15s')), 15000)),
  ]);
  tentativa(promise)
    .then(() => { if (onSuccess) onSuccess(); })
    .catch(() =>
      new Promise((r) => setTimeout(r, 1000))
        .then(() => tentativa(promise))
        .then(() => { if (onSuccess) onSuccess(); })
        .catch((err) => {
          console.error(`[rjnet] Supabase: falha ao ${acao}:`, err.message);
          window.dispatchEvent(new CustomEvent('rjnet:sync-error', { detail: { acao, message: err.message } }));
          logActivity({ type: 'sync_error', level: 'error', detail: `${acao}: ${err.message}`, ...meta });
          if (onFail) onFail();
        })
    );
}

export const db = {
  saveMaterial: (m) => exec(supabase?.from('materiais').upsert(materialToDb(m)), 'salvar material'),
  saveVendedor: (v) => exec(supabase?.from('vendedores').upsert(vendedorToDb(v)), 'salvar vendedor'),
  saveEvento:   (e) => exec(supabase?.from('eventos').upsert(eventoToDb(e)), 'salvar evento'),
  saveLead: (l, onSuccess) => {
    const dbData = leadToDb(l);
    exec(
      supabase?.from('leads').upsert(dbData),
      'salvar lead',
      () => addToQueue({ type: 'saveLead', data: dbData }),
      onSuccess,
      { vendedor: l.vendedorNome, eventoId: l.eventoId, mesReferencia: l.mesReferencia },
    );
  },
  removeMaterial: (id) => exec(supabase?.from('materiais').delete().eq('id', id), 'remover material'),
  removeEvento: (id) => exec(supabase?.from('eventos').delete().eq('id', id), 'remover evento'),
  // PA-07/LGPD: hard delete pelo vendedor (leads_delete policy, sem with_check).
  // Auditoria registrada pelo trigger audit_leads (AFTER DELETE → audit_log).
  removeLead: (id, onFail, onSuccess, meta) => exec(
    supabase?.from('leads').delete().eq('id', id),
    'remover lead',
    onFail,
    onSuccess,
    meta,
  ),

  // PA-06/LGPD: registra exportação CSV na tabela de auditoria (fire-and-forget; nunca bloqueia o download)
  registrarExportacao: async ({ usuarioId, usuarioNome, usuarioEmail, filtros, totalRegistros }) => {
    if (!supabase) return;
    try {
      await supabase.from('audit_exportacoes').insert({
        usuario_id:      usuarioId  || null,
        usuario_nome:    usuarioNome  || null,
        usuario_email:   usuarioEmail || null,
        acao:            'export_csv_leads',
        filtros:         filtros || null,
        total_registros: totalRegistros ?? null,
      });
    } catch (err) {
      console.warn('[rjnet/PA-06] Falha ao registrar exportação:', err);
    }
  },

  // D-057: única exceção ao padrão 100%-síncrono de db.save* — o upload no
  // Storage precisa terminar antes do upsert (para saber o path final).
  saveOferta: async ({ servico, copy, file, oldImagemPath }, onSuccess, onFail) => {
    if (!isSupabaseMode()) { if (onSuccess) onSuccess(); return; }
    let imagemPath = oldImagemPath ?? null;
    try {
      if (file) {
        const ext = file.name.split('.').pop().toLowerCase();
        const path = `${servico}.${ext}`;
        if (oldImagemPath && oldImagemPath !== path) {
          await supabase.storage.from('ofertas').remove([oldImagemPath]).catch(() => {});
        }
        const { error: upErr } = await supabase.storage.from('ofertas').upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        imagemPath = path;
      }
      exec(
        supabase.from('ofertas').upsert(ofertaToDb({ servico, copy, imagemPath })),
        'salvar oferta',
        onFail,
        onSuccess,
      );
    } catch (err) {
      console.error('[rjnet] Falha ao enviar imagem da oferta:', err.message);
      if (onFail) onFail(err.message);
    }
  },
  removeOferta: (servico) => exec(supabase?.from('ofertas').delete().eq('servico', servico), 'remover oferta'),

  // Form Builder: mesmo padrão simples de saveEvento/saveOferta — sem
  // upload nem passo assíncrono extra (diferente de saveOferta/imagem).
  saveFormulario: (f) => exec(supabase?.from('formularios').upsert(formularioToDb(f)), 'salvar formulário'),
  removeFormulario: (id) => exec(supabase?.from('formularios').delete().eq('id', id), 'remover formulário'),

  // Campo personalizado: sempre texto livre — ver comentário em campoPersonalizadoFromDb.
  saveCampoPersonalizado: (c) => exec(supabase?.from('campos_personalizados').upsert(campoPersonalizadoToDb(c)), 'salvar campo personalizado'),
  removeCampoPersonalizado: (id) => exec(supabase?.from('campos_personalizados').delete().eq('id', id), 'remover campo personalizado'),

  // Simulador: mesmo padrão simples de saveFormulario.
  saveSimulador: (s) => exec(supabase?.from('simuladores').upsert(simuladorToDb(s)), 'salvar simulador'),
  removeSimulador: (id) => exec(supabase?.from('simuladores').delete().eq('id', id), 'remover simulador'),

  // D-057: indicador de que o vendedor abriu o WhatsApp com a oferta pronta —
  // NÃO é confirmação de entrega/leitura (wa.me não expõe esse dado).
  // D-058: eventoId/mesReferencia são mutuamente exclusivos, como em leads.
  registrarOfertaEnviada: async ({ leadId, eventoId, mesReferencia, servico, vendedorId, vendedorNome }) => {
    if (!supabase) return;
    try {
      await supabase.from('oferta_envios').insert({
        lead_id: leadId, evento_id: eventoId || null, mes_referencia: mesReferencia || null, servico,
        vendedor_id: vendedorId || null, vendedor_nome: vendedorNome || null,
      });
    } catch (err) {
      console.warn('[rjnet] Falha ao registrar envio de oferta:', err);
    }
  },
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
    // PA-12/LGPD: detecta desafio MFA — retorna indicador para a UI exibir campo TOTP
    if (data?.session === null && data?.user === null) {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.data?.totp?.length > 0) {
        const { data: challenge, error: chalErr } = await supabase.auth.mfa.challenge({ factorId: factors.data.totp[0].id });
        if (chalErr) throw new Error(chalErr.message);
        return { mfaRequired: true, factorId: factors.data.totp[0].id, challengeId: challenge.id };
      }
    }
    const perfil = await auth.getPerfil(data.user.id);
    if (!perfil || !perfil.ativo) {
      await supabase.auth.signOut();
      throw new Error('Seu acesso ainda não foi ativado. Fale com o marketing.');
    }
    return { role: perfil.papel, vendedorNome: perfil.nome, userId: perfil.id, email: perfil.email };
  },

  // PA-12/LGPD: verifica código TOTP do MFA e retorna sessão completa
  async verifyMfa(factorId, challengeId, codigo) {
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code: codigo });
    if (error) throw new Error('Código inválido ou expirado.');
    const { data } = await supabase.auth.getSession();
    const user = data?.session?.user;
    if (!user) throw new Error('Sessão MFA não estabelecida.');
    const perfil = await auth.getPerfil(user.id);
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
      // Envia email de redefinição de senha para o novo endereço,
      // permitindo que o usuário defina sua própria senha ao trocar o login.
      await supabase.auth.resetPasswordForEmail(patch.email, {
        redirectTo: `${window.location.origin}/`,
      });
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
  resetSenha: (email) => supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/`,
  }),

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
      // debounce: várias mudanças seguidas geram um único refetch (D-038/QW-005)
      clearTimeout(timer);
      timer = setTimeout(onChange, REALTIME_DEBOUNCE_MS);
    })
    .subscribe();
  return () => {
    clearTimeout(timer);
    supabase.removeChannel(channel);
  };
}
