// Aquisição / Landing Pages (D-104) — domínio puro do módulo.
// Sem imports de propósito (mesmo princípio de src/lib/simulador.js e
// src/lib/desafioCronometro.js): testável standalone em Node
// (tests/aquisicao.unit.test.js), reaproveitado pelo modo local (sem
// Supabase) e espelhado em Deno na Edge Function rastrear-lp e no SDK
// público (public/rjnet-lp.js). Mudou aqui, muda lá.

// ─── Taxonomia PRÓPRIA de eventos ────────────────────────────────
// Eventos da plataforma RJNET — independentes das nomenclaturas de
// GA4/Meta/Ads. Adicionar um evento = adicionar uma linha aqui (e na
// whitelist da Edge Function); nunca uma tabela nova.
export const EVENTOS_LP = [
  { nome: 'page_view',      label: 'Visita',              interacao: false, servidor: false },
  { nome: 'cta_click',      label: 'Clique em CTA',       interacao: true,  servidor: false },
  { nome: 'form_start',     label: 'Início de formulário', interacao: true, servidor: false },
  { nome: 'form_submit',    label: 'Envio de formulário', interacao: true,  servidor: false },
  { nome: 'lead_created',   label: 'Lead criado',         interacao: false, servidor: true },
  { nome: 'whatsapp_click', label: 'Clique no WhatsApp',  interacao: true,  servidor: false },
];
export const NOMES_EVENTOS_LP = EVENTOS_LP.map((e) => e.nome);
export const EVENTOS_INTERACAO = EVENTOS_LP.filter((e) => e.interacao).map((e) => e.nome);
export const eventoLabel = (nome) => EVENTOS_LP.find((e) => e.nome === nome)?.label || nome;

export const STATUS_LP = { ATIVA: 'ativa', PREPARACAO: 'preparacao', INATIVA: 'inativa' };
export const STATUS_LP_LABEL = { ativa: 'Ativa', preparacao: 'Em preparação', inativa: 'Inativa' };

export const UTM_KEYS_LP = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

// ─── Camada de integrações (pontos de extensão) ──────────────────
// IDs PÚBLICOS configuráveis por LP em `landing_pages.tracking` — nunca
// secrets. Nesta fase só o GTM é injetado pelo SDK; os demais ficam
// prontos pra receber um adapter (Fase 2) sem tocar no núcleo da LP.
export const INTEGRACOES_TRACKING = [
  { key: 'gtm_container_id',           label: 'Google Tag Manager — Container ID', placeholder: 'GTM-XXXXXXX', implementado: true },
  { key: 'ga4_measurement_id',         label: 'Google Analytics 4 — Measurement ID', placeholder: 'G-XXXXXXXXXX', implementado: false },
  { key: 'google_ads_conversion_id',   label: 'Google Ads — Conversion ID', placeholder: 'AW-XXXXXXXXX', implementado: false },
  { key: 'google_ads_conversion_label',label: 'Google Ads — Conversion Label', placeholder: 'xxxxxxxxxxxx', implementado: false },
  { key: 'meta_pixel_id',              label: 'Meta Pixel — ID', placeholder: '000000000000000', implementado: false },
];

// Mapeamento evento interno → nome na plataforma externa. Fica fora do
// núcleo de propósito: o SDK/adapters consultam esta tabela, a LP nunca
// fala o idioma de uma plataforma específica.
export const MAPA_EVENTOS_EXTERNOS = {
  page_view:      { ga4: 'page_view',      meta: 'PageView' },
  cta_click:      { ga4: 'select_content', meta: 'ViewContent' },
  form_start:     { ga4: 'form_start',     meta: 'InitiateCheckout' },
  form_submit:    { ga4: 'form_submit',    meta: 'SubmitApplication' },
  lead_created:   { ga4: 'generate_lead',  meta: 'Lead' },
  whatsapp_click: { ga4: 'contact',        meta: 'Contact' },
};

// ─── Helpers de UI ───────────────────────────────────────────────
export const taxaConversao = (leads, visitas) => (visitas > 0 ? (leads / visitas) * 100 : 0);
export const fmtPct = (v) => `${(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
export const fmtInt = (v) => (Number(v) || 0).toLocaleString('pt-BR');

// Validação leve de config de tracking: só aceita chaves conhecidas,
// strings curtas, sem espaço/HTML — o valor é público, mas não deve
// virar vetor de injeção no SDK.
export function sanitizarTracking(bruto) {
  const limpo = {};
  if (!bruto || typeof bruto !== 'object') return limpo;
  for (const { key } of INTEGRACOES_TRACKING) {
    const v = typeof bruto[key] === 'string' ? bruto[key].trim() : '';
    if (v && /^[A-Za-z0-9_-]{2,40}$/.test(v)) limpo[key] = v;
  }
  return limpo;
}

// Só dígitos, com DDI — "5524999999999". Aceita vazio (número ainda não
// definido — cenário previsto pela Fase 1).
export function normalizarWhatsapp(valor) {
  const d = String(valor || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length < 10 || d.length > 15) return null;
  return d.length <= 11 ? `55${d}` : d;
}

export function montarLinkWhatsapp(numero, mensagem) {
  if (!numero) return null;
  const base = `https://wa.me/${numero}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}

