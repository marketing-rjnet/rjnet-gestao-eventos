/*!
 * RJNET LP SDK — Tracking Layer das Landing Pages (D-104)
 * ------------------------------------------------------------------
 * Script único, sem dependências, embutido no <head> de QUALQUER landing
 * page da RJNET (Fibra é só a primeira). Servido pelo RJNET Gestão em
 * /rjnet-lp.js — a LP nunca carrega o app React, só este arquivo.
 *
 *   <script src="https://SEU-CRM.vercel.app/rjnet-lp.js"
 *     data-lp="fibra"
 *     data-supabase-url="https://SEU-PROJETO.supabase.co"
 *     data-anon-key="SUA_ANON_KEY"
 *     defer></script>
 *
 * O que faz (tudo em segundo plano, sem bloquear a página):
 *   1. Cria/recupera a SESSÃO de visita (sessionStorage) e captura UTMs,
 *      referrer, URL e tipo de dispositivo no primeiro acesso (first touch).
 *   2. Busca a configuração pública da LP (destino do WhatsApp + IDs de
 *      tracking) via RPC `landing_page_publica` — nada hardcoded aqui.
 *   3. Despacha EVENTOS INTERNOS (page_view, cta_click, form_start,
 *      form_submit, whatsapp_click) para a camada de integrações:
 *        - "interno": Edge Function rastrear-lp (banco RJNET) — sempre
 *        - "gtm": dataLayer.push + injeção do container, se configurado
 *        - GA4 / Google Ads / Meta Pixel: pontos de extensão (Fase 2),
 *          ver RJNetLP.integrations.add() e MAPA_EVENTOS_EXTERNOS.
 *   4. Envia o formulário de lead para a Edge Function submeter-lp e guarda
 *      o leadId na sessão pra amarrar o clique no WhatsApp ao lead.
 *   5. Rastreia o clique no WhatsApp e abre wa.me com o número configurado
 *      na LP (ou deixa o link da própria página funcionar, se ainda não
 *      houver número).
 *
 * Princípio inegociável: TRACKING NUNCA IMPEDE A CONVERSÃO. Toda falha de
 * rede/config é engolida; formulário e WhatsApp continuam funcionando.
 *
 * Atributos HTML reconhecidos (auto-bind):
 *   [data-rjnet-cta="nome"]         → cta_click { cta: "nome" }
 *   form[data-rjnet-form]           → form_start (1º foco) + envio do lead
 *       campos por name: nome, telefone, bairro, cidade, endereco, mensagem,
 *       servico (múltiplo ok), consentimento (checkbox), website (honeypot)
 *       [data-rjnet-redirect="/obrigado"] redireciona após sucesso
 *   [data-rjnet-whatsapp]           → whatsapp_click + abre wa.me
 *
 * API programática: window.RJNetLP
 *   .ready(fn)                 fn(config) quando a config pública chegar
 *   .track(nome, props)        evento interno (whitelist)
 *   .submitLead(dados)         Promise<{ok, leadId, duplicado?, error?}>
 *   .whatsapp({ mensagem })    rastreia e abre o WhatsApp
 *   .integrations.add(adapter) adapter = { nome, onEvent(nome, props, ctx) }
 *   .getSession() / .getConfig()
 */
