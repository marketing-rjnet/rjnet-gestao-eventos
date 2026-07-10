// Miolo compartilhado das Edge Functions públicas de Captação
// (submeter-formulario, submeter-simulador): CORS restrito, sanitização,
// validadores e rate limit por IP. Extraído de submeter-formulario/index.ts
// para não duplicar essas regras a cada novo canal público (D-067).
//
// Mesmas regras de src/lib/security.js / src/utils/masks.js — duplicadas
// aqui porque este código roda em Deno, fora do bundle do app.

export function getAllowedOrigins(): string[] {
  const raw = Deno.env.get('CORS_ALLOWED_ORIGINS') ?? '';
  const fromEnv = raw.split(',').map((o) => o.trim()).filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : ['http://localhost:3000'];
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = getAllowedOrigins();
  const effectiveOrigin = allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': effectiveOrigin,
    // D-064: o frontend sempre envia apikey/authorization (exigidos pela
    // plataforma Supabase) — faltar aqui quebra com "Failed to fetch".
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  };
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

export function sanitizeText(str: unknown, maxLength = 255): string {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLength);
}

export function validarTelefone(tel: unknown): boolean {
  if (typeof tel !== 'string') return false;
  const d = tel.replace(/\D/g, '');
  return d.length >= 10 && d.length <= 11;
}

// Campos de texto livre público não deveriam conter link — vetor comum de
// spam/abuso em formulário sem sessão. Não é moderação de conteúdo em
// geral, só bloqueia URL (D-067).
export function containsLink(str: string): boolean {
  return /https?:\/\/|www\.|\.(com|net|org|br|io|co|me|xyz|info|link)\b/i.test(str);
}

export function getClientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (!fwd) return null;
  return fwd.split(',')[0].trim().slice(0, 45) || null;
}

// Rate limit simples por IP (D-067): reaproveita a própria tabela leads
// (sem tabela nova) contando quantos leads esse IP já gerou na janela
// recente. Retorna true quando o limite foi atingido (deve bloquear).
export const RATE_LIMIT_JANELA_MIN = 10;
export const RATE_LIMIT_MAX_SUBMISSOES = 5;

// deno-lint-ignore no-explicit-any
export async function atingiuRateLimit(admin: any, clientIp: string | null): Promise<boolean> {
  if (!clientIp) return false;
  const desde = new Date(Date.now() - RATE_LIMIT_JANELA_MIN * 60_000).toISOString();
  const { count, error } = await admin
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('origem_ip', clientIp)
    .gte('criado_em', desde);
  return !error && (count ?? 0) >= RATE_LIMIT_MAX_SUBMISSOES;
}
