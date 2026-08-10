import React, { useMemo, useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { Icon } from '../../components/ui';
import { TIPOS_PREMIO, melhorTentativa } from '../../lib/desafioCronometro';
import { sanitizeText } from '../../lib/security';
import { DesafioEditarParticipante } from './DesafioEditarParticipante';

// Desafio RJNet — Acerte 00:03:33 (D-089, D-098): ganhadores instantâneos
// — participantes cuja MELHOR tentativa (melhorTentativa(),
// desafioCronometro.js) acertou EXATAMENTE o tempo-alvo — nunca aparecem
// no ranking. Mais recentes primeiro, ordenado pelo horário da própria
// tentativa vencedora (não do cadastro — podem ter passado tentativas
// antes de acertar). Cada linha tem controle de entrega do prêmio (tipo,
// entregue Sim/Não, responsável, horário — gravado automaticamente ao
// marcar "entregue") já pré-preenchido com o prêmio escolhido no
// cadastro (D-098), ajustável aqui na hora da entrega.
export function DesafioGanhadores({ desafio, entries }) {
  const { atualizarEntregaPremio, removeDesafioEntry } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editando, setEditando] = useState(null);
  const ganhadores = useMemo(() => entries
    .map((e) => ({ entry: e, melhor: melhorTentativa(e.tentativas) }))
    .filter((x) => x.melhor && x.melhor.isExactHit)
    .sort((a, b) => new Date(b.melhor.criadoEm) - new Date(a.melhor.criadoEm)),
  [entries]);

  return (
    <div className="card">
      <span className="section-title">🏆 Ganhadores Instantâneos</span>
      <p className="campo-hint" style={{ marginTop: 4 }}>
        Todo participante que acertar exatamente o tempo-alvo em qualquer tentativa ganha automaticamente — sem limite de ganhadores.
      </p>
      {ganhadores.length === 0 ? (
        <div className="empty" style={{ padding: '20px 0' }}>Ninguém acertou exatamente ainda.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          {ganhadores.map(({ entry: g, melhor }) => (
            <GanhadorRow
              key={g.id} ganhador={g} tentativaVencedora={melhor}
              onAtualizar={(patch) => atualizarEntregaPremio(g.id, patch)}
              onEditar={() => setEditando(g)}
              confirmDelete={confirmDelete === g.id}
              onPedirExclusao={() => setConfirmDelete(g.id)}
              onCancelarExclusao={() => setConfirmDelete(null)}
              onConfirmarExclusao={() => { removeDesafioEntry(g.id); setConfirmDelete(null); }}
            />
          ))}
        </div>
      )}
      {editando && <DesafioEditarParticipante entry={editando} onClose={() => setEditando(null)} />}
    </div>
  );
}

function GanhadorRow({ ganhador, tentativaVencedora, onAtualizar, onEditar, confirmDelete, onPedirExclusao, onCancelarExclusao, onConfirmarExclusao }) {
  const [responsavel, setResponsavel] = useState(ganhador.deliveryResponsible || '');
  const totalTentativas = (ganhador.tentativas || []).length;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Icon name="trophy" size={18} stroke="var(--yellow)" />
        <div>
          <div className="strong">{ganhador.participantName}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {new Date(tentativaVencedora.criadoEm).toLocaleTimeString('pt-BR')} · {ganhador.phone || 'sem telefone'}
            {' '}· {totalTentativas} tentativa{totalTentativas === 1 ? '' : 's'} (acertou na {tentativaVencedora.attemptNumber}ª)
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: ganhador.delivered ? 'var(--green)' : 'var(--yellow)' }}>
          {ganhador.delivered ? '✓ Entregue' : 'Pendente'}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '2px 4px' }} onClick={onEditar} title="Editar participante"><Icon name="edit" size={13} /></button>
          {confirmDelete ? (
            <>
              <button type="button" className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} onClick={onConfirmarExclusao}>Confirmar</button>
              <button type="button" className="btn-ghost" style={{ fontSize: 11 }} onClick={onCancelarExclusao}>Cancelar</button>
            </>
          ) : (
            <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '2px 4px' }} onClick={onPedirExclusao} title="Excluir participante"><Icon name="trash" size={13} /></button>
          )}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
        <select value={ganhador.prizeType || ''} onChange={(e) => onAtualizar({ prizeType: e.target.value || null })} style={{ maxWidth: 200 }}>
          <option value="">Selecione o prêmio</option>
          {TIPOS_PREMIO.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          placeholder="Responsável pela entrega" maxLength={80} style={{ maxWidth: 200 }}
          value={responsavel}
          onChange={(e) => setResponsavel(e.target.value)}
          onBlur={() => onAtualizar({ deliveryResponsible: sanitizeText(responsavel, 80) })}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)', margin: 0, cursor: 'pointer' }}>
          <input
            type="checkbox" checked={!!ganhador.delivered}
            onChange={(e) => onAtualizar({ delivered: e.target.checked, deliveryResponsible: sanitizeText(responsavel, 80) })}
            style={{ width: 18, height: 18 }}
          />
          Entregue
        </label>
        {ganhador.deliveryAt && (
          <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
            em {new Date(ganhador.deliveryAt).toLocaleString('pt-BR')}
          </span>
        )}
      </div>
    </div>
  );
}
