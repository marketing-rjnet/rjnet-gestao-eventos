// Camada de dados Supabase — converte entre o formato do app (camelCase)
// e as colunas do banco (snake_case). Schema em supabase/schema.sql e
// autenticação/papéis em supabase/migracao-auth.sql.
import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseEnabled, supabaseConfig } from './supabase';

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
      supabase.from('leads').select('*').order('criado_em'),
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

/* ─── Autenticação (Supabase Auth + perfis por papel) ────────────── */

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
    const { data: { session } } = await supabase.auth.getSession();
    const fnUrl = `${supabaseConfig.url}/functions/v1/atualizar-email-usuario`;
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey': supabaseConfig.anonKey,
      },
      body: JSON.stringify({ action: 'criar', nome, email, senha, papel }),
    });
    const body = await res.json();
    if (!res.ok) {
      const msg = /already registered/i.test(body.error || '')
        ? 'Já existe um usuário com esse e-mail.'
        : body.error || 'Não foi possível criar o usuário.';
      throw new Error(msg);
    }
    return body.userId;
  },

  async atualizarPerfil(userId, patch) {
    // E-mail vai pela Edge Function (requer service_role para atualizar auth.users)
    if (patch.email !== undefined) {
      const { data: { session } } = await supabase.auth.getSession();
      const fnUrl = `${supabaseConfig.url}/functions/v1/atualizar-email-usuario`;
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': supabaseConfig.anonKey,
        },
        body: JSON.stringify({ action: 'atualizar-email', userId, email: patch.email }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Falha ao atualizar e-mail.');
      // Remove email do patch para não duplicar a escrita em perfis (a função já fez)
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
    const { error } = await supabase.from('perfis').delete().eq('id', userId);
    if (error) throw new Error('Falha ao excluir usuário: ' + error.message);
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
