import React from 'react';
import { Kpi, ChartView } from '../../components/ui';
import { AquisicaoFunil } from './AquisicaoFunil';
import { LandingPageCard } from './LandingPagesTab';
import { fmtInt, fmtPct, taxaConversao } from '../../lib/aquisicao';

// D-104: visão geral de aquisição — KPIs, funil, evolução diária e cards
// por Landing Page. 100% dados reais (RPC aquisicao_metricas / cálculo
// local); sem número fictício em nenhuma etapa.
export function AquisicaoDashboard({ metricas, carregando, erro, onAbrirLp }) {
  if (erro) return <div className="form-erro" style={{ marginTop: 16 }}>{erro}</div>;
  if (carregando && !metricas) return <div className="empty" style={{ padding: '30px 0' }}>Carregando métricas...</div>;
  const t = metricas?.totais || { visitas: 0, interacoes: 0, leads: 0, whatsapp: 0, whatsapp_leads: 0 };
  const porDia = metricas?.por_dia || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 16 }}>
      <div className="grid-kpi">
        <Kpi label="Visitas" value={fmtInt(t.visitas)} icon="globe" />
        <Kpi label="Leads" value={fmtInt(t.leads)} icon="users" />
        <Kpi label="Conversão" value={fmtPct(taxaConversao(t.leads, t.visitas))} icon="chart" />
        <Kpi label="WhatsApp" value={fmtInt(t.whatsapp)} icon="message" />
      </div>

      <div className="card">
        <span className="section-title">Funil de aquisição</span>
        <AquisicaoFunil totais={t} />
        <p className="campo-hint" style={{ marginTop: 12, marginBottom: 0 }}>
          Visitas = sessões com page_view · Interações = sessões com clique em CTA, início/envio de formulário ou WhatsApp ·
          Leads = registros criados em Leads · WhatsApp = cliques no botão (dos quais {fmtInt(t.whatsapp_leads)} já eram leads).
          Atendimento e venda entram quando existirem no sistema — sem estimativas.
        </p>
      </div>

      {porDia.length > 1 && (
        <div className="card">
          <span className="section-title">Evolução diária</span>
          <div style={{ height: 220 }}>
            <ChartView
              type="bar"
              data={{
                labels: porDia.map((d) => new Date(d.dia + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })),
                datasets: [
                  { label: 'Visitas', data: porDia.map((d) => Number(d.visitas)), backgroundColor: '#ffcb00' },
                  { label: 'Leads', data: porDia.map((d) => Number(d.leads)), backgroundColor: '#22c55e' },
                  { label: 'WhatsApp', data: porDia.map((d) => Number(d.whatsapp)), backgroundColor: '#25d366' },
                ],
              }}
              options={{ plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }}
            />
          </div>
        </div>
      )}

      <div>
        <span className="section-title">Landing Pages</span>
        {(metricas?.por_landing_page || []).length === 0 ? (
          <div className="empty">Nenhuma landing page cadastrada ainda.</div>
        ) : (
          <div className="lp-grid">
            {metricas.por_landing_page.map((lp) => <LandingPageCard key={lp.id} lp={lp} metrica={lp} onAbrir={() => onAbrirLp?.(lp.id)} />)}
          </div>
        )}
      </div>
    </div>
  );
}
