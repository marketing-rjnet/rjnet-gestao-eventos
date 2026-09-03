import React from 'react';
import { fmtInt, fmtPct, taxaConversao } from '../../lib/aquisicao';

// D-104: performance por campanha — dimensão derivada das UTMs das
// sessões (source/medium/campaign/content). Não existe tabela de
// campanhas: a campanha é o que o link trouxe. Cruzamento Visitas → Leads
// → WhatsApp por linha; Vendas/Receita entram quando existirem.
export function CampanhasTab({ metricas, carregando }) {
  const linhas = metricas?.por_campanha || [];
  if (carregando && !metricas) return <div className="empty">Carregando campanhas...</div>;
  if (linhas.length === 0) return <div className="empty" style={{ marginTop: 16 }}>Nenhuma visita com campanha no período. Divulgue o link da LP com <span className="mono">?utm_source=…&amp;utm_campaign=…</span> para ver os cruzamentos aqui.</div>;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <span className="section-title">Campanhas (por UTM)</span>
      <div className="tbl-wrap">
        <table data-testid="tabela-campanhas">
          <thead>
            <tr><th>Campanha</th><th>Source</th><th>Medium</th><th>Content</th><th>Visitas</th><th>Leads</th><th>WhatsApp</th><th>Conversão</th></tr>
          </thead>
          <tbody>
            {linhas.map((c, i) => (
              <tr key={i}>
                <td className="strong">{c.utm_campaign}</td>
                <td>{c.utm_source}</td>
                <td>{c.utm_medium}</td>
                <td style={{ color: 'var(--text-3)' }}>{c.utm_content || '—'}</td>
                <td className="mono">{fmtInt(c.visitas)}</td>
                <td className="mono">{fmtInt(c.leads)}</td>
                <td className="mono">{fmtInt(c.whatsapp)}</td>
                <td className="mono">{fmtPct(taxaConversao(Number(c.leads), Number(c.visitas)))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
