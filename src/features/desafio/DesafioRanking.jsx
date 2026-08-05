import React, { useMemo, useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { Icon } from '../../components/ui';
import { centesimosParaTempo } from '../../lib/desafioCronometro';

// Desafio RJNet — Acerte 00:03:33 (D-089): ranking administrativo do dia.
// Regras (espelham a RPC pública timer_challenge_painel_publico):
// ganhadores instantâneos (isExactHit) NUNCA aparecem aqui — eles têm
// lista própria (DesafioGanhadores.jsx). Ordenação: menor diferença
// primeiro, depois o cadastro mais antigo. Mostra só o Top 10.
export function DesafioRanking({ desafio, entries }) {
  const { removeDesafioEntry } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(null);
  const ranking = useMemo(() => entries
    .filter((e) => !e.isExactHit)
    .sort((a, b) => a.differenceCentiseconds - b.differenceCentiseconds || new Date(a.criadoEm) - new Date(b.criadoEm))
    .slice(0, 10),
  [entries]);

  return (
    <div className="card">
      <span className="section-title">Ranking — Top 10 mais próximos</span>
      <p className="campo-hint" style={{ marginTop: 4 }}>
        Alvo: <span className="mono">{centesimosParaTempo(desafio.targetCentiseconds)}</span> — quanto menor a diferença, melhor a colocação.
      </p>
      {ranking.length === 0 ? (
        <div className="empty" style={{ padding: '20px 0' }}>Nenhum participante no ranking ainda.</div>
      ) : (
        <div className="tbl-wrap" style={{ marginTop: 10 }}>
          <table>
            <thead>
              <tr><th>Pos.</th><th>Nº</th><th>Nome</th><th>Tempo</th><th>Diferença</th><th></th></tr>
            </thead>
            <tbody>
              {ranking.map((e, idx) => (
                <tr key={e.id}>
                  <td className="strong">{idx + 1}º</td>
                  <td>{e.participantNumber}</td>
                  <td>{e.participantName}</td>
                  <td className="mono">{e.resultDisplay}</td>
                  <td className="mono">{centesimosParaTempo(e.differenceCentiseconds)}</td>
                  <td>
                    {confirmDelete === e.id ? (
                      <span style={{ display: 'flex', gap: 4 }}>
                        <button type="button" className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => { removeDesafioEntry(e.id); setConfirmDelete(null); }}>Confirmar</button>
                        <button type="button" className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setConfirmDelete(null)}>Cancelar</button>
                      </span>
                    ) : (
                      <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '2px 4px' }} onClick={() => setConfirmDelete(e.id)} title="Excluir participante"><Icon name="trash" size={13} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
