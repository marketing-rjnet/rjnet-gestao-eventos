import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDesafioPainelPublico } from '../hooks/useDesafioPainelPublico';
import { centesimosParaTempo, formatarDiferenca } from '../lib/desafioCronometro';

// Desafio RJNet — Acerte 00:03:33 (D-089, D-090): tela pública de TV —
// sem sessão, sem menus, tela cheia, atualização automática (ver
// useDesafioPainelPublico: RPC pública + Broadcast em modo Supabase, poll
// leve em modo local/dev). Sempre que surge um ganhador novo, mostra a
// animação de comemoração por alguns segundos e volta sozinha pro ranking.
// D-090: KPIs espelham o painel administrativo (Participantes, Ganhadores,
// Menor diferença, Média dos tempos, Alvo) — sem "número do participante".
const WINNER_OVERLAY_MS = 5000;
const CONFETTI_EMOJIS = ['🎉', '🎊', '⭐', '🏆', '✨'];
// D-094: a tabela do ranking sempre mostra as 10 posições, mesmo as que
// ainda não têm participante — quem está assistindo precisa ver de cara
// quais prêmios estão em jogo em cada posição, não só nas já ocupadas.
const POSICOES_RANKING = Array.from({ length: 10 }, (_, i) => i + 1);

// D-092/D-093: prêmio por posição do ranking — array independente do
// prêmio geral do dia (D-091). Catálogo fixo de 3 opções, só texto (sem
// imagem, D-093). Só existe entrada pra posição que o marketing configurou.
function premioDaPosicao(prizeRanking, position) {
  const p = (prizeRanking || []).find((x) => x.position === position);
  return p?.name || null;
}

