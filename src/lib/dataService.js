// Camada de dados Supabase — converte entre o formato do app (camelCase)
// e as colunas do banco (snake_case). Schema em supabase/schema.sql.
import { supabase, supabaseEnabled } from './supabase';

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
  nome: r.nome, telefone: r.telefone ?? "", cpf: r.cpf ?? "",
  endereco: r.endereco ?? "", servicoInteresse: r.servico_interesse,
  temperatura: r.temperatura, observacao: r.observacao ?? "",
  jaClienteRjnet: r.ja_cliente_rjnet ?? false,
  criadoEm: r.criado_em,
});
const leadToDb = (l) => ({
  id: l.id, evento_id: l.eventoId, vendedor_nome: l.vendedorNome ?? null,
  nome: l.nome, telefone: l.telefone || null, cpf: l.cpf || null,
  endereco: l.endereco || null, servico_interesse: l.servicoInteresse ?? null,
  temperatura: l.temperatura ?? 'morno', observacao: l.observacao || null,
  ja_cliente_rjnet: l.jaClienteRjnet ?? false,
  criado_em: l.criadoEm || new Date().toISOString(),
});

/* ─── Leitura ────────────────────────────────────────────────────── */

// Busca as 4 tabelas de uma vez. Retorna null se o Supabase estiver
// desativado ou indisponível (o app segue com o cache local).
export async function fetchAll() {
  if (!supabaseEnabled) return null;
  try {
    const [materiais, vendedores, eventos, leads] = await Promise.all([
      supabase.from('materiais').select('*').order('nome'),
      supabase.from('vendedores').select('*').order('nome'),
      supabase.from('eventos').select('*').order('data_inicio'),
      supabase.from('leads').select('*').order('criado_em'),
    ]);
    const erro = materiais.error || vendedores.error || eventos.error || leads.error;
    if (erro) throw erro;
    return {
      materiais: materiais.data.map(materialFromDb),
      vendedores: vendedores.data.map(vendedorFromDb),
      eventos: eventos.data.map(eventoFromDb),
      leads: leads.data.map(leadFromDb),
    };
  } catch (err) {
    console.error('[rjnet] Falha ao carregar dados do Supabase:', err.message || err);
    return null;
  }
}

/* ─── Escrita (fire-and-forget com log de erro) ──────────────────── */

function exec(promise, acao) {
  if (!supabaseEnabled) return;
  promise.then(({ error }) => {
    if (error) {
      console.error(`[rjnet] Supabase: falha ao ${acao}:`, error.message);
      alert(`⚠️ Não foi possível sincronizar com o banco (${acao}). Os dados foram salvos localmente — verifique a conexão.`);
    }
  });
}

export const db = {
  saveMaterial: (m) => exec(supabase?.from('materiais').upsert(materialToDb(m)), 'salvar material'),
  saveVendedor: (v) => exec(supabase?.from('vendedores').upsert(vendedorToDb(v)), 'salvar vendedor'),
  saveEvento:   (e) => exec(supabase?.from('eventos').upsert(eventoToDb(e)), 'salvar evento'),
  saveLead:     (l) => exec(supabase?.from('leads').upsert(leadToDb(l)), 'salvar lead'),
  removeEvento: (id) => exec(supabase?.from('eventos').delete().eq('id', id), 'remover evento'),
  removeLead:   (id) => exec(supabase?.from('leads').delete().eq('id', id), 'remover lead'),
};

/* ─── Realtime — sincronização entre dispositivos ────────────────── */

// Chama onChange sempre que qualquer tabela mudar em outro dispositivo.
// Retorna função de cleanup para usar em useEffect.
export function subscribeChanges(onChange) {
  if (!supabaseEnabled) return () => {};
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
