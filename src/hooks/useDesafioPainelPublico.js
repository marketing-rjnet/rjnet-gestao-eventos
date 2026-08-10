import { useCallback, useEffect, useRef, useState } from 'react';
import { isSupabaseMode } from '../lib/mode';
import { fetchDesafioPainelPublico } from '../lib/dataService';
import { subscribeDesafioPainel } from '../lib/desafioRealtime';
import { melhorTentativa } from '../lib/desafioCronometro';

// Desafio RJNet — Acerte 00:03:33 (D-089, D-090): hook da tela pública de
// TV — sem sessão, sem AppContext (mesmo desenho de FormularioPublico/
// SimuladorPublico). Busca o painel (ranking Top 10 + ganhadores +
// estatísticas, tudo já filtrado/calculado no servidor) e reage a
// Broadcasts do painel administrativo pra atualizar sem F5.
//
// Modo local (sem Supabase, só dev/teste): lê os arrays já persistidos em
// localStorage pelo AppProvider (`rjnet_desafios`/`rjnet_desafio_entries`)
// e reproduz EXATAMENTE a mesma regra da RPC pública — nunca é o caminho
// de produção, só permite ver a tela de TV funcionando sem Supabase.
// D-090: sem "número do participante"; ganha menorDiferença/médiaDosTempos.
// D-098: cada entry já chega com `tentativas` anexado (mesmo shape do
// modo Supabase) — classificação sempre pela MELHOR tentativa
// (melhorTentativa(), desafioCronometro.js — mesma função usada em toda
// tela administrativa, nunca uma 2ª cópia da regra).
function painelLocal(slug) {
  try {
    const desafios = JSON.parse(localStorage.getItem('rjnet_desafios')) || [];
    const desafio = desafios.find((d) => d.slug === slug && d.ativo);
    if (!desafio) return { found: false };
    const todasEntries = JSON.parse(localStorage.getItem('rjnet_desafio_entries')) || [];
    const entries = todasEntries.filter((e) => e.eventId === desafio.id);
    const avaliadas = entries
      .map((e) => ({ e, melhor: melhorTentativa(e.tentativas) }))
      .filter((x) => x.melhor);
    const semGanhadores = avaliadas.filter((x) => !x.melhor.isExactHit);
    const ranking = [...semGanhadores]
      .sort((a, b) => a.melhor.differenceCentiseconds - b.melhor.differenceCentiseconds || new Date(a.e.criadoEm) - new Date(b.e.criadoEm))
      .slice(0, 10)
      .map((x, i) => ({
        position: i + 1, participant_name: x.e.participantName,
        result_display: x.melhor.resultDisplay, difference_centiseconds: x.melhor.differenceCentiseconds,
      }));
    const ganhadores = avaliadas.filter((x) => x.melhor.isExactHit)
      .sort((a, b) => new Date(b.melhor.criadoEm) - new Date(a.melhor.criadoEm))
      .map((x) => ({
        participant_name: x.e.participantName,
        created_at: x.melhor.criadoEm, prize_type: x.e.prizeType, delivered: x.e.delivered,
      }));
    const minDifferenceCentiseconds = semGanhadores.length
      ? Math.min(...semGanhadores.map((x) => x.melhor.differenceCentiseconds)) : null;
    const todasTentativas = entries.flatMap((e) => e.tentativas || []);
    const averageCentiseconds = todasTentativas.length
      ? Math.round(todasTentativas.reduce((acc, t) => acc + t.resultCentiseconds, 0) / todasTentativas.length) : null;
    return {
      found: true,
      event: {
        id: desafio.id, name: desafio.nome, slug: desafio.slug, targetCentiseconds: desafio.targetCentiseconds,
        // D-091: modo local não tem Storage — a URL do blob local
        // (createObjectURL) não sobrevive a um reload, então só o texto é
        // confiável aqui; mesma limitação já aceita pra imagem em modo
        // local (ver saveOferta). D-093: prêmios por posição são só texto
        // (catálogo fixo), sem essa limitação.
        prizeDescription: desafio.premioDescricao || null,
        prizeImageUrl: desafio.premioImagemUrl || null,
        prizeRanking: (desafio.premiosRanking || []).map((p) => ({ position: p.position, name: p.nome || '' })),
      },
      stats: { totalParticipants: avaliadas.length, totalWinners: ganhadores.length, minDifferenceCentiseconds, averageCentiseconds },
      ranking,
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
