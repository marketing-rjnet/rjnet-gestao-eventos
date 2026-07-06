import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../hooks/useApp';
import { Icon, ChartView } from '../../components/ui';
import { SearchInput } from '../../components/SearchInput';
import { servicoLabel, mesReferenciaLabel } from '../../utils/format';

const darkScale = {
  x: { grid: { color: "#2e2e2e" }, ticks: { color: "#666" } },
  y: { grid: { color: "#2e2e2e" }, ticks: { color: "#666" }, beginAtZero: true },
};

// D-060: espelha EventDetail.jsx (gráfico "leads por vendedor" + tabela),
// sem a parte de materiais — mês de referência não tem estoque alocado.
export default function MesDetail({ mesReferencia, onBack }) {
  const { getLeadsMes, carregarLeadsMes } = useApp();

  useEffect(() => {
    carregarLeadsMes(mesReferencia);
  }, [mesReferencia]);

  const mesLeads = getLeadsMes(mesReferencia);
  const [buscaLead, setBuscaLead] = useState("");

  const porVendedor = useMemo(() => {
    const c = {};
    mesLeads.forEach((l) => { c[l.vendedorNome] = (c[l.vendedorNome] || 0) + 1; });
    return c;
  }, [mesLeads]);

  const barData = {
    labels: Object.keys(porVendedor),
    datasets: [{ label: "Leads", data: Object.values(porVendedor), backgroundColor: "#ffcb00", borderRadius: 6 }],
  };

  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button className="back-btn" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="back" size={15} /> Voltar para o Início
        </button>
      </div>

      <div className="detail-hero">
        <h1>Atividade do Mês — {mesReferenciaLabel(mesReferencia)}</h1>
      </div>

      <div className="grid-2" style={{ marginTop: 18 }}>
        <div className="mini-stat"><div className="ms-v">{mesLeads.length}</div><div className="ms-l">Leads captados</div></div>
        <div className="mini-stat"><div className="ms-v">{Object.keys(porVendedor).length}</div><div className="ms-l">Vendedores ativos</div></div>
      </div>

      <div className="section">
        <div className="section-title">Leads Captados</div>
        {mesLeads.length === 0 ? <div className="empty">Nenhum lead captado neste mês.</div> : (
          <>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title">Leads por Vendedor</div>
              <div className="chart-box sm">
                <ChartView type="bar" data={barData} options={{
                  plugins: { legend: { display: false } },
                  scales: darkScale,
                }} />
              </div>
            </div>
            <SearchInput
              value={buscaLead}
              onChange={setBuscaLead}
              placeholder="Buscar lead por nome…"
              onClear={() => setBuscaLead("")}
            />
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Nome</th><th>Telefone</th><th>Endereço</th><th>Serviço</th><th>Vendedor</th></tr></thead>
                <tbody>
                  {mesLeads
                    .filter((l) => !buscaLead.trim() || l.nome.toLowerCase().includes(buscaLead.toLowerCase()))
                    .map((l) => (
                    <tr key={l.id}>
                      <td className="strong">{l.nome}</td>
                      <td className="mono">{l.telefone}</td>
                      <td>{l.endereco}</td>
                      <td><span className="badge badge-tipo">{servicoLabel(l.servicoInteresse)}</span></td>
                      <td>{l.vendedorNome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