(function () {
  'use strict';
  if (window.RJNetLP) return;

  var VERSAO = '1.0.0';
  var EVENTOS = ['page_view', 'cta_click', 'form_start', 'form_submit', 'whatsapp_click'];
  var INTERACOES = ['cta_click', 'form_start', 'form_submit', 'whatsapp_click'];
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  // Espelho de MAPA_EVENTOS_EXTERNOS (src/lib/aquisicao.js) — usado pelos
  // adapters externos; o núcleo só fala a taxonomia interna.
  var MAPA_EVENTOS_EXTERNOS = {
    page_view: { ga4: 'page_view', meta: 'PageView' },
    cta_click: { ga4: 'select_content', meta: 'ViewContent' },
    form_start: { ga4: 'form_start', meta: 'InitiateCheckout' },
    form_submit: { ga4: 'form_submit', meta: 'SubmitApplication' },
    lead_created: { ga4: 'generate_lead', meta: 'Lead' },
    whatsapp_click: { ga4: 'contact', meta: 'Contact' },
  };

  /* ─── Configuração via atributos do <script> ─────────────────── */
  var script = document.currentScript || (function () {
    var s = document.querySelectorAll('script[data-lp]');
    return s[s.length - 1] || null;
  })();
  var attr = function (n) { return script ? (script.getAttribute('data-' + n) || '') : ''; };
  var cfg = {
    slug: attr('lp').trim(),
    supabaseUrl: attr('supabase-url').replace(/\/+$/, ''),
    anonKey: attr('anon-key').trim(),
    debug: attr('debug') === 'true',
  };
  var log = function () { if (cfg.debug && window.console) console.log.apply(console, ['[RJNetLP]'].concat([].slice.call(arguments))); };
  if (!cfg.slug || !cfg.supabaseUrl || !cfg.anonKey) {
    if (window.console) console.warn('[RJNetLP] faltam data-lp / data-supabase-url / data-anon-key — tracking desativado (a página continua funcionando).');
  }
  var ativo = Boolean(cfg.slug && cfg.supabaseUrl && cfg.anonKey);

  /* ─── Sessão (sessionStorage, first touch) ────────────────────── */
  var SESSION_KEY = 'rjnet_lp_session:' + cfg.slug;
  var storage = { get: function () { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { return null; } },
                  set: function (v) { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(v)); } catch (e) { /* storage bloqueado — sessão só em memória */ } } };
  var uuid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
  };
  var capturarUtm = function () {
    var utm = {}, p; try { p = new URLSearchParams(window.location.search); } catch (e) { return utm; }
    for (var i = 0; i < UTM_KEYS.length; i++) { var v = (p.get(UTM_KEYS[i]) || '').trim().slice(0, 120); if (v) utm[UTM_KEYS[i]] = v; }
    return utm;
  };
  var device = function () {
    var ua = navigator.userAgent || '';
    if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet';
    if (/Mobi|Android|iPhone|iPod/i.test(ua)) return 'mobile';
    return 'desktop';
  };
  var session = storage.get();
  if (!session || !session.id) {
    session = { id: uuid(), criadoEm: new Date().toISOString(), url: window.location.href.slice(0, 500), referrer: (document.referrer || '').slice(0, 300), utm: capturarUtm(), device: device(), leadId: null };
    storage.set(session);
  } else {
    // sessão já existe (navegação interna) — só absorve UTMs se ainda não tinha (first touch)
    var novos = capturarUtm();
    if (Object.keys(session.utm || {}).length === 0 && Object.keys(novos).length > 0) { session.utm = novos; storage.set(session); }
  }

  /* ─── Config pública da LP ────────────────────────────────────── */
  var lpConfig = null, readyFns = [], configPronta = false;
  var headers = function () { return { 'Content-Type': 'application/json', 'apikey': cfg.anonKey, 'Authorization': 'Bearer ' + cfg.anonKey }; };
  var carregarConfig = function () {
    if (!ativo) { configPronta = true; return; }
    fetch(cfg.supabaseUrl + '/rest/v1/rpc/landing_page_publica', { method: 'POST', headers: headers(), body: JSON.stringify({ p_slug: cfg.slug }) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) { lpConfig = data || null; log('config', lpConfig); })
      .catch(function () { lpConfig = null; })
      .then(function () {
        configPronta = true;
        if (lpConfig) instalarIntegracoesConfiguradas(lpConfig);
        readyFns.forEach(function (fn) { try { fn(lpConfig); } catch (e) { /* callback da LP não pode derrubar o SDK */ } });
        readyFns = [];
      });
  };

  /* ─── Camada de integrações ───────────────────────────────────── */
  var adapters = [];
  var despachar = function (nome, props, ctx) {
    for (var i = 0; i < adapters.length; i++) {
      try { adapters[i].onEvent(nome, props, ctx); } catch (e) { log('adapter falhou', adapters[i].nome, e); }
    }
  };

  // Adapter interno — banco RJNET via Edge Function rastrear-lp, com
  // buffer + flush (keepalive) pra não segurar a página nem perder o
  // último evento antes de navegar.
  var fila = [], timer = null;
  var flush = function () {
    if (!ativo || fila.length === 0) return;
    var lote = fila.splice(0, 20);
    var body = JSON.stringify({ slug: cfg.slug, session: { id: session.id, url: session.url, referrer: session.referrer, utm: session.utm, device: session.device }, events: lote });
    try {
      fetch(cfg.supabaseUrl + '/functions/v1/rastrear-lp', { method: 'POST', headers: headers(), body: body, keepalive: true })
        .then(function (r) { log('rastrear-lp', r.status); }).catch(function () { /* tracking falhou — segue o jogo */ });
    } catch (e) { /* fetch indisponível */ }
    if (fila.length > 0) flush();
  };
  var agendarFlush = function (imediato) {
    if (imediato) { clearTimeout(timer); timer = null; flush(); return; }
    if (timer) return;
    timer = setTimeout(function () { timer = null; flush(); }, 800);
  };
  adapters.push({ nome: 'interno', onEvent: function (nome, props, ctx) {
    fila.push({ nome: nome, props: props || {}, leadId: ctx.leadId || null });
    agendarFlush(ctx.imediato);
  } });

  // Adapter GTM — só quando a LP tem gtm_container_id configurado (nada
  // hardcoded). Empurra o evento interno pro dataLayer com prefixo rjnet_;
  // o mapeamento pra GA4/Ads/Meta fica nas tags do container.
  var instalarIntegracoesConfiguradas = function (lp) {
    var t = (lp && lp.tracking) || {};
    if (t.gtm_container_id && /^GTM-[A-Z0-9]+$/i.test(t.gtm_container_id)) {
      window.dataLayer = window.dataLayer || [];
      if (!document.querySelector('script[src*="googletagmanager.com/gtm.js"]')) {
        window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
        var s = document.createElement('script'); s.async = true;
        s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(t.gtm_container_id);
        document.head.appendChild(s);
      }
      adapters.push({ nome: 'gtm', onEvent: function (nome, props, ctx) {
        window.dataLayer.push({ event: 'rjnet_' + nome, rjnet: { lp: cfg.slug, session_id: session.id, lead_id: ctx.leadId || null, props: props || {}, externo: MAPA_EVENTOS_EXTERNOS[nome] || null } });
      } });
      log('GTM instalado', t.gtm_container_id);
    }
    // Pontos de extensão (Fase 2): ga4_measurement_id, google_ads_conversion_id/label,
    // meta_pixel_id — registrar adapters via RJNetLP.integrations.add(); o núcleo
    // não conhece nenhuma plataforma específica.
  };

  /* ─── API pública ─────────────────────────────────────────────── */
  var track = function (nome, props, opts) {
    if (EVENTOS.indexOf(nome) < 0) { log('evento fora da taxonomia ignorado:', nome); return; }
    despachar(nome, props || {}, { leadId: session.leadId, imediato: Boolean(opts && opts.imediato), sessionId: session.id });
  };

  var submitLead = function (dados) {
    dados = dados || {};
    var payload = {
      slug: cfg.slug, sessionId: session.id,
      nome: dados.nome || '', telefone: dados.telefone || '',
      bairro: dados.bairro || '', cidade: dados.cidade || '', endereco: dados.endereco || '',
      mensagem: dados.mensagem || '', servicoInteresse: dados.servicoInteresse || (lpConfig && lpConfig.servico ? [lpConfig.servico] : []),
      jaClienteRjnet: dados.jaClienteRjnet === true,
      consentimentoColetado: dados.consentimentoColetado === true,
      website: dados.website || '',
      utm: session.utm,
    };
    track('form_submit', {}, { imediato: true });
    if (!ativo) return Promise.resolve({ ok: false, error: 'SDK não configurado.' });
    return fetch(cfg.supabaseUrl + '/functions/v1/submeter-lp', { method: 'POST', headers: headers(), body: JSON.stringify(payload) })
      .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }); })
      .then(function (res) {
        if (res.status >= 200 && res.status < 300 && res.body && res.body.ok) {
          if (res.body.leadId) { session.leadId = res.body.leadId; storage.set(session); }
          // lead_created é emitido pelo SERVIDOR no banco; aqui só avisamos as integrações externas
          for (var i = 0; i < adapters.length; i++) if (adapters[i].nome !== 'interno') { try { adapters[i].onEvent('lead_created', {}, { leadId: session.leadId, sessionId: session.id }); } catch (e) { /* ignora */ } }
          return { ok: true, leadId: res.body.leadId || null, duplicado: Boolean(res.body.duplicado) };
        }
        return { ok: false, error: (res.body && res.body.error) || 'Não foi possível enviar seus dados.' };
      })
      .catch(function () { return { ok: false, error: 'Não foi possível enviar seus dados. Verifique sua conexão.' }; });
  };

  var linkWhatsapp = function (mensagem) {
    if (!lpConfig || !lpConfig.whatsapp_enabled || !lpConfig.whatsapp_number) return null;
    var num = String(lpConfig.whatsapp_number).replace(/\D/g, '');
    if (!num) return null;
    var msg = mensagem || lpConfig.whatsapp_mensagem || '';
    return 'https://wa.me/' + num + (msg ? '?text=' + encodeURIComponent(msg) : '');
  };

  // Rastreia o clique e abre o WhatsApp. Devolve true se abriu com o número
  // configurado; false se ainda não há número (deixa a LP usar seu próprio link).
  var whatsapp = function (opts) {
    opts = opts || {};
    track('whatsapp_click', { origem: opts.origem || 'cta', tem_lead: Boolean(session.leadId) }, { imediato: true });
    var href = linkWhatsapp(opts.mensagem);
    if (!href) return false;
    if (opts.abrir !== false) window.open(href, opts.target || '_blank', 'noopener');
    return true;
  };

  window.RJNetLP = {
    version: VERSAO,
    EVENTOS: EVENTOS.slice(),
    MAPA_EVENTOS_EXTERNOS: MAPA_EVENTOS_EXTERNOS,
    ready: function (fn) { if (configPronta) { try { fn(lpConfig); } catch (e) { /* ignora */ } } else readyFns.push(fn); },
    track: track,
    submitLead: submitLead,
    whatsapp: whatsapp,
    whatsappLink: linkWhatsapp,
    getSession: function () { return { id: session.id, utm: session.utm, leadId: session.leadId, device: session.device }; },
    getConfig: function () { return lpConfig; },
    integrations: { add: function (adapter) { if (adapter && typeof adapter.onEvent === 'function') adapters.push(adapter); }, list: function () { return adapters.map(function (a) { return a.nome; }); } },
    flush: function () { agendarFlush(true); },
  };

  /* ─── Auto-bind por atributos data-rjnet-* ───────────────────── */
  var bind = function () {
    var forms = document.querySelectorAll('form[data-rjnet-form]');
    for (var i = 0; i < forms.length; i++) (function (form) {
      var comecou = false;
      var inicio = function () { if (comecou) return; comecou = true; track('form_start', { form: form.getAttribute('data-rjnet-form') || 'lead' }); };
      form.addEventListener('focusin', inicio);
      form.addEventListener('input', inicio);
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var fd = new FormData(form);
        var servicos = fd.getAll('servico').filter(Boolean);
        var dados = {
          nome: fd.get('nome') || '', telefone: fd.get('telefone') || '', bairro: fd.get('bairro') || '', cidade: fd.get('cidade') || '',
          endereco: fd.get('endereco') || '', mensagem: fd.get('mensagem') || '', website: fd.get('website') || '',
          servicoInteresse: servicos.length ? servicos : undefined,
          consentimentoColetado: Boolean(form.querySelector('[name="consentimento"]:checked')),
          jaClienteRjnet: Boolean(form.querySelector('[name="ja_cliente"]:checked')),
        };
        var botoes = form.querySelectorAll('button[type="submit"],input[type="submit"]');
        for (var b = 0; b < botoes.length; b++) botoes[b].disabled = true;
        form.classList.add('rjnet-enviando');
        submitLead(dados).then(function (res) {
          form.classList.remove('rjnet-enviando');
          for (var b2 = 0; b2 < botoes.length; b2++) botoes[b2].disabled = false;
          form.dispatchEvent(new CustomEvent(res.ok ? 'rjnet:lead' : 'rjnet:lead-erro', { bubbles: true, detail: res }));
          if (res.ok) {
            form.classList.add('rjnet-enviado');
            var redir = form.getAttribute('data-rjnet-redirect');
            if (redir) { agendarFlush(true); window.location.href = redir; }
          } else {
            var erroEl = form.querySelector('[data-rjnet-erro]');
            if (erroEl) { erroEl.textContent = res.error || 'Não foi possível enviar.'; erroEl.hidden = false; }
          }
        });
      });
    })(forms[i]);

    document.addEventListener('click', function (ev) {
      var el = ev.target && ev.target.closest ? ev.target.closest('[data-rjnet-cta],[data-rjnet-whatsapp]') : null;
      if (!el) return;
      if (el.hasAttribute('data-rjnet-whatsapp')) {
        var abriu = whatsapp({ origem: el.getAttribute('data-rjnet-whatsapp') || 'cta', mensagem: el.getAttribute('data-rjnet-mensagem') || undefined, abrir: false });
        var href = linkWhatsapp(el.getAttribute('data-rjnet-mensagem') || undefined);
        if (abriu && href) { ev.preventDefault(); window.open(href, el.getAttribute('target') || '_blank', 'noopener'); }
        // sem número configurado: o href da própria LP (se houver) segue normalmente
        return;
      }
      track('cta_click', { cta: el.getAttribute('data-rjnet-cta') || (el.textContent || '').trim().slice(0, 60) });
    }, true);
  };

  /* ─── Boot ────────────────────────────────────────────────────── */
  carregarConfig();
  track('page_view', { path: window.location.pathname.slice(0, 120), title: (document.title || '').slice(0, 120) });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') agendarFlush(true); });
  window.addEventListener('pagehide', function () { agendarFlush(true); });
  log('iniciado', { slug: cfg.slug, session: session.id, utm: session.utm });
})();