function Confetti() {
  const pecas = useMemo(() => Array.from({ length: 26 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.2,
    duration: 2.2 + Math.random() * 1.6,
    emoji: CONFETTI_EMOJIS[i % CONFETTI_EMOJIS.length],
  })), []);
  return (
    <>
      {pecas.map((p) => (
        <span
          key={p.id} className="desafio-confetti"
          style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s` }}
        >
          {p.emoji}
        </span>
      ))}
    </>
  );
}

function WinnerOverlay({ ganhador, targetCentiseconds, onFim }) {
  useEffect(() => {
    const t = setTimeout(onFim, WINNER_OVERLAY_MS);
    return () => clearTimeout(t);
  }, [ganhador.created_at, onFim]);

  return (
    <div className="desafio-tv-winner-overlay">
      <Confetti />
      <img src="/logo-rjnet.svg" alt="RJNet" />
      <div className="msg">🎉 TEMOS UM NOVO GANHADOR!</div>
      <div className="name">{ganhador.participant_name}</div>
      <div className="detail">Acertou exatamente</div>
      <div className="time">{centesimosParaTempo(targetCentiseconds)}</div>
    </div>
  );
}

export default function DesafioPublico({ slug }) {
  const { painel, carregando } = useDesafioPainelPublico(slug);
  const [overlayGanhador, setOverlayGanhador] = useState(null);
  const ultimosIdsRef = useRef(null);

  // Detecta ganhador NOVO comparando com a última lista vista — dispara a
  // animação uma única vez por ganhador (nunca repete ao simplesmente
  // re-renderizar com os mesmos dados). `created_at` é único o bastante
  // (timestamptz com resolução de microssegundos) pra servir de chave —
  // D-090 removeu o "número do participante" que era usado aqui antes.
  useEffect(() => {
    if (!painel?.found) return;
    const idsAtuais = new Set(painel.winners.map((w) => w.created_at));
    if (ultimosIdsRef.current) {
      const novo = painel.winners.find((w) => !ultimosIdsRef.current.has(w.created_at));
      if (novo) setOverlayGanhador(novo);
    }
    ultimosIdsRef.current = idsAtuais;
  }, [painel]);

  // Ref estável — se `onFim` fosse uma closure nova a cada render (o
  // `painel` muda a cada poll/broadcast, mesmo sem ganhador novo), o efeito
  // de auto-dismiss do WinnerOverlay reiniciaria o timeout de 5s a cada
  // atualização e a animação nunca sairia da tela sozinha.
  const dismissOverlay = useCallback(() => setOverlayGanhador(null), []);

  if (carregando) {
    return <div className="desafio-tv"><div className="desafio-tv-empty">Carregando...</div></div>;
  }

  if (!painel?.found) {
    return (
      <div className="desafio-tv">
        <div className="desafio-tv-empty" style={{ margin: 'auto' }}>Desafio não encontrado ou indisponível.</div>
      </div>
    );
  }

  const { event, stats, ranking, winners } = painel;

  return (
    <div className="desafio-tv">
      {overlayGanhador && (
        <WinnerOverlay
          ganhador={overlayGanhador}
          targetCentiseconds={event.targetCentiseconds}
          onFim={dismissOverlay}
        />
      )}

      <div className="desafio-tv-header">
        <img src="/logo-rjnet.svg" alt="RJNet" />
        <div className="desafio-tv-titles">
          <div className="desafio-tv-title">DESAFIO RJNET</div>
          <div className="desafio-tv-subtitle">🎯 Acerte exatamente {centesimosParaTempo(event.targetCentiseconds)} — {event.name}</div>
        </div>
        <div className="desafio-tv-kpis">
          <div className="desafio-tv-kpi">
            <div className="desafio-tv-kpi-value">{stats.totalParticipants}</div>
            <div className="desafio-tv-kpi-label">Participantes</div>
          </div>
          <div className="desafio-tv-kpi">
            <div className="desafio-tv-kpi-value">{stats.totalWinners}</div>
            <div className="desafio-tv-kpi-label">Ganhadores</div>
          </div>
          <div className="desafio-tv-kpi">
            <div className="desafio-tv-kpi-value">{stats.minDifferenceCentiseconds != null ? formatarDiferenca(stats.minDifferenceCentiseconds) : '—'}</div>
            <div className="desafio-tv-kpi-label">Menor diferença</div>
          </div>
          <div className="desafio-tv-kpi">
            <div className="desafio-tv-kpi-value">{stats.averageCentiseconds != null ? centesimosParaTempo(stats.averageCentiseconds) : '—'}</div>
            <div className="desafio-tv-kpi-label">Média dos tempos</div>
          </div>
          <div className="desafio-tv-kpi">
            <div className="desafio-tv-kpi-value">{centesimosParaTempo(event.targetCentiseconds)}</div>
            <div className="desafio-tv-kpi-label">Alvo</div>
          </div>
        </div>
      </div>

      <div className="desafio-tv-body">
        <div className="desafio-tv-panel">
          <div className="desafio-tv-panel-title">TOP 10 MAIS PRÓXIMOS</div>
          <div className="desafio-tv-ranking-row">
            <span>Pos.</span><span>Nome</span><span>Tempo</span><span>Diferença</span><span>Prêmio</span>
          </div>
          {POSICOES_RANKING.map((posicao) => {
            const r = ranking.find((x) => x.position === posicao);
            const premio = premioDaPosicao(event.prizeRanking, posicao);
            return (
              <div key={posicao} className={'desafio-tv-ranking-row' + (posicao === 1 && r ? ' top1' : '') + (!r ? ' vazia' : '')}>
                <span className="desafio-tv-pos">{posicao}º</span>
                <span>{r ? r.participant_name : '—'}</span>
                <span className="desafio-tv-mono">{r ? r.result_display : '—'}</span>
                <span className="desafio-tv-mono">{r ? formatarDiferenca(r.difference_centiseconds) : '—'}</span>
                <span className="desafio-tv-premio-cell">{premio || '—'}</span>
              </div>
            );
          })}
        </div>

        {/* D-091: coluna ao lado do ranking — Prêmio (quando configurado) + Ganhadores */}
        <div className="desafio-tv-side">
          {(event.prizeDescription || event.prizeImageUrl) && (
            <div className="desafio-tv-panel desafio-tv-panel-premio">
              <div className="desafio-tv-panel-title">🎁 Prêmio</div>
              {event.prizeImageUrl && <img src={event.prizeImageUrl} alt="Prêmio" className="desafio-tv-premio-img" />}
              {event.prizeDescription && <div className="desafio-tv-premio-desc">{event.prizeDescription}</div>}
            </div>
          )}

          <div className="desafio-tv-panel">
            <div className="desafio-tv-panel-title">🏆 Ganhadores Instantâneos</div>
            {winners.length === 0 ? (
              <div className="desafio-tv-empty">Ninguém acertou exatamente ainda.</div>
            ) : (
              <div className="desafio-tv-winners-list">
                {winners.map((w) => (
                  <div key={w.created_at} className="desafio-tv-winner-item">
                    <div className="desafio-tv-winner-name">{w.participant_name}</div>
                    <div className="desafio-tv-winner-meta">
                      {new Date(w.created_at).toLocaleTimeString('pt-BR')} · {w.prize_type || 'prêmio a definir'} · {w.delivered ? '✓ entregue' : 'entrega pendente'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
