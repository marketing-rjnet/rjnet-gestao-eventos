import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseMode } from '../lib/mode';
import { fetchAquisicaoMetricas } from '../lib/dataService';
import { calcularFunil } from '../lib/aquisicao';

// D-104: hook de métricas de aquisição — filtros → RPC `aquisicao_metricas`
// (modo Supabase) ou cálculo local via calcularFunil() sobre os dados de
// tracking do localStorage (modo local/dev — mesma regra, outro runtime).
// Mesmo padrão de useRanking: cleanup automático, nunca deixa estado de
// componente desmontado. `filtros === null` desliga o hook (nada é buscado).

const LOCAL_SESSIONS_KEY = 'rjnet_lp_sessions';
const LOCAL_EVENTS_KEY = 'rjnet_lp_events';

export function lerTrackingLocal() {
  const ler = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
  return { sessions: ler(LOCAL_SESSIONS_KEY), events: ler(LOCAL_EVENTS_KEY) };
}

// Preenche nome/slug/status nas linhas por LP (a RPC já devolve; o modo
// local só tem ids) e garante que toda LP cadastrada apareça, mesmo zerada.
function completarPorLp(porLp, landingPages) {
  const mapa = new Map((porLp || []).map((r) => [r.id, r]));
  return landingPages.map((lp) => ({
    id: lp.id, nome: lp.nome, slug: lp.slug, status: lp.status, servico: lp.servico,
    visitas: 0, interacoes: 0, leads: 0, whatsapp: 0,
    ...(mapa.get(lp.id) || {}),
    nome: lp.nome, slug: lp.slug, status: lp.status,
  }));
}

export function useAquisicaoMetricas(filtros, { landingPages = [], leads = [] } = {}) {
  const [brutas, setBrutas] = useState(null);
  const [carregando, setCarregando] = useState(Boolean(filtros));
  const [erro, setErro] = useState(null);
  const abortRef = useRef(null);
  const chave = JSON.stringify(filtros);
  // Modo Supabase: a RPC só depende dos filtros. Modo local: o cálculo lê
  // o contexto (`leads`), então precisa reagir a ele também.
  const chaveLocal = isSupabaseMode() ? '' : String(leads.length);

  const carregar = useCallback(async () => {
    abortRef.current?.abort();
    if (!filtros) { setBrutas(null); setCarregando(false); return; }
    const controller = new AbortController();
    abortRef.current = controller;
    setCarregando(true);
    setErro(null);

    let dados;
    if (isSupabaseMode()) {
      dados = await fetchAquisicaoMetricas(filtros, controller.signal);
      if (controller.signal.aborted) return;
      if (!dados) setErro('Não foi possível carregar as métricas. A migração de Landing Pages já foi aplicada?');
    } else {
      dados = calcularFunil({ ...lerTrackingLocal(), leads }, filtros);
    }
    setBrutas(dados || null);
    setCarregando(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, chaveLocal]);

  useEffect(() => {
    carregar();
    return () => abortRef.current?.abort();
  }, [carregar]);

  const metricas = useMemo(
    () => (brutas ? { ...brutas, por_landing_page: completarPorLp(brutas.por_landing_page, landingPages) } : null),
    [brutas, landingPages],
  );

  return { metricas, carregando, erro, recarregar: carregar };
}

// Período padrão dos filtros: últimos N dias (ISO).
export function periodoPadrao(dias = 30) {
  const ate = new Date();
  ate.setHours(23, 59, 59, 999);
  const de = new Date();
  de.setDate(de.getDate() - dias);
  de.setHours(0, 0, 0, 0);
  return { de: de.toISOString(), ate: ate.toISOString() };
}
