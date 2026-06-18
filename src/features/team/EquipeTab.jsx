import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { sanitizeText } from '../../lib/security';
import { RECENT_EVENTS_SHOWN } from '../../lib/constants';
import { fmtDate, initials } from '../../utils/format';

export default function EquipeTab() {
  const { vendedores, leads, eventos, addVendedor, toggleVendedor } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [novoNome, setNovoNome] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (novoNome.trim()) {
      addVendedor(sanitizeText(novoNome, 80));
      setNovoNome(""); setShowForm(false);
    }
  };

  const leadsDoVendedor = (n) => leads.filter((l) => l.vendedorNome === n);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">Equipe</div>
          <p className="tab-desc">Gerencie os acessos da equipe. Cada pessoa entra com o próprio e-mail e senha; o papel define o que ela pode ver e fazer.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>+ Adicionar Vendedor</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="inline-form-card">
          <div className="field-row">
            <div className="field-group">
              <label>Nome completo *</label>
              <input required maxLength={80} value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex: Pedro Souza" autoFocus />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">Adicionar</button>
          </div>
        </form>
      )}

      <div className="vendor-grid">
        {vendedores.map((v) => {
          const vl = leadsDoVendedor(v.nome);
          const recent = [...eventos]
            .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio))
            .slice(-RECENT_EVENTS_SHOWN)
            .map((ev) => ({ ev, n: vl.filter((l) => l.eventoId === ev.id).length }));
          return (
            <div key={v.id} className="vendor-card">
              <div className="v-av">{initials(v.nome)}</div>
              <div className="v-name">{v.nome}</div>
              <div className="v-badge">
                <span className={"badge " + (v.ativo ? "badge-ativo" : "badge-encerrado")}>{v.ativo ? "Ativo" : "Inativo"}</span>
              </div>
              <div className="v-cap">leads captados</div>
              <div className="v-big">{vl.length}</div>
              {recent.some((r) => r.n > 0) && (
                <div className="v-recent-events">
                  {recent.map((r) => (
                    <span key={r.ev.id} className="v-event-stat" title={r.ev.nome}>
                      <span className="v-event-date">{fmtDate(r.ev.dataInicio)}</span>
                      <span className="v-event-count">{r.n}</span>
                    </span>
                  ))}
                </div>
              )}
              <div className="v-actions">
                <button className="btn-ghost vendor-toggle" onClick={() => toggleVendedor(v.id)}>
                  {v.ativo ? "Desativar" : "Ativar"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
