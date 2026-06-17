// Edge Function: atualizar-email-usuario
// Gerencia usuários via Admin API (service_role) — sem rate limit de e-mail.
// Ações suportadas: 'criar', 'atualizar-email' e 'excluir'.
// Só aceita chamadas de usuários com papel='marketing' ativo.
//
// PA-03/LGPD: CORS restrito ao domínio da aplicação (S-04).
//   Configurar secret CORS_ALLOWED_ORIGINS no Supabase Dashboard:
//   Settings → Edge Functions → Secrets → CORS_ALLOWED_ORIGINS
//   Valor: https://SEU_DOMINIO.vercel.app,http://localhost:3000
//
// PA-03/LGPD: Erro interno não expõe stack trace (S-05).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── CORS: origens permitidas ────────────────────────────────────────────────
// Lê da variável de ambiente CORS_ALLOWED_ORIGINS (separadas por vírgula).
// Fallback: apenas localhost:3000 (desenvolvimento).
function getAllowedOrigins(): string[] {
  const raw = Deno.env.get('CORS_ALLOWED_ORIGINS') ?? '';
  const fromEnv = raw.split(',').map((o) => o.trim()).filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : ['http://localhost:3000'];
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = getAllowedOrigins();
  // Reflete a origem requisitante apenas se estiver na lista permitida.
  // Caso contrário, usa a primeira origem configurada (nunca '*').
  const effectiveOrigin = allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': effectiveOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

// ─── Handler principal ───────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Não autorizado.' }, 401, corsHeaders);

    // Valida que o solicitante é marketing ativo
    const clienteSolicitante = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await clienteSolicitante.auth.getUser();
    const { data: perfil } = await clienteSolicitante
      .from('perfis').select('papel, ativo').eq('id', user?.id).maybeSingle();

    if (!perfil || !perfil.ativo || perfil.papel !== 'marketing') {
      return json({ error: 'Acesso negado. Apenas o marketing pode executar esta ação.' }, 403, corsHeaders);
    }

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json();

    // ── Criar usuário ──────────────────────────────────────────────
    if (body.action === 'criar') {
      const { nome, email, senha, papel } = body;
      if (!nome || !email || !senha || !papel) {
        return json({ error: 'nome, email, senha e papel são obrigatórios.' }, 400, corsHeaders);
      }

      const { data, error: criarError } = await admin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: { nome },
      });
      if (criarError) return json({ error: criarError.message }, 400, corsHeaders);

      const userId = data.user.id;
      await admin.from('perfis').upsert({ id: userId, email, nome, papel, ativo: true });

      return json({ ok: true, userId }, 200, corsHeaders);
    }

    // ── Atualizar e-mail ───────────────────────────────────────────
    if (body.action === 'atualizar-email') {
      const { userId, email } = body;
      if (!userId || !email) return json({ error: 'userId e email são obrigatórios.' }, 400, corsHeaders);

      const { error: authError } = await admin.auth.admin.updateUserById(userId, { email });
      if (authError) return json({ error: authError.message }, 400, corsHeaders);

      await admin.from('perfis').update({ email }).eq('id', userId);
      return json({ ok: true }, 200, corsHeaders);
    }

    // ── Excluir usuário ────────────────────────────────────────────
    if (body.action === 'excluir') {
      const { userId } = body;
      if (!userId) return json({ error: 'userId é obrigatório.' }, 400, corsHeaders);

      // Apaga do Auth (cascata remove perfis via FK on delete cascade)
      const { error: authError } = await admin.auth.admin.deleteUser(userId);
      if (authError) return json({ error: authError.message }, 400, corsHeaders);

      return json({ ok: true }, 200, corsHeaders);
    }

    return json({ error: 'Ação inválida.' }, 400, corsHeaders);

  } catch (err) {
    // PA-03/S-05: nunca expõe detalhes internos ao cliente
    console.error('[rjnet:edge] Erro não tratado em atualizar-email-usuario:', err);
    return json(
      { error: 'Erro interno do servidor. Contate o suporte.' },
      500,
      getCorsHeaders(req),
    );
  }
});

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
