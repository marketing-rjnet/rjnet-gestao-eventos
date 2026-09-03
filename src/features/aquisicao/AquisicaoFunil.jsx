import React from 'react';
import { fmtInt, fmtPct, taxaConversao } from '../../lib/aquisicao';

// D-104: funil Visitas → Interações → Leads → Cliques WhatsApp.
// Só as 4 etapas que existem HOJE — Atendimento/Venda/Receita entram
// quando houver dado real (Fase 3), nunca com número fictício.
export function AquisicaoFunil({ totais }) {
  const t = totais || { visitas: 0, interacoes: 0, leads: 0, whatsapp: 0 };
  const base = Math.max(t.visitas, t.interacoes, t.leads, t.whatsapp, 1);
  const etapas = [
    { key: 'visitas', label: 'Visitas', valor: t.visitas, cls: '' },
    { key: 'interacoes', label: 'Interações', valor: t.interacoes, cls: '', taxa: taxaConversao(t.interacoes, t.visitas) },
    { key: 'leads', label: 'Leads', valor: t.leads, cls: 'leads', taxa: taxaConversao(t.leads, t.visitas) },
    { key: 'whatsapp', label: 'Cliques WhatsApp', valor: t.whatsapp, cls: 'whatsapp', taxa: taxaConversao(t.whatsapp, t.visitas) },
  ];
  return (
    <div className="aq-funil" data-testid="aq-funil">
      {etapas.map((e) => (
        <div className="aq-funil-step" key={e.key}>
          <div className="aq-funil-label">{e.label}</div>
          <div className="aq-funil-track"><div className={'aq-funil-bar ' + e.cls} style={{ width: `${Math.max(1, (e.valor / base) * 100)}%` }} /></div>
          <div>
            <div className="aq-funil-num" data-testid={`funil-${e.key}`}>{fmtInt(e.valor)}</div>
            {e.taxa !== undefined && <div className="aq-funil-taxa">{fmtPct(e.taxa)} das visitas</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
