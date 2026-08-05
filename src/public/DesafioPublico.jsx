import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDesafioPainelPublico } from '../hooks/useDesafioPainelPublico';
import { centesimosParaTempo, formatarDiferenca } from '../lib/desafioCronometro';

// Desafio RJNet — Acerte 00:03:33 (D-089): tela pública de TV — sem
// sessão, sem menus, tela cheia, atualização automática (ver
// useDesafioPainelPublico: RPC pública + Broadcast em modo Supabase, poll
// leve em modo local/dev). Sempre que surge um ganhador novo, mostra a
// animação de comemoração por alguns segundos e volta sozinha pro ranking.
const WINNER_OVERLAY_MS = 5000;
const CONFETTI_EMOJIS = ['🎉', '🎊', '⭐', '🏆', '✨'];

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
  }, [ganhador.participant_number, onFim]);

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
  // re-renderizar com os mesmos dados).
  useEffect(() => {
    if (!painel?.found) return;
    const idsAtuais = new Set(painel.winners.map((w) => `${w.participant_number}-${w.created_at}`));
    if (ultimosIdsRef.current) {
      const novo = painel.winners.find((w) => !ultimosIdsRef.current.has(`${w.participant_number}-${w.created_at}`));
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
        </div>
      </div>

      <div className="desafio-tv-body">
        <div className="desafio-tv-panel">
          <div className="desafio-tv-panel-title">TOP 10 MAIS PRÓXIMOS</div>
          <div className="desafio-tv-ranking-row">
            <span>Pos.</span><span>Nº</span><span>Nome</span><span>Tempo</span><span>Diferença</span>
          </div>
          {ranking.length === 0 ? (
            <div className="desafio-tv-empty">Aguardando os primeiros participantes...</div>
          ) : (
            ranking.map((r) => (
              <div key={`${r.participant_number}-${r.position}`} className={'desafio-tv-ranking-row' + (r.position === 1 ? ' top1' : '')}>
                <span className="desafio-tv-pos">{r.position}º</span>
                <span className="desafio-tv-mono">{r.participant_number}</span>
                <span>{r.participant_name}</span>
                <span className="desafio-tv-mono">{r.result_display}</span>
                <span className="desafio-tv-mono">{formatarDiferenca(r.difference_centiseconds)}</span>
              </div>
            ))
          )}
        </div>

        <div className="desafio-tv-panel">
          <div className="desafio-tv-panel-title">🏆 Ganhadores Instantâneos</div>
          {winners.length === 0 ? (
            <div className="desafio-tv-empty">Ninguém acertou exatamente ainda.</div>
          ) : (
            <div className="desafio-tv-winners-list">
              {winners.map((w) => (
                <div key={`${w.participant_number}-${w.created_at}`} className="desafio-tv-winner-item">
                  <div className="desafio-tv-winner-name">{w.participant_name} <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>#{w.participant_number}</span></div>
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
  );
}
