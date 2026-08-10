import React, { useMemo, useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { Icon } from '../../components/ui';
import { sanitizeText } from '../../lib/security';
import { maskTel } from '../../utils/masks';
import { CronometroInput } from '../../components/CronometroInput';
import { centesimosParaTempo, TIPOS_PREMIO, melhorTentativa, formatarDiferenca } from '../../lib/desafioCronometro';
import { DesafioTentativas } from './DesafioTentativas';
import { DesafioEditarParticipante } from './DesafioEditarParticipante';

// Desafio RJNet — Acerte 00:03:33 (D-089, D-090, D-098, D-099): tela de
// cadastro do marketing — o console principal do operador durante o
// evento. addDesafioEntry() já cria o participante com a 1ª tentativa
// (converte pra centésimos, calcula diferença, identifica acerto exato
// ANTES de gravar — src/lib/desafioCronometro.js); este componente só
// coleta e mostra. D-098: até `maxTentativas` tentativas por participante
// SEM recadastrar a pessoa — por isso a lista "Participantes cadastrados"
// abaixo do formulário, com busca por nome, tentativa nova e edição
// rápida sempre à mão, sem precisar trocar de sub-aba. D-099: campo "Já é
// cliente RJNET?" — mesmo campo/semântica de leads.jaClienteRjnet,
// puramente informativo (CRM/CSV), nunca exposto na Tela de TV.
export function DesafioCadastro({ desafio, entries }) {
  const { addDesafioEntry } = useApp();
  const [participantName, setParticipantName] = useState('');
  const [phone, setPhone] = useState('');
  const [prizeType, setPrizeType] = useState('');
  const [jaClienteRjnet, setJaClienteRjnet] = useState(false);
  const [resultado, setResultado] = useState('');
  const [erro, setErro] = useState('');
  const [ultimoId, setUltimoId] = useState(null);
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState(null);

  const limpar = () => {
    setParticipantName(''); setPhone(''); setPrizeType(''); setJaClienteRjnet(false); setResultado('');
  };

  const salvar = (e) => {
    e.preventDefault();
    setErro('');
    const nome = sanitizeText(participantName, 120);
    if (!nome) { setErro('Nome é obrigatório.'); return; }

    const novo = addDesafioEntry(
      desafio.id,
      { participantName: nome, phone: phone.trim(), prizeType: prizeType || null, jaClienteRjnet },
      resultado,
      (msg) => setErro(msg),
    );
    if (novo) {
      setUltimoId(novo.id);
      limpar();
    }
  };

  const ultimo = entries.find((e) => e.id === ultimoId) || null;

  // Sem busca: os cadastrados mais recentes primeiro, já é o caso comum
  // de "acabei de cadastrar, preciso adicionar a 2ª tentativa".
  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const ordenada = [...entries].sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
    if (!termo) return ordenada.slice(0, 20);
    return ordenada.filter((e) => e.participantName.toLowerCase().includes(termo)).slice(0, 30);
  }, [entries, busca]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
      <div className="card">
        <span className="section-title">Novo participante — {desafio.nome}</span>
        <p className="campo-hint" style={{ marginTop: 4 }}>
          Tempo-alvo deste dia: <strong className="mono">{centesimosParaTempo(desafio.targetCentiseconds)}</strong>
          {' '}· até {desafio.maxTentativas || 3} tentativas por participante
        </p>
        <form onSubmit={salvar} style={{ marginTop: 10 }}>
          <div className="big-field" style={{ marginBottom: 12 }}>
            <label>Nome *</label>
            <input required maxLength={120} value={participantName} onChange={(e) => setParticipantName(e.target.value)} placeholder="Nome completo" autoFocus />
          </div>
          <div className="big-field" style={{ marginBottom: 12 }}>
            <label>Telefone (opcional)</label>
            <input value={phone} onChange={(e) => setPhone(maskTel(e.target.value))} placeholder="(00) 00000-0000" inputMode="numeric" />
          </div>
          <div className="big-field" style={{ marginBottom: 12 }}>
            <label>Prêmio (opcional)</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TIPOS_PREMIO.map((p) => (
                <button
                  key={p} type="button"
                  className={'seg-btn' + (prizeType === p ? ' active' : '')}
                  style={{ padding: '8px 12px', fontSize: 12.5, minHeight: 'auto', flex: '0 0 auto' }}
                  onClick={() => setPrizeType(prizeType === p ? '' : p)}
                >
                  {p}
                </button>
              ))}
            </div>
            <p className="campo-hint" style={{ marginTop: 6, marginBottom: 0 }}>
              Qual prêmio esta pessoa está concorrendo/recebendo. Dá pra ajustar depois em Ganhadores ou na edição rápida.
            </p>
          </div>
          <div className="big-field" style={{ marginBottom: 12 }}>
            <label>Já é cliente RJNET?</label>
            <div className="seg-control">
              <button type="button" className={'seg-btn' + (!jaClienteRjnet ? ' active' : '')} onClick={() => setJaClienteRjnet(false)}>Não</button>
              <button type="button" className={'seg-btn' + (jaClienteRjnet ? ' active' : '')} onClick={() => setJaClienteRjnet(true)}>Sim</button>
            </div>
          </div>
          <div className="big-field" style={{ marginBottom: 14 }}>
            <label>Tentativa 1 (MM:SS:CC) *</label>
            <CronometroInput
              value={resultado} onChange={setResultado} placeholder="00:03:33" className="mono"
              style={{ maxWidth: 160, fontSize: 20, textAlign: 'center', letterSpacing: 1 }}
            />
          </div>
          {erro && <div className="form-erro">{erro}</div>}
          <button type="submit" className="btn-primary btn-full" disabled={!resultado}>Salvar participante</button>
        </form>
      </div>

      {ultimo && (() => {
        const melhor = melhorTentativa(ultimo.tentativas);
        return (
          <div className="card" style={{ borderColor: melhor?.isExactHit ? 'var(--yellow)' : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <span className="section-title">Último cadastrado</span>
              <button type="button" className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setEditando(ultimo)}>
                <Icon name="edit" size={13} /> Editar
              </button>
            </div>
            <div style={{ marginTop: 8 }}>
              <div className="strong">
                {ultimo.participantName}
                {ultimo.jaClienteRjnet && <span className="badge badge-ativo" style={{ marginLeft: 6, fontSize: 10 }}>Já cliente</span>}
              </div>
              {ultimo.phone && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{ultimo.phone}</div>}
              {ultimo.prizeType && <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>🎁 {ultimo.prizeType}</div>}
              <div style={{ marginTop: 10 }}>
                <div className="campo-hint" style={{ margin: '0 0 4px' }}>Tentativas</div>
                <DesafioTentativas entry={ultimo} maxTentativas={desafio.maxTentativas} />
              </div>
              {melhor?.isExactHit ? (
                <div style={{ color: 'var(--yellow)', fontWeight: 700, marginTop: 8 }}>🏆 Acertou exatamente! Ganhador instantâneo.</div>
              ) : melhor && (
                <div style={{ marginTop: 8 }}>Diferença (melhor tentativa): <span className="mono">{formatarDiferenca(melhor.differenceCentiseconds)}</span></div>
              )}
            </div>
          </div>
        );
      })()}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="section-title">Participantes cadastrados</span>
          <input
            value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome..."
            style={{ maxWidth: 220 }}
          />
        </div>
        {listaFiltrada.length === 0 ? (
          <div className="empty" style={{ padding: '20px 0' }}>Nenhum participante encontrado.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {listaFiltrada.map((e) => (
              <div key={e.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <div className="strong">
                      {e.participantName}
                      {e.jaClienteRjnet && <span className="badge badge-ativo" style={{ marginLeft: 6, fontSize: 10 }}>Já cliente</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {e.phone || 'sem telefone'}{e.prizeType ? ` · 🎁 ${e.prizeType}` : ''}
                    </div>
                  </div>
                  <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '2px 4px' }} onClick={() => setEditando(e)} title="Editar participante">
                    <Icon name="edit" size={13} /> Editar
                  </button>
                </div>
                <div style={{ marginTop: 8 }}>
                  <DesafioTentativas entry={e} maxTentativas={desafio.maxTentativas} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editando && <DesafioEditarParticipante entry={editando} onClose={() => setEditando(null)} />}
    </div>
  );
}
