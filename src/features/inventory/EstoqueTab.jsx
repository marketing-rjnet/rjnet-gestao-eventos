import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { Icon, Kpi } from '../../components/ui';
import { MaterialModal } from '../../components/modals';
import { NIVEL_ESTOQUE } from '../../lib/constants';

export function EstoqueTab() {
  const { getMateriaisDisponiveis } = useApp();
  const [showModal, setShowModal] = useState(false);
  const list = getMateriaisDisponiveis();
  const totalItens = list.reduce((a, m) => a + m.material.quantidade, 0);
  const emCampo = list.reduce((a, m) => a + m.emCampo, 0);
  const crit = list.filter((m) => m.disponivel <= 0);
  const warn = list.filter((m) => m.disponivel >= 1 && m.disponivel <= 3);
  const ok = list.filter((m) => m.disponivel >= 4);

  const Group = ({ title, dot, cls, rows }) => rows.length === 0 ? null : (
    <div className="stock-group">
      <h3><Icon name={dot} size={10} /> {title} <span style={{ color: "var(--text-3)", fontWeight: 400 }}>({rows.length})</span></h3>
      {rows.map((m) => (
        <div key={m.material.id} className={"stock-row " + cls}>
          <div className="sr-main">
            <div className="sr-name">{m.material.nome}</div>
            <div className="sr-desc">{m.material.descricao || "Sem descrição"}</div>
          </div>
          <div className="sr-num"><b>{m.material.quantidade}</b>total</div>
          <div className="sr-num"><b>{m.emCampo}</b>em campo</div>
          <div className="sr-num">
            <span className={"badge badge-" + (cls === NIVEL_ESTOQUE.CRIT ? NIVEL_ESTOQUE.CRIT : cls === NIVEL_ESTOQUE.WARN ? NIVEL_ESTOQUE.WARN : NIVEL_ESTOQUE.OK)}>{m.disponivel} disp.</span>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">Estoque</div>
          <p className="tab-desc">Controle de materiais e disponibilidade em tempo real.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ Adicionar Material</button>
      </div>

      <div className="grid-kpi-3">
        <Kpi label="Total Tipos" value={list.length} icon="box" />
        <Kpi label="Total Itens" value={totalItens} icon="🔢" />
        <Kpi label="Em Campo" value={emCampo} icon="🚚" />
      </div>

      <Group title="CRÍTICO" dot="dot_red" cls={NIVEL_ESTOQUE.CRIT} rows={crit} />
      <Group title="ATENÇÃO" dot="dot_yellow" cls={NIVEL_ESTOQUE.WARN} rows={warn} />
      <Group title="OK" dot="dot_green" cls={NIVEL_ESTOQUE.OK} rows={ok} />

      {showModal && <MaterialModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
