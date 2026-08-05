import { useCallback, useEffect, useRef, useState } from 'react';
import { isSupabaseMode } from '../lib/mode';
import { fetchDesafioPainelPublico } from '../lib/dataService';
import { subscribeDesafioPainel } from '../lib/desafioRealtime';

// Desafio RJNet — Acerte 00:03:33 (D-089): hook da tela pública de TV —
// sem sessão, sem AppContext (mesmo desenho de FormularioPublico/
// SimuladorPublico). Busca o painel (ranking Top 10 + ganhadores +
// estatísticas, tudo já filtrado/calculado no servidor) e reage a
// Broadcasts do painel administrativo pra atualizar sem F5.
//
// Modo local (sem Supabase, só dev/teste): lê os arrays já persistidos em
// localStorage pelo AppProvider (`rjnet_desafios`/`rjnet_desafio_entries`)
// e reproduz EXATAMENTE a mesma regra da RPC pública — nunca é o caminho
// de produção, só permite ver a tela de TV funcionando sem Supabase.
function painelLocal(slug) {
  try {
    const desafios = JSON.parse(localStorage.getItem('rjnet_desafios')) || [];
    const desafio = desafios.find((d) => d.slug === slug && d.ativo);
    if (!desafio) return { found: false };
    const todasEntries = JSON.parse(localStorage.getItem('rjnet_desafio_entries')) || [];
    const entries = todasEntries.filter((e) => e.eventId === desafio.id);
    const naoExatos = entries.filter((e) => !e.isExactHit)
      .sort((a, b) => a.differenceCentiseconds - b.differenceCentiseconds || new Date(a.criadoEm) - new Date(b.criadoEm))
      .slice(0, 10)
      .map((e, i) => ({
        position: i + 1, participant_number: e.participantNumber, participant_name: e.participantName,
        result_display: e.resultDisplay, difference_centiseconds: e.differenceCentiseconds,
      }));
    const ganhadores = entries.filter((e) => e.isExactHit)
      .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm))
      .map((e) => ({
        participant_number: e.participantNumber, participant_name: e.participantName,
        created_at: e.criadoEm, prize_type: e.prizeType, delivered: e.delivered,
      }));
    return {
      found: true,
      event: { id: desafio.id, name: desafio.nome, slug: desafio.slug, targetCentiseconds: desafio.targetCentiseconds },
      stats: { totalParticipants: entries.length, totalWinners: ganhadores.length },
      ranking: naoExatos,
      winners: ganhadores,
    };
  } catch {
    return { found: false };
  }
}

export function useDesafioPainelPublico(slug) {
  const [painel, setPainel] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const eventIdRef = useRef(null);
  const unsubRef = useRef(() => {});

  const carregar = useCallback(async () => {
    const data = isSupabaseMode() ? await fetchDesafioPainelPublico(slug) : painelLocal(slug);
    setPainel(data);
    setCarregando(false);

    // Assina o canal do dia certo só depois de saber o eventId — troca de
    // canal se o slug mudar (não muda em runtime hoje, mas mantém correto).
    if (data?.found && data.event.id !== eventIdRef.current) {
      unsubRef.current();
      eventIdRef.current = data.event.id;
      unsubRef.current = subscribeDesafioPainel(data.event.id, carregarRef.current);
    }
  }, [slug]);

  // Ref estável pra evitar re-inscrição a cada render por causa da closure de `carregar`
  const carregarRef = useRef(carregar);
  useEffect(() => { carregarRef.current = carregar; }, [carregar]);

  useEffect(() => {
    carregar();
    // Modo local: sem Broadcast (não há Supabase) — poll leve pra simular
    // tempo real em ambiente de dev/teste.
    const poll = !isSupabaseMode() ? setInterval(() => carregarRef.current(), 3000) : null;
    return () => {
      unsubRef.current();
      if (poll) clearInterval(poll);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return { painel, carregando };
}
