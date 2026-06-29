import React, { useEffect, useRef, useMemo, useState } from 'react';
import { isSupabaseMode } from '../lib/mode';
import { fetchAll, fetchLeadsEvento, subscribeChanges, auth, flushPendingQueue } from '../lib/dataService';
import { SYNC_STATUS, STATUS_EVENTO } from '../lib/constants';
import { MOCK_MATERIAIS, MOCK_VENDEDORES, MOCK_EVENTOS, MOCK_LEADS } from '../utils/mockData';
import { usePersisted } from '../hooks/usePersisted';
import { AppContext } from './AppContext';
import { createEventoApi } from '../api/eventoApi';
import { createLeadApi } from '../api/leadApi';
import { createMaterialApi } from '../api/materialApi';
import { createVendedorApi } from '../api/vendedorApi';
import { createEquipeApi } from '../api/equipeApi';

export function AppProvider({ children }) {
  const [materiais, setMateriais] = usePersisted("rjnet_materiais", isSupabaseMode() ? [] : MOCK_MATERIAIS);
  const [eventos, setEventos] = usePersisted("rjnet_eventos", isSupabaseMode() ? [] : MOCK_EVENTOS);
  const [leads, setLeads] = usePersisted("rjnet_leads", isSupabaseMode() ? [] : MOCK_LEADS);
  const [vendedores, setVendedores] = usePersisted("rjnet_vendedores", isSupabaseMode() ? [] : MOCK_VENDEDORES);
  const [isLoading, setIsLoading] = useState(isSupabaseMode());
  const [syncStatus, setSyncStatus] = useState(SYNC_STATUS.IDLE);

  const abortRef = useRef(null);
  // TB-004: rastreia qual evento tem leads carregados — usado pelo realtime para recarregar
  const eventoLeadsIdRef = useRef(null);

  const carregar = async () => {
    abortRef.current?.abort();
    // QW-003: timeout de 15s para evitar loading infinito em conexão instável
    const controller = new AbortController();
    const timeoutSignal = AbortSignal.timeout(15_000);
    const signal = AbortSignal.any([controller.signal, timeoutSignal]);
    abortRef.current = controller;

    setSyncStatus(SYNC_STATUS.SYNCING);
    const dados = await fetchAll(signal);
    if (controller.signal.aborted) return;
    if (!dados) { setSyncStatus(SYNC_STATUS.ERROR); return; }
    setMateriais(dados.materiais);
    setVendedores(dados.vendedores);
    setEventos(dados.eventos);
    // TB-004: recarrega leads do evento ativo quando realtime dispara
    if (eventoLeadsIdRef.current) {
      const leadsData = await fetchLeadsEvento(eventoLeadsIdRef.current, signal);
      if (leadsData !== null && !controller.signal.aborted) setLeads(leadsData);
    }
    setSyncStatus(SYNC_STATUS.IDLE);
    setIsLoading(false);
  };

  // TB-004: carrega leads de um evento específico on-demand
  const carregarLeadsEvento = async (eventoId) => {
    if (!isSupabaseMode() || !eventoId) return;
    eventoLeadsIdRef.current = eventoId;
    const data = await fetchLeadsEvento(eventoId);
    if (data !== null) setLeads(data);
  };

  useEffect(() => {
    if (!isSupabaseMode()) return;
    // Flush da fila offline apenas na inicialização e ao reconectar —
    // não em cada evento realtime, pois `carregar()` pode ser chamado
    // dezenas de vezes por sessão e flushPendingQueue faz SELECT + UPSERTs.
    flushPendingQueue().then(carregar);
    const unsubRealtime = subscribeChanges(carregar);
    const unsubAuth = auth.onChange((evento) => {
      if (evento === 'SIGNED_IN') carregar();
      if (evento === 'SIGNED_OUT') {
        abortRef.current?.abort();
        setMateriais([]); setVendedores([]); setEventos([]); setLeads([]);
        setSyncStatus(SYNC_STATUS.IDLE);
      }
    });
    const handleSyncError = () => setSyncStatus(SYNC_STATUS.ERROR);
    const handleOnline = () => { flushPendingQueue().then(carregar); };
    window.addEventListener('rjnet:sync-error', handleSyncError);
    window.addEventListener('online', handleOnline);
    return () => {
      abortRef.current?.abort();
      unsubRealtime();
      unsubAuth();
      window.removeEventListener('rjnet:sync-error', handleSyncError);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const { patchEvento, addEvento, updateEvento, removeEvento } =
    createEventoApi({ eventos, setEventos });

  const { addLead, updateLead, removeLead, obterRanking } =
    createLeadApi({ leads, setLeads });

  const { addMaterial, updateMaterial, addMaterialEvento, removeMaterialEvento, toggleRetornadoEvento } =
    createMaterialApi({ materiais, setMateriais, eventos, patchEvento });

  const { addVendedor, updateVendedor, toggleVendedor } =
    createVendedorApi({ vendedores, setVendedores });

  const { criarUsuario, atualizarPerfil, excluirUsuario } =
    createEquipeApi({ recarregar: carregar });

  // TB-009: pré-computa uma vez por mudança em materiais/eventos em vez de recalcular
  // em cada chamada dos 3 componentes consumidores (Dashboard, EventDetail, EstoqueTab).
  const materiaisDisponiveis = useMemo(() => {
    const eventosAtivos = eventos.filter(
      (e) => e.status === STATUS_EVENTO.ATIVO || e.status === STATUS_EVENTO.PLANEJADO
    );
    return materiais.map((mat) => {
      const emCampo = eventosAtivos
        .flatMap((e) => e.materiais)
        .filter((mm) => mm.materialId === mat.id && !mm.retornado)
        .reduce((acc, mm) => acc + mm.quantidade, 0);
      return { material: mat, emCampo, disponivel: mat.quantidade - emCampo };
    });
  }, [materiais, eventos]);

  const value = useMemo(() => ({
    materiais, eventos, leads, vendedores,
    isLoading, syncStatus,
    addEvento, updateEvento, removeEvento,
    addLead, updateLead, removeLead,
    addMaterial, updateMaterial,
    addMaterialEvento, removeMaterialEvento, toggleRetornadoEvento,
    addVendedor, updateVendedor, toggleVendedor,
    criarUsuario, atualizarPerfil, excluirUsuario,
    obterRanking,
    recarregar: carregar,
    carregarLeadsEvento,
    getLeadsEvento: (eid) => leads.filter((l) => l.eventoId === eid),
    getEventosAtivos: () => eventos.filter((e) => e.status === STATUS_EVENTO.ATIVO),
    getMateriaisDisponiveis: () => materiaisDisponiveis,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [materiais, eventos, leads, vendedores, isLoading, syncStatus, materiaisDisponiveis]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