// ─── Agregação (modo local + testes) ─────────────────────────────
// Mesmas definições da RPC aquisicao_metricas (SQL) — única regra,
// duas implementações (uma por runtime), como simulador.js ↔ Deno.
//   visitas    = sessões distintas com page_view
//   interacoes = sessões distintas com evento de interação
//   leads      = leads com landingPageId
//   whatsapp   = cliques whatsapp_click
export function calcularFunil({ sessions = [], events = [], leads = [] }, filtros = {}) {
  const { de, ate, landingPageId, utmSource, utmMedium, utmCampaign, vendedorId, temperatura } = filtros;
  const dentro = (ts) => {
    const t = new Date(ts).getTime();
    return (!de || t >= new Date(de).getTime()) && (!ate || t < new Date(ate).getTime());
  };
  const sessOk = (s) => s && dentro(s.criadoEm)
    && (!landingPageId || s.landingPageId === landingPageId)
    && (!utmSource || s.utmSource === utmSource)
    && (!utmMedium || s.utmMedium === utmMedium)
    && (!utmCampaign || s.utmCampaign === utmCampaign);
  const sessMap = new Map(sessions.filter(sessOk).map((s) => [s.id, s]));

  const leadsOk = leads.filter((l) => l.landingPageId && !l.deletado && dentro(l.criadoEm)
    && (!landingPageId || l.landingPageId === landingPageId)
    && (!utmSource || l.utm?.utm_source === utmSource)
    && (!utmMedium || l.utm?.utm_medium === utmMedium)
    && (!utmCampaign || l.utm?.utm_campaign === utmCampaign)
    && (!vendedorId || l.vendedorId === vendedorId)
    && (!temperatura || l.temperatura === temperatura));
  const leadIds = new Set(leadsOk.map((l) => l.id));
  const filtraPorLead = Boolean(vendedorId || temperatura);

  const evs = events.filter((e) => dentro(e.criadoEm) && sessMap.has(e.sessionId));
  const visitasSet = new Set(evs.filter((e) => e.nome === 'page_view').map((e) => e.sessionId));
  const interSet = new Set(evs.filter((e) => EVENTOS_INTERACAO.includes(e.nome)).map((e) => e.sessionId));
  const wa = events.filter((e) => e.nome === 'whatsapp_click' && dentro(e.criadoEm)
    && (!landingPageId || e.landingPageId === landingPageId)
    && (filtraPorLead ? leadIds.has(e.leadId) : (sessMap.has(e.sessionId) || leadIds.has(e.leadId))));

  const porLp = new Map();
  const bump = (id, k, v = 1) => { const o = porLp.get(id) || { visitas: new Set(), interacoes: new Set(), leads: 0, whatsapp: 0 }; if (k === 'visitas' || k === 'interacoes') o[k].add(v); else o[k] += 1; porLp.set(id, o); };
  evs.forEach((e) => { if (e.nome === 'page_view') bump(e.landingPageId, 'visitas', e.sessionId); if (EVENTOS_INTERACAO.includes(e.nome)) bump(e.landingPageId, 'interacoes', e.sessionId); });
  leadsOk.forEach((l) => bump(l.landingPageId, 'leads'));
  wa.forEach((e) => bump(e.landingPageId, 'whatsapp'));

  const porCampanha = new Map();
  for (const s of sessMap.values()) {
    const chave = [s.utmSource || '(direto)', s.utmMedium || '(nenhum)', s.utmCampaign || '(sem campanha)', s.utmContent || ''].join('|');
    const o = porCampanha.get(chave) || { utm_source: s.utmSource || '(direto)', utm_medium: s.utmMedium || '(nenhum)', utm_campaign: s.utmCampaign || '(sem campanha)', utm_content: s.utmContent || '', visitas: 0, leads: 0, whatsapp: 0 };
    if (visitasSet.has(s.id)) o.visitas += 1;
    o.leads += leadsOk.filter((l) => l.lpSessionId === s.id).length;
    o.whatsapp += wa.filter((e) => e.sessionId === s.id).length;
    porCampanha.set(chave, o);
  }

  return {
    totais: {
      visitas: visitasSet.size,
      interacoes: interSet.size,
      leads: leadsOk.length,
      whatsapp: wa.length,
      whatsapp_leads: new Set(wa.filter((e) => e.leadId).map((e) => e.leadId)).size,
    },
    por_landing_page: [...porLp.entries()].map(([id, o]) => ({ id, visitas: o.visitas.size, interacoes: o.interacoes.size, leads: o.leads, whatsapp: o.whatsapp })),
    por_campanha: [...porCampanha.values()].sort((a, b) => b.visitas - a.visitas || b.leads - a.leads),
    por_dia: [],
  };
}

// Opções de filtro derivadas dos dados (para os dropdowns) — Supabase
// usa por_campanha da RPC; modo local usa as sessões.
export function opcoesFiltroCampanha(porCampanha = []) {
  const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();
  return {
    sources: uniq(porCampanha.map((c) => c.utm_source)),
    mediums: uniq(porCampanha.map((c) => c.utm_medium)),
    campanhas: uniq(porCampanha.map((c) => c.utm_campaign)),
  };
}

// Snippet de integração mostrado na tela "Integração" de cada LP — o
// marketing copia e cola no <head> da LP. Nada aqui é hardcoded: origem
// do SDK, slug, endpoint e anon key vêm do ambiente/da LP.
export function gerarSnippetLp({ sdkUrl, slug, supabaseUrl, anonKey }) {
  return [
    `<script src="${sdkUrl}"`,
    `  data-lp="${slug}"`,
    `  data-supabase-url="${supabaseUrl || 'https://SEU-PROJETO.supabase.co'}"`,
    `  data-anon-key="${anonKey || 'SUA_ANON_KEY'}"`,
    `  defer></script>`,
  ].join('\n');
}
