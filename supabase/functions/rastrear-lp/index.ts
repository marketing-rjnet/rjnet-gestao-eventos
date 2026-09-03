// Edge Function: rastrear-lp (D-104)
// Porta pública de TRACKING das Landing Pages: recebe a sessão de visita
// (anônima) + um lote de eventos internos do SDK (public/rjnet-lp.js) e
// grava em lp_sessions/lp_events com service_role. Nunca cria Lead —
// isso é papel exclusivo de submeter-lp (validação estrita, rate limit,
// consentimento). Tracking é secundário à conversão: qualquer rejeição
// aqui é silenciosa pro visitante (o SDK engole o erro) e nunca impede
// formulário/WhatsApp.
//
// Payload:
//   { slug, session: { id, url, referrer, utm: {...}, device },
//     events: [{ nome, props?, leadId? }] }
//
// Regras:
//   * slug → LP com status='ativa' (senão 404, nada gravado)
//   * session.id precisa ser UUID (gerado no cliente); upsert idempotente
//   * `nome` só da whitelist EVENTOS_LP (espelho de src/lib/aquisicao.js)
//   * máx. 20 eventos por request; props achatadas (≤10 chaves, valores
//     curtos); teto de eventos por sessão (anti-poluição)
//   * leadId só é aceito se o lead existir E pertencer à MESMA LP —
//     senão vira null (nunca confia no cliente pra vincular lead)
//   * NÃO grava IP nem user-agent (minimização LGPD) — só `device`
//   * campanha_padrao da LP preenche utm_campaign de visita sem UTM
//
// Aceita Content-Type text/plain (navigator.sendBeacon) além de JSON.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, json, sanitizeText, containsLink } from '../_shared/captacao.ts';

// Espelho de NOMES_EVENTOS_LP em src/lib/aquisicao.js. lead_created é
// exclusivo do servidor (submeter-lp) — o cliente não pode forjá-lo.
const EVENTOS_CLIENTE = ['page_view', 'cta_click', 'form_start', 'form_submit', 'whatsapp_click'];
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
const DEVICES = ['mobile', 'desktop', 'tablet'];
const MAX_EVENTOS_POR_REQUEST = 20;
const MAX_EVENTOS_POR_SESSAO = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizarUtm(bruto: unknown): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  const b = (bruto && typeof bruto === 'object') ? bruto as Record<string, unknown> : {};
  for (const key of UTM_KEYS) {
    const v = sanitizeText(b[key], 120);
    out[key] = v && !containsLink(v) ? v : null;
  }
  return out;
}

function sanitizarUrl(v: unknown, max = 500): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().slice(0, max);
  return /^https?:\/\//i.test(s) ? s : null;
}

