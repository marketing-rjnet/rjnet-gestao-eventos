import { useState, useEffect, useRef } from 'react';
import { useApp } from './useApp';
import { RANKING_DEBOUNCE_MS, RANKING_POLL_MS, RANKING_POLL_INATIVO_MS, RANKING_POLL_INATIVO_APOS_MS } from '../lib/constants';

// D-058: `obterFn` permite reaproveitar o hook para o placar por mês
// (`obterRankingMes`) em vez de duplicar toda a lógica de debounce/polling.
export function useRanking(eventoId, leadsCount, obterFn) {
  const { obterRanking } = useApp();
  const fetchFn = obterFn || obterRanking;
  const [ranking, setRanking] = useState([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const rankingDebounce = useRef(null);
  const pollTimeout = useRef(null);
  const ultimaAtividade = useRef(Date.now());

  const atualizarRanking = useRef(null);
  atualizarRanking.current = async (id) => {
    if (!id) { setRanking([]); return; }
    setRankingLoading(true);
    const r = await fetchFn(id);
    setRanking(r || []);
    setRankingLoading(false);
  };

  useEffect(() => {
    atualizarRanking.current(eventoId);
  }, [eventoId]);

  useEffect(() => {
    ultimaAtividade.current = Date.now();
    if (!eventoId) return;
    clearTimeout(rankingDebounce.current);
    rankingDebounce.current = setTimeout(() => atualizarRanking.current(eventoId), RANKING_DEBOUNCE_MS);
    return () => clearTimeout(rankingDebounce.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadsCount]);

  // TB-011: backoff adaptativo — poll a cada RANKING_POLL_MS normalmente,
  // sem lead novo há mais de RANKING_POLL_INATIVO_APOS_MS, espaça para
  // RANKING_POLL_INATIVO_MS. Volta ao ritmo normal assim que `leadsCount`
  // muda de novo (reseta `ultimaAtividade` acima).
  useEffect(() => {
    if (!eventoId) return;
    const schedule = () => {
      const inativo = Date.now() - ultimaAtividade.current > RANKING_POLL_INATIVO_APOS_MS;
      const delay = inativo ? RANKING_POLL_INATIVO_MS : RANKING_POLL_MS;
      pollTimeout.current = setTimeout(() => {
        atualizarRanking.current(eventoId);
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(pollTimeout.current);
  }, [eventoId]);

  return { ranking, rankingLoading };
}
