import React, { useState } from 'react';
import { Icon } from '../ui';
import { useApp } from '../../hooks/useApp';
import { sanitizeText } from '../../lib/security';

const CHECKLIST_INICIAL = [
  { nome: 'Caixas RJNet de madeira',      quantidade: 12 },
  { nome: 'Banco preto dobrável',          quantidade: 3  },
  { nome: 'Base windbanner',               quantidade: 19 },
  { nome: 'Peça esconde fio',              quantidade: 13 },
  { nome: 'Base ferro windbanner 5m',      quantidade: 4  },
  { nome: 'Base ferro windbanner 2m',      quantidade: 2  },
  { nome: 'Mochila pirolito',              quantidade: 2  },
  { nome: 'Minibanner Conheça RJNet 5G Air', quantidade: 10 },
  { nome: 'Banqueta amarela',              quantidade: 2  },
  { nome: 'Escada dobrável',              quantidade: 1  },
  { nome: 'Saco de areia (base)',          quantidade: 7  },
  { nome: 'Windbanner',                    quantidade: 8  },
  { nome: 'Dado de esportes',              quantidade: 1  },
  { nome: 'Caixa para sorteio',            quantidade: 1  },
];

export function MaterialChecklistModal({ onClose }) {
  const { addMaterial } = useApp();
  const [items, setItems] = useState(
    CHECKLIST_INICIAL.map((it, i) => ({ ...it, id: i, selecionado: true, editando: false }))
  );

  const toggle = (id) =>
    setItems((p) => p.map((it) => (it.id === id ? { ...it, selecionado: !it.selecionado } : it)));

  const setQtd = (id, v) =>
    setItems((p) => p.map((it) => (it.id === id ? { ...it, quantidade: Math.max(1, Number(v) || 1) } : it)));

  const selecionados = items.filter((it) => it.selecionado);

  const importar = () => {
    selecionados.forEach((it) => {
      addMaterial({ nome: sanitizeText(it.nome, 120), quantidade: it.quantidade, descricao: '' });
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Importar Inventário</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar"><Icon name="x" size={18} /></button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 12px' }}>
          Marque os materiais que deseja adicionar ao estoque. Ajuste as quantidades se necessário.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => setItems((p) => p.map((it) => ({ ...it, selecionado: true })))}>
            Selecionar todos
          </button>
          <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => setItems((p) => p.map((it) => ({ ...it, selecionado: false })))}>
            Desmarcar todos
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((it) => (
            <label key={it.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
              background: it.selecionado ? 'var(--surface-2)' : 'transparent',
              border: '1px solid ' + (it.selecionado ? 'var(--border-focus)' : 'var(--border)'),
              opacity: it.selecionado ? 1 : 0.5,
            }}>
              <input
                type="checkbox"
                checked={it.selecionado}
                onChange={() => toggle(it.id)}
                style={{ width: 16, height: 16, accentColor: 'var(--accent)', flexShrink: 0 }}
              />
              <span style={{ flex: 1, fontSize: 14 }}>{it.nome}</span>
              <input
                type="number"
                min="1"
                value={it.quantidade}
                disabled={!it.selecionado}
                onChange={(e) => setQtd(it.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{ width: 60, textAlign: 'center', fontSize: 13 }}
              />
            </label>
          ))}
        </div>

        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="btn-primary"
            disabled={selecionados.length === 0}
            onClick={importar}
          >
            Adicionar {selecionados.length > 0 ? `${selecionados.length} ` : ''}materiais
          </button>
        </div>
      </div>
    </div>
  );
}
