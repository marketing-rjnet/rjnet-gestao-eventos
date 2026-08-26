import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { Icon } from '../../components/ui';
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
// Cada tentativa já registrada tem seu próprio "✎" — corrige um valor
// lido errado do cronômetro sem apagar/recriar a tentativa nem mexer no
// attemptNumber (updateDesafioTentativa, mesmo cálculo de sempre).
export function DesafioTentativas({ entry, maxTentativas }) {
  const { addDesafioTentativa, updateDesafioTentativa } = useApp();
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [valorEdicao, setValorEdicao] = useState('');
  const [erroEdicao, setErroEdicao] = useState('');

  const tentativas = entry.tentativas || [];
  const melhor = melhorTentativa(tentativas);
  const limite = maxTentativas || 3;
  const podeAdicionar = tentativas.length < limite;

  const confirmar = () => {
    setErro('');
    const nova = addDesafioTentativa(entry.id, valor, (msg) => setErro(msg));
    if (nova) { setValor(''); setAberto(false); }
  };

  // CronometroInput mantém um buffer de dígitos que só CRESCE por
  // digitação (mesmo princípio de campo monetário) — pré-preencher com o
  // valor atual faria os novos dígitos se misturarem aos antigos em vez
  // de substituí-los. Por isso o campo de correção sempre nasce VAZIO,
  // igual ao de "Adicionar tentativa"; o valor atual só aparece como
  // referência ao lado, nunca dentro do campo.
  const iniciarEdicao = (t) => {
    setEditandoId(t.id);
    setValorEdicao('');
    setErroEdicao('');
  };

  const confirmarEdicao = (attemptId) => {
    setErroEdicao('');
    const ok = updateDesafioTentativa(entry.id, attemptId, valorEdicao, (msg) => setErroEdicao(msg));
    if (ok) setEditandoId(null);
  };

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {tentativas.map((t) => (
          <div key={t.id}>
            {editandoId === t.id ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-3)', minWidth: 82, fontSize: 13 }}>Tentativa {t.attemptNumber}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>atual: <span className="mono">{t.resultDisplay}</span> →</span>
                <CronometroInput
                  value={valorEdicao} onChange={setValorEdicao} autoFocus placeholder="00:03:33" className="mono"
                  style={{ maxWidth: 130, fontSize: 15, textAlign: 'center', letterSpacing: 1 }}
                />
                <button type="button" className="btn-primary" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => confirmarEdicao(t.id)} disabled={!valorEdicao}>
                  Salvar
                </button>
                <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={() => { setEditandoId(null); setErroEdicao(''); }}>
                  Cancelar
                </button>
                {erroEdicao && <div className="form-erro" style={{ width: '100%', marginTop: 2 }}>{erroEdicao}</div>}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: 'var(--text-3)', minWidth: 82 }}>Tentativa {t.attemptNumber}</span>
                <span className="mono strong">{t.resultDisplay}</span>
                {melhor && t.id === melhor.id && tentativas.length > 1 && (
                  <span style={{ fontSize: 11, color: 'var(--yellow)', fontWeight: 700 }}>★ melhor</span>
                )}
                {t.isExactHit && <span style={{ fontSize: 11, color: 'var(--yellow)', fontWeight: 700 }}>🏆 exato</span>}
                <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '2px 4px' }} onClick={() => iniciarEdicao(t)} title="Corrigir tentativa">
                  <Icon name="edit" size={12} />
                </button>
              </div>
            )}
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
