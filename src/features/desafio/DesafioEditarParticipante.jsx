import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { Icon } from '../../components/ui';
import { sanitizeText } from '../../lib/security';
import { maskTel } from '../../utils/masks';

// D-098: edição rápida de Nome/Telefone sobre o participante JÁ existente
// — o `id` do registro é o identificador (nunca nome/telefone), então a
// edição nunca cria um segundo participante nem mexe em tentativas,
// prêmio, evento ou ranking (updateDesafioParticipante só faz PATCH dos
// 2 campos). Mesmo padrão visual dos demais modais do projeto
// (.modal-overlay/.modal-box — ver MaterialModal.jsx), reaproveitado em
// qualquer tela administrativa que liste participantes (Cadastro,
// Ranking, Ganhadores).
export function DesafioEditarParticipante({ entry, onClose }) {
  const { updateDesafioParticipante } = useApp();
  const [nome, setNome] = useState(entry.participantName);
  const [telefone, setTelefone] = useState(entry.phone || '');
  const [erro, setErro] = useState('');

  const salvar = (e) => {
    e.preventDefault();
    const nomeLimpo = sanitizeText(nome, 120);
    if (!nomeLimpo) { setErro('Nome é obrigatório.'); return; }
    updateDesafioParticipante(entry.id, { participantName: nomeLimpo, phone: telefone.trim() }, (msg) => setErro(msg));
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Editar participante</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar"><Icon name="x" size={18} /></button>
        </div>
        <form onSubmit={salvar} className="modal-form">
          <div className="field-group">
            <label>Nome *</label>
            <input required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </div>
          <div className="field-group">
            <label>Telefone</label>
            <input value={telefone} onChange={(e) => setTelefone(maskTel(e.target.value))} placeholder="(00) 00000-0000" inputMode="numeric" />
          </div>
          {erro && <div className="form-erro">{erro}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
