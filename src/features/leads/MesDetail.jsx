import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../hooks/useApp';
import { Icon, ChartView } from '../../components/ui';
import { SearchInput } from '../../components/SearchInput';
import { servicoLabel, mesReferenciaLabel } from '../../utils/format';

const darkScale = {
  x: { grid: { color: "#2e2e2e" }, ticks: { color: "#666" } },
  y: { grid: { color: "#2e2e2e" }, ticks: { color: "#666" }, beginAtZero: true },
};

const pad2 = (n) => String(n).padStart(2, "0");

// Chave local (não UTC) do dia do lead — evita virar o dia errado perto da meia-noite.
const diaKey = (isoStr) => {
  const d = new Date(isoStr);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

// "Hoje" / "Ontem" ou "06/07 — domingo" — só existem dias com lead de fato (nada de placeholder futuro).
const diaLabel = (key) => {
  const hoje = diaKey(new Date().toISOString());
  const ontemD = new Date(); ontemD.setDate(ontemD.getDate() - 1);
  const ontem = diaKey(ontemD.toISOString());
  if (key === hoje) return "Hoje";
  if (key === ontem) return "Ontem";
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString("pt-BR", { weekday: "long" });
  return `${pad2(d)}/${pad2(m)} — ${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}`;
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
  const [diasAbertos, setDiasAbertos] = useState(() => new Set());
  const diaDefaultAplicadoRef = useRef(null);

  const porVendedor = useMemo(() => {
    const c = {};
    mesLeads.forEach((l) => { c[l.vendedorNome] = (c[l.vendedorNome] || 0) + 1; });
    return c;
  }, [mesLeads]);

  // Agrupa por dia real do lead (criadoEm) — dias sem lead simplesmente não existem
  // no agrupamento, e um dia novo aparece sozinho assim que o primeiro lead entra nele.
  const grupos = useMemo(() => {
    const map = new Map();
    mesLeads.forEach((l) => {
      const key = diaKey(l.criadoEm);
      if (!map.has(key)) map.set(key, { key, leads: [] });
      map.get(key).leads.push(l);
    });
    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [mesLeads]);

  // Ao trocar de mês (ou quando os leads terminam de carregar), abre só o dia mais recente por padrão.
  useEffect(() => {
    if (diaDefaultAplicadoRef.current === mesReferencia) return;
    if (grupos.length === 0) return;
    setDiasAbertos(new Set([grupos[0].key]));
    diaDefaultAplicadoRef.current = mesReferencia;
  }, [mesReferencia, grupos]);

  const toggleDia = (key) => {
    setDiasAbertos((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

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
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              {grupos.map((grupo) => {
                const buscaAtiva = buscaLead.trim().length > 0;
                const leadsFiltrados = buscaAtiva
                  ? grupo.leads.filter((l) => l.nome.toLowerCase().includes(buscaLead.toLowerCase()))
                  : grupo.leads;
                if (buscaAtiva && leadsFiltrados.length === 0) return null;
                const isOpen = buscaAtiva || diasAbertos.has(grupo.key);
                return (
                  <div className="card" key={grupo.key} style={{ padding: 0, overflow: "hidden" }}>
                    <button
                      onClick={() => toggleDia(grupo.key)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        width: "100%", padding: "14px 16px", gap: 10,
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
                        <span style={{
                          display: "inline-flex",
                          transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                          transition: "transform .15s ease",
                        }}>
                          <Icon name="arrow_right" size={13} stroke="var(--text-3)" />
                        </span>
                        {diaLabel(grupo.key)}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>
                        {grupo.leads.length} lead{grupo.leads.length !== 1 ? "s" : ""}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="tbl-wrap" style={{ boxShadow: "none", borderRadius: 0, borderTop: "1px solid var(--border)" }}>
                        <table>
                          <thead><tr><th>Nome</th><th>Telefone</th><th>Endereço</th><th>Serviço</th><th>Vendedor</th></tr></thead>
                          <tbody>
                            {leadsFiltrados.map((l) => (
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
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
