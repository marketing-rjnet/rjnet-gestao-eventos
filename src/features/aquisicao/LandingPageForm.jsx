import React, { useState } from 'react';
import { SERVICO_LABEL } from '../../utils/format';
import { slugify } from '../../utils/ids';
import { sanitizeText } from '../../lib/security';
import { STATUS_LP, STATUS_LP_LABEL, INTEGRACOES_TRACKING, normalizarWhatsapp, sanitizarTracking } from '../../lib/aquisicao';

// D-104: formulário genérico de Landing Page (criar/editar) — nada aqui é
// específico de um produto: nome, slug, serviço, domínio, status,
// campanha padrão, destino do WhatsApp (número pode ficar vazio até ser
// definido) e IDs públicos de tracking (GTM/GA4/Ads/Meta), todos
// configuráveis sem deploy.
export function LandingPageForm({ inicial, landingPages, onSalvar, onCancelar }) {
  const editando = Boolean(inicial?.id);
  const [f, setF] = useState(() => ({
    nome: '', slug: '', descricao: '', dominio: '', servico: 'internet_residencial', status: STATUS_LP.PREPARACAO,
    campanhaPadrao: '', whatsappEnabled: true, whatsappNumber: '', whatsappLabel: 'Falar no WhatsApp', whatsappMensagem: '',
    tracking: {}, ...(inicial || {}), whatsappNumber: inicial?.whatsappNumber || '',
  }));
  const [slugEditado, setSlugEditado] = useState(editando);
  const [erro, setErro] = useState('');
  const set = (patch) => setF((p) => ({ ...p, ...patch }));
  const setTracking = (key, valor) => setF((p) => ({ ...p, tracking: { ...(p.tracking || {}), [key]: valor } }));

  const submit = (e) => {
    e.preventDefault();
    setErro('');
    const nome = sanitizeText(f.nome, 80);
    const slug = slugify(sanitizeText(f.slug || f.nome, 60));
    if (!nome) { setErro('Dê um nome à landing page (ex: LP Fibra).'); return; }
    if (!slug) { setErro('Slug inválido.'); return; }
    if (landingPages.some((lp) => lp.slug === slug && lp.id !== inicial?.id)) { setErro(`Já existe uma landing page com o slug "${slug}".`); return; }
    if (f.whatsappNumber && !normalizarWhatsapp(f.whatsappNumber)) { setErro('Número de WhatsApp inválido — use DDD + número (o DDI 55 é adicionado automaticamente).'); return; }
    onSalvar({
      nome, slug,
      descricao: sanitizeText(f.descricao, 255),
      dominio: sanitizeText(f.dominio, 120).replace(/^https?:\/\//i, '').replace(/\/+$/, ''),
      servico: f.servico || null,
      status: f.status,
      campanhaPadrao: sanitizeText(f.campanhaPadrao, 120),
      whatsappEnabled: Boolean(f.whatsappEnabled),
      whatsappNumber: normalizarWhatsapp(f.whatsappNumber),
      whatsappLabel: sanitizeText(f.whatsappLabel, 60),
      whatsappMensagem: sanitizeText(f.whatsappMensagem, 300),
      tracking: sanitizarTracking(f.tracking),
    });
  };

  return (
    <form onSubmit={submit} className="card" data-testid="lp-form">
      <span className="section-title">{editando ? 'Configurar landing page' : 'Nova landing page'}</span>
      <div className="grid-2" style={{ marginTop: 10 }}>
        <div className="big-field">
          <label>Nome *</label>
          <input required maxLength={80} value={f.nome} placeholder="Ex: LP Fibra" autoFocus
            onChange={(e) => { set({ nome: e.target.value, ...(slugEditado ? {} : { slug: slugify(e.target.value) }) }); }} />
        </div>
        <div className="big-field">
          <label>Slug (identificador no tracking) *</label>
          <input required maxLength={60} value={f.slug} placeholder="fibra" className="mono"
            onChange={(e) => { setSlugEditado(true); set({ slug: e.target.value }); }} />
        </div>
        <div className="big-field">
          <label>Produto / serviço</label>
          <select value={f.servico || ''} onChange={(e) => set({ servico: e.target.value || null })}>
            {Object.entries(SERVICO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="big-field">
          <label>Domínio</label>
          <input maxLength={120} value={f.dominio} placeholder="fibra.rjnet.com.br" onChange={(e) => set({ dominio: e.target.value })} />
        </div>
        <div className="big-field">
          <label>Campanha padrão (utm_campaign de visitas sem UTM)</label>
          <input maxLength={120} value={f.campanhaPadrao} placeholder="Ex: fibra_setembro" onChange={(e) => set({ campanhaPadrao: e.target.value })} />
        </div>
        <div className="big-field">
          <label>Descrição</label>
          <input maxLength={255} value={f.descricao} onChange={(e) => set({ descricao: e.target.value })} />
        </div>
      </div>

      <div className="big-field" style={{ marginTop: 12 }}>
        <label>Status</label>
        <div className="seg-control" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {Object.values(STATUS_LP).map((s) => (
            <button key={s} type="button" className={'seg-btn' + (f.status === s ? ' active' : '')} onClick={() => set({ status: s })}>{STATUS_LP_LABEL[s]}</button>
          ))}
        </div>
        <p className="campo-hint" style={{ marginTop: 6 }}>Só uma LP <strong>ativa</strong> aceita visitas e leads pelo tracking — em preparação/inativa, o SDK é recusado no servidor.</p>
      </div>

      <span className="section-title" style={{ display: 'block', marginTop: 8 }}>WhatsApp (destino do CTA)</span>
      <div className="grid-2">
        <div className="big-field">
          <label>Número (DDD + número, DDI 55 automático)</label>
          <input maxLength={20} value={f.whatsappNumber} placeholder="Ainda não definido" inputMode="tel" onChange={(e) => set({ whatsappNumber: e.target.value })} />
          <p className="campo-hint" style={{ marginTop: 4 }}>Pode ficar vazio: o clique continua sendo rastreado e a LP usa o link que ela mesma tiver. Nunca fica no código.</p>
        </div>
        <div className="big-field">
          <label>Rótulo do botão</label>
          <input maxLength={60} value={f.whatsappLabel} onChange={(e) => set({ whatsappLabel: e.target.value })} />
        </div>
      </div>
      <div className="big-field">
        <label>Mensagem pré-preenchida</label>
        <textarea rows={2} maxLength={300} value={f.whatsappMensagem} style={{ width: '100%', boxSizing: 'border-box' }} onChange={(e) => set({ whatsappMensagem: e.target.value })} />
      </div>
      <label className="consentimento-check" style={{ marginBottom: 12 }}>
        <input type="checkbox" checked={Boolean(f.whatsappEnabled)} onChange={(e) => set({ whatsappEnabled: e.target.checked })} />
        <span>WhatsApp habilitado nesta landing page</span>
      </label>

      <span className="section-title" style={{ display: 'block', marginTop: 8 }}>Tracking &amp; integrações (IDs públicos, por LP)</span>
      <div className="grid-2">
        {INTEGRACOES_TRACKING.map((i) => (
          <div className="big-field" key={i.key}>
            <label>{i.label} {!i.implementado && <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>· preparado (fase 2)</span>}</label>
            <input maxLength={40} className="mono" placeholder={i.placeholder} value={f.tracking?.[i.key] || ''} onChange={(e) => setTracking(i.key, e.target.value)} />
          </div>
        ))}
      </div>
      <p className="campo-hint">Só IDs públicos — nunca tokens/secrets. O GTM é injetado pelo SDK quando preenchido; os demais ficam salvos como pontos de extensão da camada de integrações.</p>

      {erro && <div className="form-erro">{erro}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="submit" className="btn-primary">{editando ? 'Salvar' : 'Criar landing page'}</button>
        {onCancelar && <button type="button" className="btn-ghost" onClick={onCancelar}>Cancelar</button>}
      </div>
    </form>
  );
}