// Props achatadas: só primitivos curtos, no máximo 10 chaves — nunca
// objetos aninhados/HTML (vai pra jsonb e pode aparecer na tela de Eventos).
function sanitizarProps(bruto: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!bruto || typeof bruto !== 'object') return out;
  let n = 0;
  for (const [k, v] of Object.entries(bruto as Record<string, unknown>)) {
    if (n >= 10) break;
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(k)) continue;
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string') { const s = sanitizeText(v, 120); if (s) out[k] = s; }
    else continue;
    n++;
  }
  return out;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, corsHeaders);

  try {
    // sendBeacon manda text/plain — parse manual em vez de req.json()
    let body: Record<string, unknown>;
    try { body = JSON.parse(await req.text()); } catch { return json({ error: 'Payload inválido.' }, 400, corsHeaders); }

    const slug = sanitizeText(body.slug, 80);
    const session = (body.session && typeof body.session === 'object') ? body.session as Record<string, unknown> : null;
    const sessionId = typeof session?.id === 'string' && UUID_RE.test(session.id) ? session.id.toLowerCase() : null;
    const eventosBrutos = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTOS_POR_REQUEST) : [];

    if (!slug || !sessionId) return json({ error: 'Sessão inválida.' }, 400, corsHeaders);

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: lp, error: lpErro } = await admin
      .from('landing_pages')
      .select('id,status,campanha_padrao')
      .eq('slug', slug)
      .maybeSingle();
    if (lpErro || !lp || lp.status !== 'ativa') {
      console.warn('[rjnet:edge:lp] evento rejeitado — LP inexistente/inativa:', slug);
      return json({ error: 'Landing page não encontrada ou inativa.' }, 404, corsHeaders);
    }

    // ─── Sessão: upsert idempotente (o SDK reenvia em todo lote) ───
    const utm = sanitizarUtm(session!.utm);
    if (!utm.utm_campaign && lp.campanha_padrao) utm.utm_campaign = lp.campanha_padrao;
    const device = DEVICES.includes(String(session!.device)) ? String(session!.device) : null;

    const { data: existente } = await admin.from('lp_sessions').select('id,landing_page_id').eq('id', sessionId).maybeSingle();
    if (existente && existente.landing_page_id !== lp.id) {
      // id de sessão reaproveitado em outra LP — rejeita sem gravar
      return json({ error: 'Sessão inválida.' }, 400, corsHeaders);
    }
    if (!existente) {
      const { error: sesErro } = await admin.from('lp_sessions').insert({
        id: sessionId,
        landing_page_id: lp.id,
        landing_page_url: sanitizarUrl(session!.url),
        referrer: sanitizarUrl(session!.referrer, 300),
        ...utm,
        device,
      });
      if (sesErro && !/duplicate|unique/i.test(sesErro.message)) {
        console.error('[rjnet:edge:lp] falha ao gravar sessão:', sesErro);
        return json({ error: 'Não foi possível registrar a sessão.' }, 500, corsHeaders);
      }
    } else {
      await admin.from('lp_sessions').update({ atualizado_em: new Date().toISOString() }).eq('id', sessionId);
    }

    if (eventosBrutos.length === 0) return json({ ok: true, recebidos: 0 }, 200, corsHeaders);

    // ─── Teto por sessão (anti-poluição sem IP) ────────────────────
    const { count: jaGravados } = await admin
      .from('lp_events').select('id', { count: 'exact', head: true }).eq('session_id', sessionId);
    if ((jaGravados ?? 0) >= MAX_EVENTOS_POR_SESSAO) {
      console.warn('[rjnet:edge:lp] evento rejeitado — teto por sessão atingido:', sessionId);
      return json({ ok: false, error: 'Limite de eventos da sessão atingido.' }, 429, corsHeaders);
    }

    // ─── Vínculo com lead: só se existir e for DESTA LP ────────────
    const leadIdsPedidos = [...new Set(eventosBrutos
      .map((e) => (e && typeof e === 'object') ? sanitizeText((e as Record<string, unknown>).leadId, 80) : '')
      .filter(Boolean))];
    const leadsValidos = new Set<string>();
    if (leadIdsPedidos.length > 0) {
      const { data: leads } = await admin
        .from('leads').select('id').in('id', leadIdsPedidos).eq('landing_page_id', lp.id).eq('deletado', false);
      (leads || []).forEach((l) => leadsValidos.add(l.id));
    }

    const linhas: Record<string, unknown>[] = [];
    let rejeitados = 0;
    for (const bruto of eventosBrutos) {
      const e = (bruto && typeof bruto === 'object') ? bruto as Record<string, unknown> : {};
      const nome = typeof e.nome === 'string' ? e.nome : '';
      if (!EVENTOS_CLIENTE.includes(nome)) { rejeitados++; continue; }
      const leadId = sanitizeText(e.leadId, 80);
      linhas.push({
        landing_page_id: lp.id,
        session_id: sessionId,
        lead_id: leadId && leadsValidos.has(leadId) ? leadId : null,
        nome,
        propriedades: sanitizarProps(e.props),
      });
    }
    if (rejeitados > 0) console.warn(`[rjnet:edge:lp] ${rejeitados} evento(s) rejeitado(s) por nome fora da whitelist (slug=${slug})`);

    if (linhas.length > 0) {
      const { error: evErro } = await admin.from('lp_events').insert(linhas);
      if (evErro) {
        console.error('[rjnet:edge:lp] falha ao gravar eventos:', evErro);
        return json({ error: 'Não foi possível registrar os eventos.' }, 500, corsHeaders);
      }
    }

    return json({ ok: true, recebidos: linhas.length, rejeitados }, 200, corsHeaders);
  } catch (err) {
    console.error('[rjnet:edge:lp] erro não tratado em rastrear-lp:', err);
    return json({ error: 'Erro interno do servidor.' }, 500, getCorsHeaders(req));
  }
});
