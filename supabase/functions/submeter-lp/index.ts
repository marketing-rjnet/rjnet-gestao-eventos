// Edge Function: submeter-lp (D-104)
// Porta pública de CONVERSÃO das Landing Pages: recebe o formulário que o
// próprio titular preenche na LP (sem sessão), valida/sanitiza no
// servidor, exige consentimento LGPD e grava o Lead no MESMO `leads` de
// sempre (origem='landing_page') com service_role. vendedor_id nasce
// nulo — cai na fila "Leads sem vendedor" (LeadsTab.jsx), mesma fila do
// Form Builder/Simulador.
//
// Atribuição: a fonte de verdade da UTM é a SESSÃO (lp_sessions,
// capturada no primeiro page_view pelo SDK); o `utm` do body é só
// fallback pra quando o tracking foi bloqueado (ad-blocker) e a sessão
// não existe. O lead sai com landing_page_id + lp_session_id + utm.
//
// Camadas de proteção (mesmas de submeter-formulario/submeter-simulador,
// via _shared/captacao.ts): honeypot, sanitização, bloqueio de link,
// telefone válido, rate limit 5/10min por IP (contado em leads),
// origem_ip só no lead (D-067). Extra deste canal: dedupe de 24h por
// telefone na MESMA LP — devolve o lead existente em vez de duplicar
// (a LP fica no ar por meses; bloquear pra sempre, como o Quiz, seria
// errado; duplicar a cada reenvio poluiria a fila).
//
// Depois de gravar, registra o evento interno `lead_created` em
// lp_events (o ÚNICO evento que só o servidor emite) — o dashboard usa
// `leads` como fonte de verdade de "leads", o evento serve pra trilha e
// pra amarrar sessão ↔ lead.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getCorsHeaders, json, sanitizeText, validarTelefone, containsLink,
  getClientIp, atingiuRateLimit,
} from '../_shared/captacao.ts';

const SERVICOS = ['internet_residencial', 'internet_empresarial', 'rjnet_movel', 'streamings', 'outro'];
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEDUPE_HORAS = 24;

