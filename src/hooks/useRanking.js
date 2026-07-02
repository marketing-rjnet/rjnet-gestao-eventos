import { useState, useEffect, useRef } from 'react';
import { useApp } from './useApp';
import { RANKING_DEBOUNCE_MS, RANKING_POLL_MS } from '../lib/constants';

// D-058: `obterFn` permite reaproveitar o hook para o placar por mês
// (`obterRankingMes`) em vez de duplicar toda a lógica de debounce/polling.
export function useRanking(eventoId, leadsCount, obterFn) {
  const { obterRanking } = useApp();
  const fetchFn = obterFn || obterRanking;
  const [ranking, setRanking] = useState([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const rankingDebounce = useRef(null);

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
    if (!eventoId) return;
    clearTimeout(rankingDebounce.current);
    rankingDebounce.current = setTimeout(() => atualizarRanking.current(eventoId), RANKING_DEBOUNCE_MS);
    return () => clearTimeout(rankingDebounce.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadsCount]);

  useEffect(() => {
    if (!eventoId) return;
    const interval = setInterval(() => atualizarRanking.current(eventoId), RANKING_POLL_MS);
    return () => clearInterval(interval);
  }, [eventoId]);

  return { ranking, rankingLoading };
}
