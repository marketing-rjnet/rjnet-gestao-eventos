import React, { useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { Kpi, ChartView, StatusBadge } from '../../components/ui';
import { Icon } from '../../components/ui';
import { fmtDate } from '../../utils/format';
import { STATUS_EVENTO, UPCOMING_EVENTS_LIMIT, CHART_CUTOUT } from '../../lib/constants';

const CHART_COLORS = ["#f5c000", "#22c55e", "#ef4444", "#666666"];

export default function Dashboard() {
  const { eventos, leads, vendedores, getMateriaisDisponiveis } = useApp();
  const ativos = eventos.filter((e) => e.status === STATUS_EVENTO.ATIVO).length;
  const criticos = getMateriaisDisponiveis().filter((m) => m.disponivel <= 0).length;
  const vendAtivos = vendedores.filter((v) => v.ativo).length;

  const dist = useMemo(() => {
    const c = { fibra_residencial: 0, fibra_empresarial: 0, hotspot: 0, outro: 0 };
    leads.forEach((l) => { c[l.servicoInteresse] = (c[l.servicoInteresse] || 0) + 1; });
    return c;
  }, [leads]);

  const doughData = {
    labels: ["Fibra Res", "Fibra Emp", "Hotspot", "Outro"],
    datasets: [{
      data: [dist.fibra_residencial, dist.fibra_empresarial, dist.hotspot, dist.outro],
      backgroundColor: CHART_COLORS,
      borderColor: "#1a1a1a",
      borderWidth: 2,
    }],
  };

  const upcoming = [...eventos].sort((a, b) => a.dataInicio.localeCompare(b.dataInicio)).slice(0, UPCOMING_EVENTS_LIMIT);

  return (
    <div className="section">
      <div className="grid-kpi">
        <Kpi label="Eventos Ativos" value={ativos} icon="calendar" />
        <Kpi label="Total Leads" value={leads.length} icon="users" />
        <Kpi label="Materiais Críticos" value={criticos} icon="box" alert={criticos > 0} />
        <Kpi label="Vendedores Ativos" value={vendAtivos} icon="briefcase" />
      </div>
      <div className="grid-2 dashboard-row" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="section-title">Leads por Serviço</div>
          {leads.length === 0 ? (
            <div className="empty">Nenhum lead registrado.</div>
          ) : (
            <div className="chart-box">
              <ChartView type="doughnut" data={doughData} options={{
                cutout: CHART_CUTOUT,
                plugins: { legend: { position: "bottom", labels: { color: "#b0b0b0", padding: 14, usePointStyle: true } } },
              }} />
            </div>
          )}
        </div>
        <div className="card">
          <div className="section-title">Próximos Eventos</div>
          {upcoming.length === 0 ? <div className="empty">Sem eventos.</div> : upcoming.map((e) => (
            <div key={e.id} className="ev-meta" style={{ justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <div>
                <div style={{ color: "var(--text)", fontWeight: 600, fontSize: 14 }}>{e.nome}</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", display:"flex", alignItems:"center", gap:4 }}><Icon name="calendar" size={12} stroke="var(--text-3)" />{fmtDate(e.dataInicio)} – {fmtDate(e.dataFim)}</div>
              </div>
              <StatusBadge s={e.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
