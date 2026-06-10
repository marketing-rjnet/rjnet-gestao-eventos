// Edge Function: atualizar-email-usuario
// Gerencia usuários via Admin API (service_role) — sem rate limit de e-mail.
// Ações suportadas: 'criar' e 'atualizar-email'.
// Só aceita chamadas de usuários com papel='marketing' ativo.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Não autorizado.' }, 401);

    // Valida que o solicitante é marketing ativo
    const clienteSolicitante = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await clienteSolicitante.auth.getUser();
    const { data: perfil } = await clienteSolicitante
      .from('perfis').select('papel, ativo').eq('id', user?.id).maybeSingle();

    if (!perfil || !perfil.ativo || perfil.papel !== 'marketing') {
      return json({ error: 'Acesso negado. Apenas o marketing pode executar esta ação.' }, 403);
    }

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json();

    // ── Criar usuário ──────────────────────────────────────────────
    if (body.action === 'criar') {
      const { nome, email, senha, papel } = body;
      if (!nome || !email || !senha || !papel) {
        return json({ error: 'nome, email, senha e papel são obrigatórios.' }, 400);
      }

      const { data, error: criarError } = await admin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: { nome },
      });
      if (criarError) return json({ error: criarError.message }, 400);

      const userId = data.user.id;
      await admin.from('perfis').upsert({ id: userId, email, nome, papel, ativo: true });

      return json({ ok: true, userId });
    }

    // ── Atualizar e-mail ───────────────────────────────────────────
    if (body.action === 'atualizar-email') {
      const { userId, email } = body;
      if (!userId || !email) return json({ error: 'userId e email são obrigatórios.' }, 400);

      const { error: authError } = await admin.auth.admin.updateUserById(userId, { email });
      if (authError) return json({ error: authError.message }, 400);

      await admin.from('perfis').update({ email }).eq('id', userId);
      return json({ ok: true });
    }

    return json({ error: 'Ação inválida.' }, 400);

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
