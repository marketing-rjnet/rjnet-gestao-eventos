// Edge Function: captar-lead-qrcode
// Porta pública de Captação: recebe o formulário que o próprio titular
// preenche ao escanear um QR Code (sem sessão autenticada). Valida e
// sanitiza no servidor, exige consentimento LGPD, e grava o Lead com
// service_role — vendedor_id/vendedor_nome nascem nulos (Distribuição
// é feita depois, manualmente, por marketing/comercial).
//
// Mesmo LeadInput conceitual do restante do sistema: nome, telefone,
// serviço de interesse são obrigatórios; cpf/endereço são opcionais;
// origem/qrCodeId identificam o canal. Nenhuma regra de negócio nova —
// as mesmas validações do formulário do vendedor, replicadas aqui
// porque este conector roda fora do app (sem sessão autenticada).
//
// CORS restrito ao domínio da aplicação (mesmo padrão de
// atualizar-email-usuario): configurar o secret CORS_ALLOWED_ORIGINS no
// Supabase Dashboard → Settings → Edge Functions → Secrets.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SERVICOS_VALIDOS = new Set([
  'internet_residencial',
  'internet_empresarial',
  'rjnet_movel',
  'streamings',
  'outro',
]);

function getAllowedOrigins(): string[] {
  const raw = Deno.env.get('CORS_ALLOWED_ORIGINS') ?? '';
  const fromEnv = raw.split(',').map((o) => o.trim()).filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : ['http://localhost:3000'];
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = getAllowedOrigins();
  const effectiveOrigin = allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': effectiveOrigin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  };
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

// Mesmas regras de sanitizeText()/validarTelefone() do frontend
// (src/lib/security.js, src/utils/masks.js) — duplicadas aqui porque
// este conector roda em Deno, fora do bundle do app.
function sanitizeText(str: unknown, maxLength = 255): string {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLength);
}

function validarTelefone(tel: unknown): boolean {
  if (typeof tel !== 'string') return false;
  const d = tel.replace(/\D/g, '');
  return d.length >= 10 && d.length <= 11;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, corsHeaders);

  try {
    const body = await req.json();

    const nome = sanitizeText(body.nome, 120);
    const telefone = typeof body.telefone === 'string' ? body.telefone.trim() : '';
    const cpf = sanitizeText(body.cpf, 14);
    const endereco = sanitizeText(body.endereco, 200);
    const qrCodeId = sanitizeText(body.qrCodeId, 80);
    const qrCodeLabel = sanitizeText(body.qrCodeLabel, 120);
    const servicoInteresse = Array.isArray(body.servicoInteresse)
      ? body.servicoInteresse.filter((s: unknown) => typeof s === 'string' && SERVICOS_VALIDOS.has(s))
      : [];

    if (!nome) return json({ error: 'Nome é obrigatório.' }, 400, corsHeaders);
    if (!validarTelefone(telefone)) return json({ error: 'Telefone inválido. Informe DDD + número (10 ou 11 dígitos).' }, 400, corsHeaders);
    if (servicoInteresse.length === 0) return json({ error: 'Selecione ao menos um serviço de interesse.' }, 400, corsHeaders);
    if (!qrCodeId) return json({ error: 'QR Code inválido.' }, 400, corsHeaders);
    if (body.consentimentoColetado !== true) return json({ error: 'É necessário confirmar o consentimento para uso dos dados.' }, 400, corsHeaders);

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const agora = new Date().toISOString();
    const { error } = await admin.from('leads').insert({
      id: `l-qr-${crypto.randomUUID()}`,
      evento_id: null,
      mes_referencia: null,
      vendedor_id: null,
      vendedor_nome: null,
      origem: 'qrcode',
      qr_code_id: qrCodeId,
      qr_code_label: qrCodeLabel || null,
      nome,
      telefone,
      cpf: cpf || null,
      endereco: endereco || null,
      servico_interesse: JSON.stringify(servicoInteresse),
      temperatura: 'morno',
      observacao: null,
      ja_cliente_rjnet: false,
      criado_em: agora,
      consentimento_coletado: true,
      consentimento_em: agora,
      versao_termo: 'qrcode-v1',
      deletado: false,
    });

    if (error) {
      console.error('[rjnet:edge] Falha ao gravar lead de QR Code:', error);
      return json({ error: 'Não foi possível registrar seus dados agora. Tente novamente em instantes.' }, 500, corsHeaders);
    }

    return json({ ok: true }, 200, corsHeaders);
  } catch (err) {
    console.error('[rjnet:edge] Erro não tratado em captar-lead-qrcode:', err);
    return json({ error: 'Erro interno do servidor. Tente novamente em instantes.' }, 500, getCorsHeaders(req));
  }
});
