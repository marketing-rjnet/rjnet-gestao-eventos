// Edge Function: atualizar-email-usuario
// Atualiza o e-mail de login em auth.users (requer service_role).
// Chamada apenas pelo marketing — valida que o solicitante tem papel='marketing'.

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

    // Valida o token do solicitante (deve ser marketing ativo)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Não autorizado.' }, 401);

    const clienteSolicitante = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: perfil } = await clienteSolicitante
      .from('perfis')
      .select('papel, ativo')
      .eq('id', (await clienteSolicitante.auth.getUser()).data.user?.id)
      .maybeSingle();

    if (!perfil || !perfil.ativo || perfil.papel !== 'marketing') {
      return json({ error: 'Acesso negado. Apenas o marketing pode executar esta ação.' }, 403);
    }

    // Lê o corpo da requisição
    const { userId, email } = await req.json();
    if (!userId || !email) return json({ error: 'userId e email são obrigatórios.' }, 400);

    // Atualiza auth.users com service_role
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: authError } = await admin.auth.admin.updateUserById(userId, { email });
    if (authError) return json({ error: authError.message }, 400);

    // Mantém perfis.email sincronizado
    await admin.from('perfis').update({ email }).eq('id', userId);

    return json({ ok: true });
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
