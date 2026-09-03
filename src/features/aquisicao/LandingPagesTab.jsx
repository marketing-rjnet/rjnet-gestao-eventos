import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { Icon } from '../../components/ui';
import { SERVICO_LABEL } from '../../utils/format';
import { STATUS_LP_LABEL, fmtInt, fmtPct, taxaConversao } from '../../lib/aquisicao';
import { LandingPageForm } from './LandingPageForm';

// D-104: card genérico de Landing Page — mesmo componente pra Fibra, TV,
// Móvel ou qualquer LP futura; métricas vêm do agregado por LP.
export function LandingPageCard({ lp, metrica, onAbrir }) {
  const m = metrica || { visitas: 0, interacoes: 0, leads: 0, whatsapp: 0 };
  return (
    <div className="lp-card" data-testid="lp-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div className="strong" style={{ fontSize: 15 }}>{lp.nome}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }} className="mono">/{lp.slug}{lp.servico ? ` · ${SERVICO_LABEL[lp.servico] || lp.servico}` : ''}</div>
        </div>
        <span className={'badge badge-' + lp.status}>{STATUS_LP_LABEL[lp.status] || lp.status}</span>
      </div>
      <div className="lp-card-stats">
        <div className="lp-card-stat"><div className="lp-card-stat-num">{fmtInt(m.visitas)}</div><div className="lp-card-stat-label">visitas</div></div>
        <div className="lp-card-stat"><div className="lp-card-stat-num">{fmtInt(m.leads)}</div><div className="lp-card-stat-label">leads</div></div>
        <div className="lp-card-stat"><div className="lp-card-stat-num">{fmtInt(m.whatsapp)}</div><div className="lp-card-stat-label">WhatsApp</div></div>
        <div className="lp-card-stat"><div className="lp-card-stat-num">{fmtPct(taxaConversao(m.leads, m.visitas))}</div><div className="lp-card-stat-label">conversão</div></div>
      </div>
      {onAbrir && <button type="button" className="btn-ghost" style={{ alignSelf: 'flex-start', fontSize: 12 }} onClick={onAbrir}>Abrir <Icon name="arrow_right" size={13} /></button>}
    </div>
  );
}

// Lista + cadastro de Landing Pages. Cadastrar uma LP nova é só preencher
// o formulário — zero código.
export function LandingPagesTab({ metricas, onAbrirLp }) {
  const { landingPages, addLandingPage } = useApp();
  const [criando, setCriando] = useState(false);
  const porLp = new Map((metricas?.por_landing_page || []).map((r) => [r.id, r]));

  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {criando ? (
        <LandingPageForm
          landingPages={landingPages}
          onSalvar={(dados) => { const nova = addLandingPage(dados); setCriando(false); onAbrirLp?.(nova.id); }}
          onCancelar={() => setCriando(false)}
        />
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <p className="tab-desc" style={{ margin: 0 }}>Cada landing page é uma instância da mesma infraestrutura: tracking, atribuição, leads e WhatsApp. Adicionar uma nova não exige código.</p>
          <button type="button" className="btn-primary" onClick={() => setCriando(true)}><Icon name="plus" size={15} /> Nova landing page</button>
        </div>
      )}
      {landingPages.length === 0 ? (
        <div className="empty">Nenhuma landing page cadastrada. Crie a primeira (ex: LP Fibra).</div>
      ) : (
        <div className="lp-grid">
          {landingPages.map((lp) => <LandingPageCard key={lp.id} lp={lp} metrica={porLp.get(lp.id)} onAbrir={() => onAbrirLp?.(lp.id)} />)}
        </div>
      )}
    </div>
  );
}
