import React, { useState } from 'react';
import { Icon } from '../ui';
import { useApp } from '../../hooks/useApp';
import { sanitizeText } from '../../lib/security';

export function EventModal({ onClose, evento }) {
  const { addEvento, updateEvento } = useApp();
  const [f, setF] = useState({
    nome: evento?.nome || "",
    local: evento?.local || "",
    dataInicio: evento?.dataInicio || "",
    dataFim: evento?.dataFim || "",
    tipo: evento?.tipo || "sinalizacao",
    status: evento?.status || "planejado",
    observacoes: evento?.observacoes || "",
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const submit = (e) => {
    e.preventDefault();
    const nome = sanitizeText(f.nome, 120);
    const local = sanitizeText(f.local, 200);
    const observacoes = sanitizeText(f.observacoes || "", 500);
    if (!nome || !local) return;
    if (f.dataFim && f.dataInicio && f.dataFim < f.dataInicio) {
      alert("A data de fim não pode ser anterior à data de início.");
      return;
    }
    const dados = { ...f, nome, local, observacoes };
    if (evento) updateEvento(evento.id, dados);
    else addEvento({ ...dados, materiais: [] });
    onClose();
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{evento ? "Editar Evento" : "Novo Evento"}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar"><Icon name="x" size={18} /></button>
        </div>
        <form onSubmit={submit} className="modal-form">
          <div className="field-group">
            <label>Nome do Evento *</label>
            <input required maxLength={120} value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex: Festa do Pescador" />
          </div>
          <div className="field-group">
            <label>Local *</label>
            <input required maxLength={200} value={f.local} onChange={(e) => set("local", e.target.value)} placeholder="Endereço / Praça / Espaço" />
          </div>
          <div className="field-row">
            <div className="field-group">
              <label>Data Início *</label>
              <input required type="date" value={f.dataInicio} onChange={(e) => set("dataInicio", e.target.value)} />
            </div>
            <div className="field-group">
              <label>Data Fim *</label>
              <input required type="date" value={f.dataFim} onChange={(e) => set("dataFim", e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field-group">
              <label>Tipo</label>
              <select value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>
                <option value="sinalizacao">Sinalização</option>
                <option value="presenca_comercial">Presença Comercial</option>
                <option value="ativacao_especial">Ativação Especial</option>
              </select>
            </div>
            <div className="field-group">
              <label>Status</label>
              <select value={f.status} onChange={(e) => set("status", e.target.value)}>
                <option value="planejado">Planejado</option>
                <option value="ativo">Ativo</option>
                <option value="encerrado">Encerrado</option>
              </select>
            </div>
          </div>
          <div className="field-group">
            <label>Observações</label>
            <textarea rows="3" maxLength={500} value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} placeholder="Detalhes adicionais..." />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary">{evento ? "Salvar" : "Criar Evento"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
