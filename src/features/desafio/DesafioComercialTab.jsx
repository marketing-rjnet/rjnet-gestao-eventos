import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { Icon } from '../../components/ui';
import { centesimosParaTempo } from '../../lib/desafioCronometro';
import { DesafioDetail } from './DesafioDetail';

// Desafio RJNet — Acerte 00:03:33 (D-101): o comercial não gerencia o
// Desafio — cadastro de participantes, tentativas, ranking, entrega de
// prêmio e configuração continuam exclusivos do marketing (RLS de escrita
// não mudou, D-089 mantido). Só a LEITURA foi ampliada: o comercial enxerga
// os dias já criados pelo marketing e pode ver as estatísticas + exportar o
// CSV de cada um — mesmo espírito de "relatório" já dado a Eventos/Ofertas
// pelo D-059. Reaproveita DesafioDetail restringindo as sub-abas a só
// "Painel" (DesafioDashboard.jsx), a única tela do módulo 100% leitura.
const SUB_TABS_COMERCIAL = [{ id: 'dashboard', label: 'Painel', ico: 'activity' }];

export function DesafioComercialTab() {
  const { desafios } = useApp();
  const [abertoId, setAbertoId] = useState(null);

  if (abertoId) {
    const desafio = desafios.find((d) => d.id === abertoId);
    if (desafio) {
      return (
        <DesafioDetail
          desafio={desafio}
          onBack={() => setAbertoId(null)}
          subTabs={SUB_TABS_COMERCIAL}
          initialSub="dashboard"
        />
      );
    }
    setAbertoId(null);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">Desafio RJNET</div>
          <p className="tab-desc">
            🎯 Estatísticas e exportação em CSV dos dias do desafio criados pelo marketing — cadastro de
            participantes e configuração continuam exclusivos do marketing.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <span className="section-title">Dias do desafio</span>
        {desafios.length === 0 ? (
          <div className="empty" style={{ padding: '20px 0' }}>Nenhum dia criado ainda.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {desafios.map((d) => (
              <div
                key={d.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
                  gap: 8, border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px',
                }}
              >
                <div>
                  <div className="strong">{d.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    Alvo: <span className="mono">{centesimosParaTempo(d.targetCentiseconds)}</span>
                    {' '}· {d.ativo ? 'ativo' : 'encerrado'}
                  </div>
                </div>
                <button type="button" className="btn-primary" style={{ fontSize: 12 }} onClick={() => setAbertoId(d.id)}>
                  <Icon name="activity" size={14} /> Ver / Exportar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
