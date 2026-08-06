import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { PREMIOS_POSICAO_RANKING } from '../../lib/desafioCronometro';

const POSICOES = Array.from({ length: 10 }, (_, i) => i + 1);

// Desafio RJNet — Acerte 00:03:33 (D-092, D-093): prêmio por POSIÇÃO do
// ranking (1º ao 10º), independente do prêmio geral do dia (D-091,
// DesafioPremio.jsx) — os dois coexistem. D-093: catálogo FIXO de 3
// opções (RJNET Móvel/HBO Max/Disney+), sem texto livre nem imagem — cada
// posição escolhe uma delas clicando direto no botão (as 3 opções ficam
// visíveis lado a lado, não escondidas num dropdown). Exibido como coluna
// própria na tabela do ranking da Tela de TV, atualizando ao vivo
// conforme os participantes vão ocupando cada posição.
function premioInicial(posicao, premiosRanking) {
  return (premiosRanking || []).find((p) => p.position === posicao)?.nome || null;
}

export function DesafioPremiosRanking({ desafio }) {
  const { saveDesafioPremiosRanking } = useApp();
  const [escolhas, setEscolhas] = useState(() => {
    const m = new Map();
    POSICOES.forEach((p) => m.set(p, premioInicial(p, desafio.premiosRanking)));
    return m;
  });
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);

  const escolher = (posicao, premio) => {
    setEscolhas((p) => {
      const novo = new Map(p);
      novo.set(posicao, p.get(posicao) === premio ? null : premio);
      return novo;
    });
  };

  const submit = (e) => {
    e.preventDefault();
    setSalvando(true);
    setMsg(null);
    const ranking = POSICOES.map((position) => ({ position, name: escolhas.get(position) || '' }));
    saveDesafioPremiosRanking(
      desafio.id,
      { ranking },
      (erro) => { setSalvando(false); setMsg({ tipo: 'erro', texto: `Falha ao salvar${erro ? `: ${erro}` : '.'} Tente novamente.` }); },
    );
    // Otimista: a mutação local já reflete de imediato (ver desafioApi.saveDesafioPremiosRanking).
    setSalvando(false);
    setMsg({ tipo: 'ok', texto: 'Prêmios do ranking salvos — aparecem na Tela de TV em instantes.' });
  };

  return (
    <div className="card" style={{ marginTop: 18, maxWidth: 620 }}>
      <span className="section-title">🏅 Prêmios do Ranking (1º ao 10º)</span>
      <p className="campo-hint" style={{ marginTop: 4, marginBottom: 14 }}>
        Escolha um prêmio pra cada posição do Top 10, clicando numa das 3 opções — aparece como coluna própria na
        tabela do ranking da Tela de TV, ao vivo, conforme os participantes vão ocupando cada posição. Clique de
        novo na opção marcada pra deixar a posição sem prêmio.
      </p>
      <form onSubmit={submit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {POSICOES.map((posicao) => (
            <div key={posicao} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', flexWrap: 'wrap' }}>
              <span className="mono strong" style={{ width: 30, textAlign: 'center', flexShrink: 0 }}>{posicao}º</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {PREMIOS_POSICAO_RANKING.map((premio) => (
                  <button
                    key={premio} type="button"
                    className={'seg-btn' + (escolhas.get(posicao) === premio ? ' active' : '')}
                    style={{ padding: '6px 12px', fontSize: 12.5, minHeight: 'auto' }}
                    onClick={() => escolher(posicao, premio)}
                  >
                    {premio}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {msg && (
          <div style={{ fontSize: 13, marginTop: 10, marginBottom: 4, color: msg.tipo === 'erro' ? 'var(--red)' : 'var(--green)' }}>{msg.texto}</div>
        )}
        <button type="submit" className="btn-primary" style={{ marginTop: 10 }} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar prêmios do ranking'}
        </button>
      </form>
    </div>
  );
}
