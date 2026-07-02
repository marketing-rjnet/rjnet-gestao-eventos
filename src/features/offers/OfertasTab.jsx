import { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { Icon } from '../../components/ui';
import { OfertaModal } from '../../components/modals';
import { SERVICO_LABEL } from '../../utils/format';

export function OfertasTab() {
  const { getOferta, removeOferta } = useApp();
  const [editServico, setEditServico] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">Ofertas</div>
          <p className="tab-desc">Uma oferta ativa por serviço — imagem + mensagem prontas para o vendedor enviar via WhatsApp.</p>
        </div>
      </div>

      <div className="stock-group">
        {Object.keys(SERVICO_LABEL).map((servico) => {
          const oferta = getOferta(servico);
          return (
            <div key={servico} className="stock-row">
              <div className="sr-main">
                <div className="sr-name">{SERVICO_LABEL[servico]}</div>
                <div className="sr-desc">
                  {oferta?.copy ? oferta.copy.slice(0, 60) + (oferta.copy.length > 60 ? '…' : '') : 'Sem oferta configurada'}
                </div>
              </div>
              {oferta?.imagemUrl && (
                <img src={oferta.imagemUrl} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
              )}
              <div className="sr-num" style={{ minWidth: 0 }}>
                {confirmDelete === servico ? (
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <button className="btn-ghost" style={{ fontSize: 11, padding: '2px 6px', color: 'var(--red)' }} onClick={() => { removeOferta(servico); setConfirmDelete(null); }}>Confirmar</button>
                    <button className="btn-ghost" style={{ fontSize: 11, padding: '2px 6px' }} onClick={() => setConfirmDelete(null)}>Cancelar</button>
                  </span>
                ) : (
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <button className="btn-ghost" style={{ fontSize: 11, padding: '2px 6px', color: 'var(--text-3)' }} onClick={() => setEditServico(servico)}>
                      {oferta ? 'Editar' : 'Configurar'}
                    </button>
                    {oferta && (
                      <button className="btn-ghost" style={{ fontSize: 11, padding: '2px 6px', color: 'var(--text-3)' }} title="Remover oferta" onClick={() => setConfirmDelete(servico)}>
                        <Icon name="trash" size={14} />
                      </button>
                    )}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editServico && <OfertaModal servico={editServico} oferta={getOferta(editServico)} onClose={() => setEditServico(null)} />}
    </div>
  );
}
