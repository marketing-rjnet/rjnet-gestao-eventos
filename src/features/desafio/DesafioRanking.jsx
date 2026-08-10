import React, { useMemo, useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { Icon } from '../../components/ui';
import { centesimosParaTempo, melhorTentativa } from '../../lib/desafioCronometro';
import { DesafioEditarParticipante } from './DesafioEditarParticipante';

// Desafio RJNet — Acerte 00:03:33 (D-089, D-098): ranking administrativo
// do dia. Regras (espelham a RPC pública timer_challenge_painel_publico):
// classificação SEMPRE pela MELHOR tentativa de cada participante
// (melhorTentativa(), desafioCronometro.js — nunca comparação de string,
// nunca uma 2ª cópia da regra). Participantes cuja melhor tentativa é um
// acerto exato NUNCA aparecem aqui — lista própria (DesafioGanhadores.jsx).
// Ordenação: menor diferença primeiro, depois o cadastro mais antigo.
// Mostra só o Top 10. D-095: coluna "Prêmio (posição)" mostra o prêmio
// configurado pra cada posição do ranking (D-092/D-093, sub-aba "Prêmio")
// — independente da coluna "Prêmio" (D-098, o prêmio que o PRÓPRIO
// participante está concorrendo/recebeu, escolhido no cadastro).
export function DesafioRanking({ desafio, entries }) {
  const { removeDesafioEntry } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editando, setEditando] = useState(null);

  const ranking = useMemo(() => entries
    .map((e) => ({ entry: e, melhor: melhorTentativa(e.tentativas) }))
    .filter((x) => x.melhor && !x.melhor.isExactHit)
    .sort((a, b) => a.melhor.differenceCentiseconds - b.melhor.differenceCentiseconds || new Date(a.entry.criadoEm) - new Date(b.entry.criadoEm))
    .slice(0, 10),
  [entries]);
  const premioPorPosicao = useMemo(() => new Map((desafio.premiosRanking || []).map((p) => [p.position, p.nome])), [desafio.premiosRanking]);

  return (
    <div className="card">
      <span className="section-title">Ranking — Top 10 mais próximos</span>
      <p className="campo-hint" style={{ marginTop: 4 }}>
        Alvo: <span className="mono">{centesimosParaTempo(desafio.targetCentiseconds)}</span> — quanto menor a diferença na melhor tentativa, melhor a colocação.
      </p>
      {ranking.length === 0 ? (
        <div className="empty" style={{ padding: '20px 0' }}>Nenhum participante no ranking ainda.</div>
      ) : (
        <div className="tbl-wrap" style={{ marginTop: 10 }}>
          <table>
            <thead>
              <tr>
                <th>Pos.</th><th>Nome</th><th>Melhor tempo</th><th>Diferença</th><th>Tentativas</th>
                <th>Prêmio</th><th>Prêmio (posição)</th><th></th>
              </tr>
            </thead>
            <tbody>
              {ranking.map(({ entry: e, melhor }, idx) => (
                <tr key={e.id}>
                  <td className="strong">{idx + 1}º</td>
                  <td>{e.participantName}</td>
                  <td className="mono">{melhor.resultDisplay}</td>
                  <td className="mono">{centesimosParaTempo(melhor.differenceCentiseconds)}</td>
                  <td>{(e.tentativas || []).length}</td>
                  <td>{e.prizeType || '—'}</td>
                  <td>{premioPorPosicao.get(idx + 1) || '—'}</td>
                  <td>
                    <span style={{ display: 'flex', gap: 4 }}>
                      <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '2px 4px' }} onClick={() => setEditando(e)} title="Editar participante">
                        <Icon name="edit" size={13} />
                      </button>
                      {confirmDelete === e.id ? (
                        <span style={{ display: 'flex', gap: 4 }}>
                          <button type="button" className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => { removeDesafioEntry(e.id); setConfirmDelete(null); }}>Confirmar</button>
                          <button type="button" className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setConfirmDelete(null)}>Cancelar</button>
                        </span>
                      ) : (
                        <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '2px 4px' }} onClick={() => setConfirmDelete(e.id)} title="Excluir participante"><Icon name="trash" size={13} /></button>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editando && <DesafioEditarParticipante entry={editando} onClose={() => setEditando(null)} />}
    </div>
  );
}
