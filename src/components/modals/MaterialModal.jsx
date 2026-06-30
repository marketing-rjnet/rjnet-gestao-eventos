import React, { useState } from 'react';
import { Icon } from '../ui';
import { useApp } from '../../hooks/useApp';
import { sanitizeText } from '../../lib/security';

export function MaterialModal({ onClose, material }) {
  const { addMaterial, updateMaterial } = useApp();
  const isEdit = Boolean(material);
  const [f, setF] = useState(() =>
    isEdit
      ? { nome: material.nome, quantidade: material.quantidade, descricao: material.descricao || '' }
      : { nome: '', quantidade: 1, descricao: '' }
  );
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const submit = (e) => {
    e.preventDefault();
    const nome = sanitizeText(f.nome, 120);
    const qtd = parseInt(f.quantidade, 10);
    if (!nome) return;
    if (!qtd || qtd < 1 || qtd > 9999) { alert("Quantidade inválida. Informe um número entre 1 e 9999."); return; }
    const payload = { ...f, nome, descricao: sanitizeText(f.descricao || "", 300), quantidade: qtd };
    if (isEdit) {
      updateMaterial(material.id, payload);
    } else {
      addMaterial(payload);
    }
    onClose();
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Editar Material' : 'Adicionar Material'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar"><Icon name="x" size={18} /></button>
        </div>
        <form onSubmit={submit} className="modal-form">
          <div className="field-group">
            <label>Nome *</label>
            <input required maxLength={120} value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex: Wind Banner 2m" autoFocus />
          </div>
          <div className="field-group">
            <label>Quantidade *</label>
            <input required type="number" min="1" value={f.quantidade} onChange={(e) => set("quantidade", e.target.value)} />
          </div>
          <div className="field-group">
            <label>Descrição</label>
            <input value={f.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Opcional" />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary">{isEdit ? 'Salvar' : 'Adicionar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
