import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { sanitizeText } from '../../lib/security';
import { maskTel } from '../../utils/masks';
import { centesimosParaTempo } from '../../lib/desafioCronometro';

// Desafio RJNet — Acerte 00:03:33 (D-089, D-090): tela de cadastro do
// marketing. Ao salvar, addDesafioEntry() já converte pra centésimos,
// calcula a diferença e identifica acerto exato ANTES de gravar (src/lib/
// desafioCronometro.js) — este componente só coleta e mostra o resultado.
// D-090: não existe "número do participante" — o telefone (opcional) já
// é o identificador que o responsável sempre quis dizer com "número".
export function DesafioCadastro({ desafio }) {
  const { addDesafioEntry } = useApp();
  const [participantName, setParticipantName] = useState('');
  const [phone, setPhone] = useState('');
  const [resultado, setResultado] = useState('');
  const [erro, setErro] = useState('');
  const [ultimo, setUltimo] = useState(null);

  const limpar = () => {
    setParticipantName(''); setPhone(''); setResultado('');
  };

  const salvar = (e) => {
    e.preventDefault();
    setErro('');
    const nome = sanitizeText(participantName, 120);
    if (!nome) { setErro('Nome é obrigatório.'); return; }

    const novo = addDesafioEntry(
      desafio.id,
      { participantName: nome, phone: phone.trim() },
      resultado,
      (msg) => setErro(msg),
    );
    if (novo) {
      setUltimo(novo);
      limpar();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
      <div className="card">
        <span className="section-title">Novo participante — {desafio.nome}</span>
        <p className="campo-hint" style={{ marginTop: 4 }}>
          Tempo-alvo deste dia: <strong className="mono">{centesimosParaTempo(desafio.targetCentiseconds)}</strong>
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
          <div className="big-field" style={{ marginBottom: 14 }}>
            <label>Resultado do cronômetro (MM:SS:CC) *</label>
            <input
              required maxLength={8} value={resultado} onChange={(e) => setResultado(e.target.value)}
              placeholder="00:03:33" className="mono" style={{ maxWidth: 160, fontSize: 20, textAlign: 'center', letterSpacing: 1 }}
            />
          </div>
          {erro && <div className="form-erro">{erro}</div>}
          <button type="submit" className="btn-primary btn-full">Salvar participante</button>
        </form>
      </div>

      {ultimo && (
        <div className="card" style={{ borderColor: ultimo.isExactHit ? 'var(--yellow)' : undefined }}>
          <span className="section-title">Último cadastrado</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            <div><strong>{ultimo.participantName}</strong></div>
            <div>Resultado: <span className="mono">{ultimo.resultDisplay}</span></div>
            {ultimo.isExactHit ? (
              <div style={{ color: 'var(--yellow)', fontWeight: 700 }}>🏆 Acertou exatamente! Ganhador instantâneo.</div>
            ) : (
              <div>Diferença: <span className="mono">{centesimosParaTempo(ultimo.differenceCentiseconds)}</span></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
