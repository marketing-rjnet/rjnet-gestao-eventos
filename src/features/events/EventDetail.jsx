import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../hooks/useApp';
import { Icon, StatusBadge, TipoBadge, ChartView } from '../../components/ui';
import { EventModal } from '../../components/modals';
import { fmtDateLong, servicoLabel } from '../../utils/format';
import { NIVEL_ESTOQUE } from '../../lib/constants';

const darkScale = {
  x: { grid: { color: "#2e2e2e" }, ticks: { color: "#666" } },
  y: { grid: { color: "#2e2e2e" }, ticks: { color: "#666" }, beginAtZero: true },
};

export default function EventDetail({ eventoId, onBack }) {
  const { eventos, materiais, getLeadsEvento, getMateriaisDisponiveis,
          addMaterialEvento, removeMaterialEvento, toggleRetornadoEvento, updateEvento,
          removeEvento, carregarLeadsEvento } = useApp();
  useEffect(() => {
    carregarLeadsEvento(eventoId);
  }, [eventoId]);

  const ev = eventos.find((e) => e.id === eventoId);
  if (!ev) return null;

  const evLeads = getLeadsEvento(eventoId);
  const disp = getMateriaisDisponiveis();
  const matName = (id) => materiais.find((m) => m.id === id)?.nome || id;
  const emCampo = ev.materiais.filter((m) => !m.retornado).reduce((a, m) => a + m.quantidade, 0);

  const [addMatId, setAddMatId] = useState("");
  const [addMatQtd, setAddMatQtd] = useState(1);
  const [showAddMat, setShowAddMat] = useState(false);
  const [editEvento, setEditEvento] = useState(false);

  const matsDisponiveis = materiais.filter(
    (m) => !ev.materiais.find((em) => em.materialId === m.id)
  );

  const handleAddMat = (e) => {
    e.preventDefault();
    if (!addMatId) return;
    addMaterialEvento(eventoId, addMatId, addMatQtd);
    setAddMatId(""); setAddMatQtd(1); setShowAddMat(false);
  };

  const porVendedor = useMemo(() => {
    const c = {};
    evLeads.forEach((l) => { c[l.vendedorNome] = (c[l.vendedorNome] || 0) + 1; });
    return c;
  }, [evLeads]);

  const barData = {
    labels: Object.keys(porVendedor),
    datasets: [{ label: "Leads", data: Object.values(porVendedor), backgroundColor: "#ffcb00", borderRadius: 6 }],
  };

  return (
    <div className="page">
      {/* Back + Edit + Finalizar */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: 14 }}>
        <button className="back-btn" onClick={onBack} style={{ display:"flex", alignItems:"center", gap:6 }}>
          <Icon name="back" size={15} /> Voltar para Eventos
        </button>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn-ghost" style={{ fontSize:13 }} onClick={() => setEditEvento(true)}>
            Editar Evento
          </button>
          {ev.status !== "encerrado" && (
            <button
              className="btn-ghost"
              style={{ fontSize:13, color:"var(--yellow)", borderColor:"var(--yellow)" }}
              onClick={() => {
                if (confirm(`Finalizar o evento "${ev.nome}"? O evento será marcado como encerrado e todos os dados serão preservados.`)) {
                  updateEvento(eventoId, { status: "encerrado" });
                  onBack();
                }
              }}
            >
              Finalizar Evento
            </button>
          )}
          {ev.status !== "ativo" && (
            <button
              className="btn-ghost"
              style={{ fontSize:13, color:"var(--red)", borderColor:"var(--red)" }}
              onClick={() => {
                if (confirm(`Excluir permanentemente o evento "${ev.nome}"?\n\nEsta ação não pode ser desfeita. Os leads associados também serão removidos.`)) {
                  removeEvento(eventoId);
                  onBack();
                }
              }}
            >
              Excluir Evento
            </button>
          )}
        </div>
      </div>

      <div className="detail-hero">
        <h1>{ev.nome}</h1>
        <StatusBadge s={ev.status} />
        <TipoBadge t={ev.tipo} />
      </div>

      <div className="grid-2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="section-title">Informações</div>
          <div className="info-line"><span className="k">Local</span><span className="v" style={{ display:"flex", alignItems:"center", gap:5 }}><Icon name="pin" size={13} stroke="var(--text-3)" />{ev.local}</span></div>
          <div className="info-line"><span className="k">Datas</span><span className="v" style={{ display:"flex", alignItems:"center", gap:5 }}><Icon name="calendar" size={13} stroke="var(--text-3)" />{fmtDateLong(ev.dataInicio)} → {fmtDateLong(ev.dataFim)}</span></div>
          <div className="info-line"><span className="k">Observações</span><span className="v">{ev.observacoes || "—"}</span></div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div className="mini-stat"><div className="ms-v">{evLeads.length}</div><div className="ms-l">Leads captados</div></div>
          <div className="mini-stat"><div className="ms-v">{emCampo}</div><div className="ms-l">Materiais em campo</div></div>
        </div>
      </div>

      {/* ── MATERIAIS ── */}
      <div className="section">
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <span className="section-title" style={{ marginBottom:0 }}>Materiais</span>
          <button className="btn-primary" style={{ fontSize:12, padding:"7px 14px" }}
            onClick={() => setShowAddMat((v) => !v)}>
            {showAddMat ? "Cancelar" : "+ Adicionar Material"}
          </button>
        </div>

        {showAddMat && (
          <form onSubmit={handleAddMat} className="inline-form-card" style={{ marginBottom:14 }}>
            <div className="field-row" style={{ alignItems:"flex-end", gap:10 }}>
              <div className="field-group" style={{ marginBottom:0, flex:2 }}>
                <label>Material *</label>
                <select required value={addMatId} onChange={(e) => setAddMatId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {matsDisponiveis.map((m) => {
                    const d = disp.find((x) => x.material.id === m.id);
                    return <option key={m.id} value={m.id}>{m.nome} (disponível: {d ? d.disponivel : 0})</option>;
                  })}
                  {matsDisponiveis.length === 0 && <option disabled>Todos os materiais já adicionados</option>}
                </select>
              </div>
              <div className="field-group" style={{ marginBottom:0, flex:1 }}>
                <label>Quantidade *</label>
                <input type="number" min="1" required value={addMatQtd} onChange={(e) => setAddMatQtd(e.target.value)} />
              </div>
              <button type="submit" className="btn-primary" style={{ height:42, padding:"0 18px", whiteSpace:"nowrap" }}>Confirmar</button>
            </div>
          </form>
        )}

        {ev.materiais.length === 0 ? (
          <div className="empty">Nenhum material vinculado. Clique em + Adicionar Material para começar.</div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Qtd.</th>
                  <th>Estoque Total</th>
                  <th>Disponível</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {ev.materiais.map((m, i) => {
                  const d = disp.find((x) => x.material.id === m.materialId);
                  const dv = d ? d.disponivel : 0;
                  const cls = dv <= 0 ? NIVEL_ESTOQUE.CRIT : dv <= 3 ? NIVEL_ESTOQUE.WARN : NIVEL_ESTOQUE.OK;
                  return (
                    <tr key={`${m.materialId}_${i}`} style={{ opacity: m.retornado ? .5 : 1 }}>
                      <td className="strong" style={{ textDecoration: m.retornado ? "line-through" : "none" }}>
                        {matName(m.materialId)}
                      </td>
                      <td>{m.quantidade}</td>
                      <td>{d ? d.material.quantidade : "—"}</td>
                      <td><span className={"badge badge-" + cls}>{dv}</span></td>
                      <td>
                        {m.retornado ? (
                          <span style={{ display:"flex", alignItems:"center", gap:5, color:"var(--green)", fontWeight:600, fontSize:12 }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            Devolvido
                          </span>
                        ) : (
                          <button
                            onClick={() => { if(confirm(`Confirmar devolução de "${matName(m.materialId)}"?`)) toggleRetornadoEvento(eventoId, i); }}
                            className="btn-check-devolucao"
                            title="Confirmar devolução"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            Confirmar devolução
                          </button>
                        )}
                      </td>
                      <td>
                        {!m.retornado && (
                          <button
                            onClick={() => { if(confirm("Remover este material do evento?")) removeMaterialEvento(eventoId, i); }}
                            style={{ color:"var(--red)", fontSize:13, padding:"4px 8px" }}
                            title="Remover material"
                          >
                            <Icon name="x" size={14} stroke="var(--red)" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── LEADS ── */}
      <div className="section">
        <div className="section-title">Leads Captados</div>
        {evLeads.length === 0 ? <div className="empty">Nenhum lead captado neste evento.</div> : (
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
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Nome</th><th>Telefone</th><th>Endereço</th><th>Serviço</th><th>Vendedor</th></tr></thead>
                <tbody>
                  {evLeads.map((l) => (
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

      {editEvento && <EventModal evento={ev} onClose={() => setEditEvento(false)} />}
    </div>
  );
}
