import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { Icon } from '../../components/ui';
import { sanitizeText } from '../../lib/security';

const POSICOES = Array.from({ length: 10 }, (_, i) => i + 1);

// Desafio RJNet — Acerte 00:03:33 (D-092): prêmio por POSIÇÃO do ranking
// (1º ao 10º), independente do prêmio geral do dia (D-091, DesafioPremio.jsx)
// — os dois coexistem. Como a maioria dos prêmios são apps de streaming,
// cada posição leva um ícone pequeno + nome (não uma foto grande). Exibido
// como coluna própria na tabela do ranking da Tela de TV, atualizando ao
// vivo conforme os participantes ocupam cada posição.
function linhaInicial(posicao, premiosRanking) {
  const atual = (premiosRanking || []).find((p) => p.position === posicao);
  return {
    position: posicao,
    nome: atual?.nome || '',
    iconFile: null,
    iconPreview: atual?.iconUrl || null,
    removerIcone: false,
  };
}

export function DesafioPremiosRanking({ desafio }) {
  const { saveDesafioPremiosRanking } = useApp();
  const [linhas, setLinhas] = useState(() => POSICOES.map((p) => linhaInicial(p, desafio.premiosRanking)));
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);

  const atualizarLinha = (posicao, patch) => {
    setLinhas((p) => p.map((l) => (l.position === posicao ? { ...l, ...patch } : l)));
  };

  const onFile = (posicao, e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { alert('Selecione um arquivo de imagem.'); return; }
    if (f.size > 1024 * 1024) { alert('Ícone muito grande (máx. 1MB — é só um logo pequeno).'); return; }
    atualizarLinha(posicao, { iconFile: f, iconPreview: URL.createObjectURL(f), removerIcone: false });
  };

  const onRemoverIcone = (posicao) => {
    atualizarLinha(posicao, { iconFile: null, iconPreview: null, removerIcone: true });
  };

  const submit = (e) => {
    e.preventDefault();
    setSalvando(true);
    setMsg(null);
    const ranking = linhas.map((l) => ({
      position: l.position, name: sanitizeText(l.nome, 40), file: l.iconFile, removerIcone: l.removerIcone,
    }));
    saveDesafioPremiosRanking(
      desafio.id,
      { ranking },
      (erro) => { setSalvando(false); setMsg({ tipo: 'erro', texto: `Falha ao salvar${erro ? `: ${erro}` : '.'} Tente novamente.` }); },
    );
    // Otimista: a mutação local já reflete de imediato (ver desafioApi.saveDesafioPremiosRanking).
    setSalvando(false);
    setLinhas((p) => p.map((l) => ({ ...l, iconFile: null, removerIcone: false })));
    setMsg({ tipo: 'ok', texto: 'Prêmios do ranking salvos — aparecem na Tela de TV em instantes.' });
  };

  return (
    <div className="card" style={{ marginTop: 18, maxWidth: 620 }}>
      <span className="section-title">🏅 Prêmios do Ranking (1º ao 10º)</span>
      <p className="campo-hint" style={{ marginTop: 4, marginBottom: 14 }}>
        Um prêmio diferente por posição do Top 10 — aparece como coluna própria na tabela do ranking da Tela de TV,
        ao vivo, conforme os participantes vão ocupando cada posição. Deixe em branco a posição que não tiver prêmio.
      </p>
      <form onSubmit={submit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {linhas.map((l) => (
            <div key={l.position} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', flexWrap: 'wrap' }}>
              <span className="mono strong" style={{ width: 30, textAlign: 'center', flexShrink: 0 }}>{l.position}º</span>
              {l.iconPreview ? (
                <img src={l.iconPreview} alt="" style={{ width: 32, height: 32, objectFit: 'contain', background: 'var(--bg)', borderRadius: 6, flexShrink: 0 }} />
              ) : (
                <span style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--bg)', flexShrink: 0 }} />
              )}
              <input
                type="file" accept="image/*" onChange={(e) => onFile(l.position, e)}
                style={{ maxWidth: 150, fontSize: 11.5 }}
              />
              {l.iconPreview && (
                <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '2px 4px' }} onClick={() => onRemoverIcone(l.position)} title="Remover ícone">
                  <Icon name="trash" size={12} />
                </button>
              )}
              <input
                maxLength={40} placeholder={`Prêmio do ${l.position}º lugar (ex: Disney+)`}
                value={l.nome} onChange={(e) => atualizarLinha(l.position, { nome: e.target.value })}
                style={{ flex: 1, minWidth: 160 }}
              />
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
