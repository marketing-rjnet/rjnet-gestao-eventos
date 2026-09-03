/**
 * Testes unitários do módulo de Aquisição / Landing Pages (D-104):
 * - taxonomia de eventos e mapeamento externo
 * - sanitização de tracking / WhatsApp
 * - calcularFunil(): mesma regra da RPC aquisicao_metricas (SQL)
 *
 * Para rodar: node tests/aquisicao.unit.test.js
 *
 * Importa o módulo REAL (src/lib/aquisicao.js não tem imports de propósito)
 * — mesmo padrão de simulador.unit.test.js.
 */

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(desc, cond) {
  if (cond) { console.log(`  ✓ ${desc}`); passed++; }
  else       { console.error(`  ✗ ${desc}`); failed++; }
}

(async () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/lib/aquisicao.js'), 'utf8');
  const mod = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
  const {
    EVENTOS_LP, NOMES_EVENTOS_LP, EVENTOS_INTERACAO, eventoLabel, MAPA_EVENTOS_EXTERNOS,
    sanitizarTracking, normalizarWhatsapp, montarLinkWhatsapp, taxaConversao,
    calcularFunil, opcoesFiltroCampanha, gerarSnippetLp, INTEGRACOES_TRACKING,
  } = mod;

  console.log('\ntaxonomia de eventos');
  assert('6 eventos internos', EVENTOS_LP.length === 6 && NOMES_EVENTOS_LP.includes('whatsapp_click'));
  assert('page_view e lead_created NÃO são interação', !EVENTOS_INTERACAO.includes('page_view') && !EVENTOS_INTERACAO.includes('lead_created'));
  assert('cta_click/form_start/form_submit/whatsapp_click são interação', ['cta_click', 'form_start', 'form_submit', 'whatsapp_click'].every((e) => EVENTOS_INTERACAO.includes(e)));
  assert('lead_created é exclusivo do servidor', EVENTOS_LP.find((e) => e.nome === 'lead_created').servidor === true);
  assert('eventoLabel devolve rótulo legível', eventoLabel('whatsapp_click') === 'Clique no WhatsApp' && eventoLabel('xyz') === 'xyz');
  assert('todo evento interno tem mapeamento GA4 + Meta', NOMES_EVENTOS_LP.every((n) => MAPA_EVENTOS_EXTERNOS[n]?.ga4 && MAPA_EVENTOS_EXTERNOS[n]?.meta));
  assert('lead_created → generate_lead / Lead', MAPA_EVENTOS_EXTERNOS.lead_created.ga4 === 'generate_lead' && MAPA_EVENTOS_EXTERNOS.lead_created.meta === 'Lead');

  console.log('\nsanitização de configuração');
  const t = sanitizarTracking({ gtm_container_id: ' GTM-ABC123 ', ga4_measurement_id: 'G-XYZ', meta_pixel_id: '<script>', desconhecido: 'x', google_ads_conversion_id: 'AW 123' });
  assert('mantém só chaves conhecidas e valores válidos', t.gtm_container_id === 'GTM-ABC123' && t.ga4_measurement_id === 'G-XYZ' && !('desconhecido' in t));
  assert('rejeita valor com HTML/espaço', !('meta_pixel_id' in t) && !('google_ads_conversion_id' in t));
  assert('tracking vazio/inválido vira {}', Object.keys(sanitizarTracking(null)).length === 0 && Object.keys(sanitizarTracking('x')).length === 0);
  assert('INTEGRACOES_TRACKING: só GTM implementado nesta fase', INTEGRACOES_TRACKING.filter((i) => i.implementado).map((i) => i.key).join() === 'gtm_container_id');

  console.log('\nWhatsApp');
  assert('número vazio → null (cenário "ainda não definido")', normalizarWhatsapp('') === null && normalizarWhatsapp(null) === null);
  assert('DDD+número ganha DDI 55', normalizarWhatsapp('(24) 99999-9999') === '5524999999999');
  assert('número já com DDI é mantido', normalizarWhatsapp('5524999999999') === '5524999999999');
  assert('número curto demais é inválido', normalizarWhatsapp('1234') === null);
  assert('link wa.me com mensagem codificada', montarLinkWhatsapp('5524999999999', 'Olá, tudo bem?') === 'https://wa.me/5524999999999?text=Ol%C3%A1%2C%20tudo%20bem%3F');
  assert('sem número → sem link (nunca hardcoded)', montarLinkWhatsapp(null, 'x') === null);
  assert('taxaConversao evita divisão por zero', taxaConversao(5, 0) === 0 && Math.abs(taxaConversao(1, 4) - 25) < 1e-9);

  console.log('\ncalcularFunil — mesma regra da RPC');
  const dia = (n) => new Date(2026, 8, n, 12).toISOString();
  const sessions = [
    { id: 's1', landingPageId: 'lp-fibra', utmSource: 'meta', utmMedium: 'paid', utmCampaign: 'fibra_setembro', utmContent: 'criativo_01', criadoEm: dia(1) },
    { id: 's2', landingPageId: 'lp-fibra', utmSource: 'meta', utmMedium: 'paid', utmCampaign: 'fibra_setembro', utmContent: 'criativo_02', criadoEm: dia(2) },
    { id: 's3', landingPageId: 'lp-fibra', utmSource: null, utmMedium: null, utmCampaign: null, criadoEm: dia(3) },
    { id: 's4', landingPageId: 'lp-tv', utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'tv_promo', criadoEm: dia(3) },
    { id: 's5', landingPageId: 'lp-fibra', utmSource: 'meta', utmMedium: 'paid', utmCampaign: 'fibra_setembro', criadoEm: new Date(2026, 6, 1).toISOString() }, // fora do período
  ];
  const events = [
    { nome: 'page_view', sessionId: 's1', landingPageId: 'lp-fibra', criadoEm: dia(1) },
    { nome: 'page_view', sessionId: 's1', landingPageId: 'lp-fibra', criadoEm: dia(1) }, // 2º page_view da mesma sessão não conta 2x
    { nome: 'cta_click', sessionId: 's1', landingPageId: 'lp-fibra', criadoEm: dia(1) },
    { nome: 'form_start', sessionId: 's1', landingPageId: 'lp-fibra', criadoEm: dia(1) },
    { nome: 'whatsapp_click', sessionId: 's1', landingPageId: 'lp-fibra', leadId: 'l1', criadoEm: dia(1) },
    { nome: 'page_view', sessionId: 's2', landingPageId: 'lp-fibra', criadoEm: dia(2) },
    { nome: 'whatsapp_click', sessionId: 's2', landingPageId: 'lp-fibra', leadId: null, criadoEm: dia(2) },
    { nome: 'page_view', sessionId: 's3', landingPageId: 'lp-fibra', criadoEm: dia(3) },
    { nome: 'page_view', sessionId: 's4', landingPageId: 'lp-tv', criadoEm: dia(3) },
    { nome: 'cta_click', sessionId: 's4', landingPageId: 'lp-tv', criadoEm: dia(3) },
    { nome: 'page_view', sessionId: 's5', landingPageId: 'lp-fibra', criadoEm: new Date(2026, 6, 1).toISOString() },
  ];
  const leads = [
    { id: 'l1', landingPageId: 'lp-fibra', lpSessionId: 's1', utm: { utm_source: 'meta', utm_medium: 'paid', utm_campaign: 'fibra_setembro' }, vendedorId: 'v1', temperatura: 'quente', criadoEm: dia(1) },
    { id: 'l2', landingPageId: 'lp-fibra', lpSessionId: 's3', utm: null, vendedorId: null, temperatura: 'morno', criadoEm: dia(3) },
    { id: 'l3', landingPageId: null, origem: 'formulario', criadoEm: dia(3) }, // não é de LP
    { id: 'l4', landingPageId: 'lp-fibra', lpSessionId: 's2', deletado: true, criadoEm: dia(2) }, // deletado não conta
  ];
  const periodo = { de: new Date(2026, 8, 1).toISOString(), ate: new Date(2026, 8, 30).toISOString() };
  const r = calcularFunil({ sessions, events, leads }, periodo);
  assert('visitas = sessões distintas com page_view no período (4)', r.totais.visitas === 4);
  assert('interações = sessões distintas com interação (s1, s2, s4 = 3)', r.totais.interacoes === 3);
  assert('leads = leads de LP não deletados no período (2)', r.totais.leads === 2);
  assert('whatsapp = cliques (2), whatsapp_leads = distintos com lead (1)', r.totais.whatsapp === 2 && r.totais.whatsapp_leads === 1);
  const fibra = r.por_landing_page.find((x) => x.id === 'lp-fibra');
  const tv = r.por_landing_page.find((x) => x.id === 'lp-tv');
  assert('por LP: fibra 3 visitas / 2 leads / 2 wa; tv 1 visita / 0 lead', fibra.visitas === 3 && fibra.leads === 2 && fibra.whatsapp === 2 && tv.visitas === 1 && tv.leads === 0);
  const camp = r.por_campanha.find((c) => c.utm_campaign === 'fibra_setembro' && c.utm_content === 'criativo_01');
  assert('por campanha: criativo_01 = 1 visita / 1 lead / 1 wa', camp && camp.visitas === 1 && camp.leads === 1 && camp.whatsapp === 1);
  assert('visita sem UTM aparece como (direto)/(sem campanha)', r.por_campanha.some((c) => c.utm_source === '(direto)' && c.utm_campaign === '(sem campanha)' && c.leads === 1));

  const rLp = calcularFunil({ sessions, events, leads }, { ...periodo, landingPageId: 'lp-tv' });
  assert('filtro por LP isola a LP TV', rLp.totais.visitas === 1 && rLp.totais.leads === 0 && rLp.totais.whatsapp === 0);
  const rCamp = calcularFunil({ sessions, events, leads }, { ...periodo, utmCampaign: 'fibra_setembro' });
  assert('filtro por campanha: 2 visitas / 1 lead / 2 wa', rCamp.totais.visitas === 2 && rCamp.totais.leads === 1 && rCamp.totais.whatsapp === 2);
  const rVend = calcularFunil({ sessions, events, leads }, { ...periodo, vendedorId: 'v1' });
  assert('filtro por vendedor só afeta leads e cliques desses leads', rVend.totais.leads === 1 && rVend.totais.whatsapp === 1 && rVend.totais.visitas === 4);
  const rTemp = calcularFunil({ sessions, events, leads }, { ...periodo, temperatura: 'morno' });
  assert('filtro por temperatura: 1 lead morno, 0 wa', rTemp.totais.leads === 1 && rTemp.totais.whatsapp === 0);
  const vazio = calcularFunil({}, {});
  assert('sem dados → zeros, sem exceção', vazio.totais.visitas === 0 && vazio.totais.leads === 0 && vazio.por_landing_page.length === 0);

  console.log('\nopções de filtro e snippet');
  const op = opcoesFiltroCampanha(r.por_campanha);
  assert('opções derivadas dos dados reais', op.campanhas.includes('fibra_setembro') && op.sources.includes('meta') && op.mediums.includes('paid'));
  const snip = gerarSnippetLp({ sdkUrl: 'https://crm.example/rjnet-lp.js', slug: 'fibra', supabaseUrl: 'https://x.supabase.co', anonKey: 'anon' });
  assert('snippet contém SDK, slug e endpoint', snip.includes('rjnet-lp.js') && snip.includes('data-lp="fibra"') && snip.includes('https://x.supabase.co'));

  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed > 0 ? 1 : 0);
})();