function sanitizarUtm(bruto: unknown): Record<string, string> | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const b = bruto as Record<string, unknown>;
  const utm: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const valor = sanitizeText(b[key], 120);
    if (valor && !containsLink(valor)) utm[key] = valor;
  }
  return Object.keys(utm).length > 0 ? utm : null;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, corsHeaders);

  try {
    let body: Record<string, unknown>;
    try { body = JSON.parse(await req.text()); } catch { return json({ error: 'Payload inválido.' }, 400, corsHeaders); }

    // Honeypot: aceita silenciosamente sem gravar (mesmo padrão dos outros canais)
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return json({ ok: true }, 200, corsHeaders);
    }

    const slug = sanitizeText(body.slug, 80);
    if (!slug) return json({ error: 'Landing page inválida.' }, 400, corsHeaders);

    if (body.consentimentoColetado !== true) {
      return json({ error: 'É necessário confirmar o consentimento para uso dos dados.' }, 400, corsHeaders);
    }

    const nome = sanitizeText(body.nome, 120);
    if (!nome) return json({ error: 'Nome é obrigatório.' }, 400, corsHeaders);
    if (containsLink(nome)) return json({ error: 'Campo "nome" não pode conter link.' }, 400, corsHeaders);

    const telefone = typeof body.telefone === 'string' ? body.telefone.trim() : '';
    if (!validarTelefone(telefone)) {
      return json({ error: 'Telefone inválido. Informe DDD + número (10 ou 11 dígitos).' }, 400, corsHeaders);
    }

    const bairro = sanitizeText(body.bairro, 80);
    const cidade = sanitizeText(body.cidade, 80);
    const endereco = sanitizeText(body.endereco, 200);
    const observacao = sanitizeText(body.mensagem ?? body.observacao, 500);
    for (const [campo, valor] of [['bairro', bairro], ['cidade', cidade], ['endereco', endereco], ['mensagem', observacao]] as const) {
      if (valor && containsLink(valor)) return json({ error: `Campo "${campo}" não pode conter link.` }, 400, corsHeaders);
    }

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const clientIp = getClientIp(req);
    if (await atingiuRateLimit(admin, clientIp)) {
      console.warn('[rjnet:edge:lp] lead rejeitado — rate limit por IP');
      return json({ error: 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.' }, 429, corsHeaders);
    }

    const { data: lp, error: lpErro } = await admin
      .from('landing_pages')
      .select('id,status,servico,campanha_padrao')
      .eq('slug', slug)
      .maybeSingle();
    if (lpErro || !lp || lp.status !== 'ativa') {
      return json({ error: 'Landing page não encontrada ou inativa.' }, 404, corsHeaders);
    }

    // Sessão: só vincula se existir E for desta LP (o cliente nunca é
    // fonte de verdade de vínculo). A UTM da sessão prevalece.
    const sessionIdBruto = typeof body.sessionId === 'string' && UUID_RE.test(body.sessionId) ? body.sessionId.toLowerCase() : null;
    let sessionId: string | null = null;
    let utm: Record<string, string> | null = null;
    if (sessionIdBruto) {
      const { data: sessao } = await admin
        .from('lp_sessions')
        .select('id,landing_page_id,utm_source,utm_medium,utm_campaign,utm_term,utm_content')
        .eq('id', sessionIdBruto)
        .maybeSingle();
      if (sessao && sessao.landing_page_id === lp.id) {
        sessionId = sessao.id;
        const daSessao: Record<string, string> = {};
        for (const key of UTM_KEYS) if (sessao[key as keyof typeof sessao]) daSessao[key] = String(sessao[key as keyof typeof sessao]);
        if (Object.keys(daSessao).length > 0) utm = daSessao;
      }
    }
    if (!utm) utm = sanitizarUtm(body.utm);
    if (utm && !utm.utm_campaign && lp.campanha_padrao) utm.utm_campaign = lp.campanha_padrao;
    if (!utm && lp.campanha_padrao) utm = { utm_campaign: lp.campanha_padrao };

    // Serviço de interesse: lista enviada (filtrada pela whitelist) ou o
    // produto da própria LP como padrão.
    const servicosBody = Array.isArray(body.servicoInteresse)
      ? body.servicoInteresse.filter((s) => typeof s === 'string' && SERVICOS.includes(s))
      : (typeof body.servicoInteresse === 'string' && SERVICOS.includes(body.servicoInteresse) ? [body.servicoInteresse] : []);
    const servicosInteresse = servicosBody.length > 0 ? servicosBody : [lp.servico || 'outro'];

    // Dedupe de 24h por telefone na mesma LP — devolve o lead existente
    // (permite ao SDK amarrar o whatsapp_click) sem criar duplicata.
    const desde = new Date(Date.now() - DEDUPE_HORAS * 3_600_000).toISOString();
    const { data: existente } = await admin
      .from('leads').select('id')
      .eq('landing_page_id', lp.id).eq('telefone', telefone).eq('deletado', false)
      .gte('criado_em', desde)
      .order('criado_em', { ascending: false })
      .limit(1).maybeSingle();
    if (existente) {
      await admin.from('lp_events').insert({
        landing_page_id: lp.id, session_id: sessionId, lead_id: existente.id, nome: 'form_submit', propriedades: { duplicado: true },
      });
      return json({ ok: true, leadId: existente.id, duplicado: true }, 200, corsHeaders);
    }

    const leadId = `l-lp-${crypto.randomUUID()}`;
    const agora = new Date().toISOString();
    const { error: insErro } = await admin.from('leads').insert({
      id: leadId,
      evento_id: null,
      mes_referencia: null,
      vendedor_id: null,
      vendedor_nome: null,
      origem: 'landing_page',
      origem_ip: clientIp,
      landing_page_id: lp.id,
      lp_session_id: sessionId,
      nome,
      telefone,
      cpf: null,
      endereco: endereco || null,
      bairro: bairro || null,
      cidade: cidade || null,
      campos_extras: {},
      utm,
      servico_interesse: JSON.stringify(servicosInteresse),
      temperatura: 'morno',
      observacao: observacao || null,
      ja_cliente_rjnet: body.jaClienteRjnet === true,
      criado_em: agora,
      consentimento_coletado: true,
      consentimento_em: agora,
      versao_termo: 'landing-page-v1',
      deletado: false,
    });
    if (insErro) {
      console.error('[rjnet:edge:lp] falha ao gravar lead da landing page:', insErro);
      return json({ error: 'Não foi possível registrar seus dados agora. Tente novamente em instantes.' }, 500, corsHeaders);
    }

    // Trilha: lead criado + associado à sessão. Falha aqui NUNCA desfaz o
    // lead (conversão > tracking) — só loga.
    const { error: evErro } = await admin.from('lp_events').insert({
      landing_page_id: lp.id, session_id: sessionId, lead_id: leadId, nome: 'lead_created', propriedades: {},
    });
    if (evErro) console.error('[rjnet:edge:lp] lead criado, mas falha ao registrar lead_created:', evErro);

    return json({ ok: true, leadId }, 200, corsHeaders);
  } catch (err) {
    console.error('[rjnet:edge:lp] erro não tratado em submeter-lp:', err);
    return json({ error: 'Erro interno do servidor. Tente novamente em instantes.' }, 500, getCorsHeaders(req));
  }
});
