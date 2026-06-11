import { supabase, supabaseConfig } from './supabase';
import { perfilFromDb } from './mappers';

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
    const { data: { session } } = await supabase.auth.getSession();
    const fnUrl = `${supabaseConfig.url}/functions/v1/atualizar-email-usuario`;
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey': supabaseConfig.anonKey,
      },
      body: JSON.stringify({ action: 'excluir', userId }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Falha ao excluir usuário.');
  },

  // E-mail de redefinição de senha (usa o e-mail transacional do Supabase)
  resetSenha: (email) => supabase.auth.resetPasswordForEmail(email),

  // Define a nova senha do usuário logado (fluxo de recuperação)
  async atualizarSenha(senha) {
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) throw new Error(error.message);
  },
};
