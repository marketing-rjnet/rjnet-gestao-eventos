import { supabase, supabaseEnabled } from './supabase';
import { materialFromDb, vendedorFromDb, eventoFromDb, leadFromDb, perfilFromDb,
         materialToDb, vendedorToDb, eventoToDb, leadToDb } from './mappers';

/* ─── Leitura ────────────────────────────────────────────────────── */

// Busca as tabelas de uma vez. Retorna null se o Supabase estiver
// desativado ou indisponível (o app segue com o cache local).
// O RLS filtra no servidor: vendedor recebe apenas os próprios leads.
export async function fetchAll() {
  if (!supabaseEnabled) return null;
  try {
    const [materiais, perfis, eventos, leads] = await Promise.all([
      supabase.from('materiais').select('*').order('nome'),
      supabase.from('perfis').select('*').order('nome'),
      supabase.from('eventos').select('*').order('data_inicio'),
      // Exclui leads marcados como deletados (soft delete via protecao-dados.sql)
      supabase.from('leads').select('*').eq('deletado', false).order('criado_em'),
    ]);
    const erro = materiais.error || eventos.error || leads.error;
    if (erro) throw erro;

    // Antes da migração de auth a tabela perfis não existe — cai para a
    // tabela legada de vendedores
    let vendedores;
    if (perfis.error) {
      const legado = await supabase.from('vendedores').select('*').order('nome');
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
  } catch (err) {
    console.error('[rjnet] Falha ao carregar dados do Supabase:', err.message || err);
    return null;
  }
}

// Placar do evento (totais por vendedor) calculado no servidor — o vendedor
// vê a pontuação da equipe sem ter acesso aos leads dos colegas.
export async function rankingEvento(eventoId) {
  if (!supabaseEnabled || !eventoId) return null;
  const { data, error } = await supabase.rpc('ranking_evento', { eid: eventoId });
  if (error) {
    console.error('[rjnet] Falha ao carregar o placar:', error.message);
    return null;
  }
  return data.map((r) => ({ nome: r.vendedor_nome, total: Number(r.total) }));
}

/* ─── Escrita (fire-and-forget com log de erro) ──────────────────── */

function exec(promise, acao) {
  if (!supabaseEnabled) return;
  promise.then(({ error }) => {
    if (error) {
      console.error(`[rjnet] Supabase: falha ao ${acao}:`, error.message);
      // Dispara evento customizado para que a UI possa exibir o aviso sem alert()
      window.dispatchEvent(new CustomEvent('rjnet:sync-error', { detail: { acao, message: error.message } }));
    }
  });
}

export const db = {
  saveMaterial: (m) => exec(supabase?.from('materiais').upsert(materialToDb(m)), 'salvar material'),
  saveVendedor: (v) => exec(supabase?.from('vendedores').upsert(vendedorToDb(v)), 'salvar vendedor'),
  saveEvento:   (e) => exec(supabase?.from('eventos').upsert(eventoToDb(e)), 'salvar evento'),
  saveLead:     (l) => exec(supabase?.from('leads').upsert(leadToDb(l)), 'salvar lead'),
  removeEvento: (id) => exec(supabase?.from('eventos').delete().eq('id', id), 'remover evento'),
  removeLead:   (id) => exec(supabase?.from('leads').update({ deletado: true }).eq('id', id), 'remover lead'),
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
