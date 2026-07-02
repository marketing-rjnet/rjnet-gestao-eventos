import { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { Icon, StatusBadge, TipoBadge } from '../../components/ui';
import { EmptyState } from '../../components/EmptyState';

import { EventModal } from '../../components/modals';
import { fmtDate, initials, STATUS_LABEL } from '../../utils/format';
import { AVATARS_SHOWN } from '../../lib/constants';

export default function EventosTab({ onOpen }) {
  const { eventos, getLeadsEvento } = useApp();
  const [filter, setFilter] = useState("ativo");
  const [showModal, setShowModal] = useState(false);

  const filtered = eventos.filter((e) => filter === "todos" || e.status === filter);
  const vendoresDoEvento = (eid) => [...new Set(getLeadsEvento(eid).map((l) => l.vendedorNome))];

  return (
    <div className="page">
      <div className="page-head">
        <div className="chips">
          {["ativo", "planejado", "encerrado", "todos"].map((c) => (
            <button key={c} className={"chip" + (filter === c ? " active" : "")} onClick={() => setFilter(c)}>
              {c === "todos" ? "Todos" : STATUS_LABEL[c]}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ Novo Evento</button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="Nenhum evento encontrado"
          description={filter === "ativo" ? "Não há eventos ativos no momento. Mude o filtro ou crie um novo evento." : "Nenhum evento neste status."}
        />
      ) : (
        <div className="event-grid">
          {filtered.map((e) => {
            const vs = vendoresDoEvento(e.id);
            return (
              <div key={e.id} className="event-card" onClick={() => onOpen(e.id)} style={{ borderLeft: `3px solid ${e.status === 'ativo' ? 'var(--yellow)' : e.status === 'planejado' ? 'var(--text-3)' : 'var(--border-2)'}` }}>
                <span className="ev-status"><StatusBadge s={e.status} /></span>
                <div className="ev-name">{e.nome}</div>
                <div className="ev-meta"><Icon name="pin" size={13} stroke="var(--text-3)" /> {e.local}</div>
                <div className="ev-meta"><Icon name="calendar" size={13} stroke="var(--text-3)" /> {fmtDate(e.dataInicio)} – {fmtDate(e.dataFim)}</div>
                <div style={{ marginTop: 10 }}><TipoBadge t={e.tipo} /></div>
                <div className="ev-foot">
                  <span className="ev-leads"><Icon name="users" size={13} stroke="var(--text-3)" /> <b>{getLeadsEvento(e.id).length}</b> leads</span>
                  <div className="avatars">
                    {vs.slice(0, AVATARS_SHOWN).map((n, i) => <div key={i} className="av">{initials(n)}</div>)}
                    {vs.length > AVATARS_SHOWN && <div className="av av-overflow">+{vs.length - AVATARS_SHOWN}</div>}
                    {vs.length === 0 && <span style={{ fontSize: 12, color: "var(--text-3)" }}>—</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && <EventModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
