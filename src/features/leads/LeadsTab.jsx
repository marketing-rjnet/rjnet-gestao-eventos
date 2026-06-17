import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { servicoLabel, fmtDateLong } from '../../utils/format';
import { exportLeadsCSV, exportLeadsConsolidadoCSV } from '../../utils/csv';
import { fetchLeadsEvento, fetchLeadsEventos, db } from '../../lib/dataService';

export function LeadsTab({ session }) {
  const { eventos } = useApp();
  const [selecionados, setSelecionados] = useState([]);
  const [carregando, setCarregando] = useState(false);

  const evName = (id) => eventos.find((e) => e.id === id)?.nome || id;

  const toggle = (id) => setSelecionados((prev) =>
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
  );

  const toggleTodos = () =>
    setSelecionados(selecionados.length === eventos.length ? [] : eventos.map((e) => e.id));

  const exportarEvento = async () => {
    if (selecionados.length !== 1) return;
    setCarregando(true);
    const eventoId = selecionados[0];
    const leads = await fetchLeadsEvento(eventoId);
    setCarregando(false);
    if (!leads?.length) { alert('Nenhum lead encontrado para este evento.'); return; }
    const sufixo = evName(eventoId).replace(/\s+/g, '_');
    exportLeadsCSV(leads, sufixo, servicoLabel, evName, ({ totalRegistros }) => {
      db.registrarExportacao({
        usuarioId: session?.userId || null,
        usuarioNome: session?.nome || null,
        usuarioEmail: session?.email || null,
        filtros: { evento: eventoId },
        totalRegistros,
      });
    });
  };

  const exportarConsolidado = async () => {
    if (selecionados.length === 0) return;
    setCarregando(true);
    const leads = await fetchLeadsEventos(selecionados);
    setCarregando(false);
    if (!leads?.length) { alert('Nenhum lead encontrado nos eventos selecionados.'); return; }
    exportLeadsConsolidadoCSV(leads, evName, servicoLabel, ({ totalRegistros, totalEventos }) => {
      db.registrarExportacao({
        usuarioId: session?.userId || null,
        usuarioNome: session?.nome || null,
        usuarioEmail: session?.email || null,
        filtros: { eventos: selecionados },
        totalRegistros,
      });
    });
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">Exportar Leads</div>
          <p className="tab-desc">Selecione um ou mais eventos para exportar os leads.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn-ghost"
            style={{ fontSize: 13 }}
            onClick={exportarEvento}
            disabled={selecionados.length !== 1 || carregando}
            title="Exporta apenas o evento selecionado"
          >
            {carregando ? 'Carregando...' : '↓ Exportar evento'}
          </button>
          <button
            className="btn-primary"
            style={{ fontSize: 13 }}
            onClick={exportarConsolidado}
            disabled={selecionados.length === 0 || carregando}
            title="Exporta todos os eventos selecionados em um único CSV com coluna Evento"
          >
            {carregando ? 'Carregando...' : `↓ Exportar consolidado${selecionados.length > 0 ? ` (${selecionados.length})` : ''}`}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span className="section-title" style={{ marginBottom: 0 }}>Eventos</span>
          <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} onClick={toggleTodos}>
            {selecionados.length === eventos.length ? 'Desmarcar todos' : 'Selecionar todos'}
          </button>
        </div>
        {eventos.length === 0 ? (
          <div className="empty">Nenhum evento cadastrado.</div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Evento</th>
                  <th>Status</th>
                  <th>Início</th>
                  <th>Fim</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((ev) => (
                  <tr
                    key={ev.id}
                    onClick={() => toggle(ev.id)}
                    style={{ cursor: 'pointer', background: selecionados.includes(ev.id) ? 'var(--yellow-dim, rgba(245,192,0,0.08))' : undefined }}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={selecionados.includes(ev.id)}
                        onChange={() => toggle(ev.id)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td className="strong">{ev.nome}</td>
                    <td><span className={`badge badge-${ev.status}`}>{ev.status}</span></td>
                    <td>{fmtDateLong(ev.dataInicio)}</td>
                    <td>{fmtDateLong(ev.dataFim)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {selecionados.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-3)' }}>
            {selecionados.length} evento{selecionados.length > 1 ? 's' : ''} selecionado{selecionados.length > 1 ? 's' : ''}.
            {selecionados.length === 1 ? ' Use "Exportar evento" para CSV individual.' : ' Use "Exportar consolidado" para CSV único com coluna Evento.'}
          </div>
        )}
      </div>
    </div>
  );
}
