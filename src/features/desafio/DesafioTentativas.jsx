import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { CronometroInput } from '../../components/CronometroInput';
import { melhorTentativa } from '../../lib/desafioCronometro';

// D-098: bloco de tentativas de UM participante — sempre PROGRESSIVO,
// nunca mostra de cara os 3 espaços vazios: lista só as tentativas já
// registradas ("Tentativa 1 → 00:03:51") e, se ainda não bateu o limite
// do dia (`maxTentativas`), mostra um botão discreto "+ Adicionar
// tentativa N"; clicar nele é que revela o campo de cronômetro. Depois da
// última tentativa permitida, nenhum botão aparece. Reaproveitado pelo
// Cadastro (fluxo principal do operador) e, se necessário, por outras
// telas administrativas — única fonte da UI de tentativas do módulo.
export function DesafioTentativas({ entry, maxTentativas }) {
  const { addDesafioTentativa } = useApp();
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState('');

  const tentativas = entry.tentativas || [];
  const melhor = melhorTentativa(tentativas);
  const limite = maxTentativas || 3;
  const podeAdicionar = tentativas.length < limite;

  const confirmar = () => {
    setErro('');
    const nova = addDesafioTentativa(entry.id, valor, (msg) => setErro(msg));
    if (nova) { setValor(''); setAberto(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {tentativas.map((t) => (
          <div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <span style={{ color: 'var(--text-3)', minWidth: 82 }}>Tentativa {t.attemptNumber}</span>
            <span className="mono strong">{t.resultDisplay}</span>
            {melhor && t.id === melhor.id && tentativas.length > 1 && (
              <span style={{ fontSize: 11, color: 'var(--yellow)', fontWeight: 700 }}>★ melhor</span>
            )}
            {t.isExactHit && <span style={{ fontSize: 11, color: 'var(--yellow)', fontWeight: 700 }}>🏆 exato</span>}
          </div>
        ))}
      </div>

      {podeAdicionar && (
        aberto ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            <CronometroInput
              value={valor} onChange={setValor} autoFocus placeholder="00:03:33" className="mono"
              style={{ maxWidth: 130, fontSize: 15, textAlign: 'center', letterSpacing: 1 }}
            />
            <button type="button" className="btn-primary" style={{ fontSize: 12, padding: '6px 10px' }} onClick={confirmar} disabled={!valor}>
              Salvar
            </button>
            <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={() => { setAberto(false); setValor(''); setErro(''); }}>
              Cancelar
            </button>
          </div>
        ) : (
          <button type="button" className="btn-ghost" style={{ fontSize: 12, marginTop: 8, padding: '4px 8px' }} onClick={() => setAberto(true)}>
            + Adicionar tentativa {tentativas.length + 1}
          </button>
        )
      )}
      {erro && <div className="form-erro" style={{ marginTop: 6 }}>{erro}</div>}
    </div>
  );
}
