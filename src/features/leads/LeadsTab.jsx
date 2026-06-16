import React, { useState, useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { Kpi, ChartView } from '../../components/ui';
import { SERVICO_LABEL, servicoLabel } from '../../utils/format';
import { exportLeadsCSV } from '../../utils/csv';
import { db } from '../../lib/dataService';

const darkScale = {
  x: { grid: { color: "#2e2e2e" }, ticks: { color: "#666" } },
  y: { grid: { color: "#2e2e2e" }, ticks: { color: "#666" }, beginAtZero: true },
};

export function LeadsTab({ session }) {
  const { leads, eventos } = useApp();
  const [fEvento, setFEvento] = useState("");
  const [fVend, setFVend] = useState("");
  const [fServ, setFServ] = useState("");
  const evName = (id) => eventos.find((e) => e.id === id)?.nome || id;

  const hasServico = (l, s) => Array.isArray(l.servicoInteresse) ? l.servicoInteresse.includes(s) : l.servicoInteresse === s;

  const filtered = leads.filter((l) =>
    (!fEvento || l.eventoId === fEvento) &&
    (!fVend || l.vendedorNome === fVend) &&
    (!fServ || hasServico(l, fServ))
  );

  const byService = (s) => leads.filter((l) => hasServico(l, s)).length;

  const exportarCSV = () => {
    const dados = filtered.length > 0 ? filtered : leads;
    const sufixo = fEvento ? evName(fEvento).replace(/\s+/g, "_") : "todos_eventos";
    const filtros = {
      evento: fEvento || null,
      vendedor: fVend || null,
      servico: fServ || null,
    };
    exportLeadsCSV(dados, sufixo, servicoLabel, evName, ({ totalRegistros }) => {
      db.registrarExportacao({
        usuarioId:    session?.userId   || null,
        usuarioNome:  session?.nome     || null,
        usuarioEmail: session?.email    || null,
        filtros,
        totalRegistros,
      });
    });
  };

  const porEvento = useMemo(() => {
    const c = {};
    leads.forEach((l) => { c[l.eventoId] = (c[l.eventoId] || 0) + 1; });
    return c;
  }, [leads]);

  const barData = {
    labels: Object.keys(porEvento).map(evName),
    datasets: [{ label: "Leads", data: Object.values(porEvento), backgroundColor: "#f5c000", borderRadius: 6 }],
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">Leads</div>
          <p className="tab-desc">Todos os leads captados pela equipe comercial.</p>
        </div>
        <button
          className="btn-primary"
          style={{ display:"flex", alignItems:"center", gap:6, fontSize:13 }}
          onClick={exportarCSV}
          disabled={leads.length === 0}
        >
          ↓ Exportar CSV {fEvento ? `(${evName(fEvento)})` : "(todos)"}
        </button>
      </div>

      <div className="grid-kpi">
        <Kpi label="Total" value={leads.length} icon="users" />
        <Kpi label="Fibra Res" value={byService("fibra_residencial")} icon="🏠" />
        <Kpi label="Fibra Emp" value={byService("fibra_empresarial")} icon="🏢" />
        <Kpi label="Hotspot" value={byService("hotspot")} icon="📶" />
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="section-title">Leads por Evento</div>
        {leads.length === 0 ? <div className="empty">Sem dados.</div> : (
          <div className="chart-box">
            <ChartView type="bar" data={barData} options={{
              indexAxis: "y",
              plugins: { legend: { display: false } },
              scales: darkScale,
            }} />
          </div>
        )}
      </div>

      <div className="section">
        <div className="filter-row">
          <select value={fEvento} onChange={(e) => setFEvento(e.target.value)}>
            <option value="">Todos os eventos</option>
            {eventos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
          <select value={fVend} onChange={(e) => setFVend(e.target.value)}>
            <option value="">Todos os vendedores</option>
            {[...new Set(leads.map((l) => l.vendedorNome).filter(Boolean))].sort().map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <select value={fServ} onChange={(e) => setFServ(e.target.value)}>
            <option value="">Todos os serviços</option>
            {Object.keys(SERVICO_LABEL).map((s) => <option key={s} value={s}>{SERVICO_LABEL[s]}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? <div className="empty">Nenhum lead encontrado.</div> : (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Nome</th><th>Telefone</th><th>Endereço</th><th>Serviço</th><th>Evento</th><th>Vendedor</th></tr></thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id}>
                    <td className="strong">{l.nome}</td>
                    <td className="mono">{l.telefone}</td>
                    <td>{l.endereco}</td>
                    <td><span className="badge badge-tipo">{servicoLabel(l.servicoInteresse)}</span></td>
                    <td>{evName(l.eventoId)}</td>
                    <td>{l.vendedorNome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
