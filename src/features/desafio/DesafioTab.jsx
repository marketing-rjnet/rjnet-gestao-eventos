import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { Icon } from '../../components/ui';
import { sanitizeText } from '../../lib/security';
import { TARGET_CENTISECONDS_PADRAO, centesimosParaTempo, validarFormatoTempo, parseTempoParaCentesimos } from '../../lib/desafioCronometro';
import { DesafioDetail } from './DesafioDetail';

// Desafio RJNet — Acerte 00:03:33 (D-089). Gestão dos dias/edições do
// desafio — mesmo padrão de "campanha" já usado pelo Simulador
// (SimuladorTab.jsx): criar, listar, abrir detalhe. Cada dia tem ranking/
// participantes/estatísticas/ganhadores 100% independentes (nunca
// misturados — todo filtro no banco é por event_id).
export function DesafioTab() {
  const { desafios, addDesafioEvento, updateDesafioEvento, removeDesafioEvento } = useApp();
  const [nome, setNome] = useState('');
  const [alvo, setAlvo] = useState(centesimosParaTempo(TARGET_CENTISECONDS_PADRAO));
  const [erro, setErro] = useState('');
  const [abertoId, setAbertoId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const criar = (e) => {
    e.preventDefault();
    setErro('');
    const nomeLimpo = sanitizeText(nome, 60);
    if (!nomeLimpo) { setErro('Dê um nome ao dia (ex: Sexta-feira).'); return; }
    if (!validarFormatoTempo(alvo)) { setErro('Tempo-alvo inválido. Use MM:SS:CC (ex: 00:03:33).'); return; }
    const novo = addDesafioEvento({ nome: nomeLimpo, targetCentiseconds: parseTempoParaCentesimos(alvo) });
    setNome('');
    setAlvo(centesimosParaTempo(TARGET_CENTISECONDS_PADRAO));
    setAbertoId(novo.id);
  };

  if (abertoId) {
    const desafio = desafios.find((d) => d.id === abertoId);
    if (desafio) return <DesafioDetail desafio={desafio} onBack={() => setAbertoId(null)} />;
    setAbertoId(null);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">Desafio RJNET</div>
          <p className="tab-desc">
            🎯 Acerte exatamente o tempo-alvo no cronômetro. Cada dia/edição do desafio tem ranking, participantes,
            estatísticas e ganhadores totalmente independentes — crie um dia por edição (ex: Sexta-feira, Sábado).
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18, maxWidth: 460 }}>
        <span className="section-title">Novo dia do desafio</span>
        <form onSubmit={criar}>
          <div className="big-field" style={{ marginTop: 10, marginBottom: 12 }}>
            <label>Nome do dia *</label>
            <input required maxLength={60} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Sexta-feira" autoFocus />
          </div>
          <div className="big-field" style={{ marginBottom: 14 }}>
            <label>Tempo-alvo (MM:SS:CC) *</label>
            <input
              required maxLength={8} value={alvo} onChange={(e) => setAlvo(e.target.value)}
              placeholder="00:03:33" className="mono" style={{ maxWidth: 140, fontSize: 18, textAlign: 'center' }}
            />
            <p className="campo-hint" style={{ marginTop: 6 }}>
              Padrão deste desafio: 00:03:33. Configurável por dia — dá pra reaproveitar o módulo em eventos futuros
              com outro tempo-alvo, sem alterar código.
            </p>
          </div>
          {erro && <div className="form-erro">{erro}</div>}
          <button type="submit" className="btn-primary btn-full" disabled={!nome.trim()}>Criar dia</button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <span className="section-title">Dias criados</span>
        {desafios.length === 0 ? (
          <div className="empty" style={{ padding: '20px 0' }}>Nenhum dia criado ainda.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {desafios.map((d) => (
              <div key={d.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div className="strong">{d.nome}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      Alvo: <span className="mono">{centesimosParaTempo(d.targetCentiseconds)}</span> · {d.ativo ? 'ativo' : 'encerrado'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button type="button" className="btn-primary" style={{ fontSize: 12 }} onClick={() => setAbertoId(d.id)}>Gerenciar</button>
                    <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={() => updateDesafioEvento(d.id, { ativo: !d.ativo })}>
                      {d.ativo ? 'Encerrar' : 'Reativar'}
                    </button>
                    {confirmDelete === d.id ? (
                      <>
                        <button type="button" className="btn-ghost" style={{ fontSize: 12, color: 'var(--red)' }} onClick={() => { removeDesafioEvento(d.id); setConfirmDelete(null); }}>Confirmar</button>
                        <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setConfirmDelete(null)}>Cancelar</button>
                      </>
                    ) : (
                      <button type="button" className="btn-ghost" style={{ fontSize: 12, color: 'var(--red)' }} onClick={() => setConfirmDelete(d.id)}><Icon name="trash" size={14} /></button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
