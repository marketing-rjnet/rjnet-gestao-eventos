import React, { useEffect, useRef, useMemo, useState } from 'react';
import { supabaseEnabled } from '../lib/supabase';
import { fetchAll, subscribeChanges, auth, rankingEvento, flushPendingQueue } from '../lib/dataService';
import { SYNC_STATUS, STATUS_EVENTO } from '../lib/constants';
import { MOCK_MATERIAIS, MOCK_VENDEDORES, MOCK_EVENTOS, MOCK_LEADS } from '../utils/mockData';
import { usePersisted } from '../hooks/usePersisted';
import { AppContext } from './AppContext';
import { createEventoApi } from '../api/eventoApi';
import { createLeadApi } from '../api/leadApi';
import { createMaterialApi } from '../api/materialApi';
import { createVendedorApi } from '../api/vendedorApi';

export function AppProvider({ children }) {
  const [materiais, setMateriais] = usePersisted("rjnet_materiais", supabaseEnabled ? [] : MOCK_MATERIAIS);
  const [eventos, setEventos] = usePersisted("rjnet_eventos", supabaseEnabled ? [] : MOCK_EVENTOS);
  const [leads, setLeads] = usePersisted("rjnet_leads", supabaseEnabled ? [] : MOCK_LEADS);
  const [vendedores, setVendedores] = usePersisted("rjnet_vendedores", supabaseEnabled ? [] : MOCK_VENDEDORES);
  const [isLoading, setIsLoading] = useState(supabaseEnabled);
  const [syncStatus, setSyncStatus] = useState(SYNC_STATUS.IDLE);

  const abortRef = useRef(null);
  const carregar = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSyncStatus(SYNC_STATUS.SYNCING);
    await flushPendingQueue();
    const dados = await fetchAll(controller.signal);
    if (controller.signal.aborted) return;
    if (!dados) { setSyncStatus(SYNC_STATUS.ERROR); return; }
    setMateriais(dados.materiais);
    setVendedores(dados.vendedores);
    setEventos(dados.eventos);
    setLeads(dados.leads);
    setSyncStatus(SYNC_STATUS.IDLE);
    setIsLoading(false);
  };

  useEffect(() => {
    if (!supabaseEnabled) return;
    carregar();
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
    window.addEventListener('rjnet:sync-error', handleSyncError);
    window.addEventListener('online', carregar);
    return () => {
      abortRef.current?.abort();
      unsubRealtime();
      unsubAuth();
      window.removeEventListener('rjnet:sync-error', handleSyncError);
      window.removeEventListener('online', carregar);
    };
  }, []);

  const genId = (prefix) => prefix + Date.now() + Math.random().toString(36).slice(2, 7);

  const obterRanking = async (eventoId) => {
    if (supabaseEnabled) {
      const r = await rankingEvento(eventoId);
      if (r) return r;
    }
    const mapa = {};
    leads.filter((l) => l.eventoId === eventoId).forEach((l) => {
      mapa[l.vendedorNome] = (mapa[l.vendedorNome] || 0) + 1;
    });
    return Object.entries(mapa)
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);
  };

  const { patchEvento, addEvento, updateEvento, removeEvento } =
    createEventoApi({ eventos, setEventos, genId });

  const { addLead, updateLead, removeLead } =
    createLeadApi({ leads, setLeads, genId });

  const { addMaterial, updateMaterial, addMaterialEvento, removeMaterialEvento, toggleRetornadoEvento } =
    createMaterialApi({ materiais, setMateriais, eventos, patchEvento, genId });

  const { addVendedor, updateVendedor, toggleVendedor } =
    createVendedorApi({ vendedores, setVendedores, genId });

  const value = useMemo(() => ({
    materiais, eventos, leads, vendedores,
    isLoading, syncStatus,
    addEvento, updateEvento, removeEvento,
    addLead, updateLead, removeLead,
    addMaterial, updateMaterial,
    addMaterialEvento, removeMaterialEvento, toggleRetornadoEvento,
    addVendedor, updateVendedor, toggleVendedor,
    obterRanking,
    recarregar: carregar,
    getLeadsEvento: (eid) => leads.filter((l) => l.eventoId === eid),
    getEventosAtivos: () => eventos.filter((e) => e.status === STATUS_EVENTO.ATIVO),
    getMateriaisDisponiveis: () =>
      materiais.map((mat) => {
        const emCampo = eventos
          .filter((e) => e.status === STATUS_EVENTO.ATIVO || e.status === STATUS_EVENTO.PLANEJADO)
          .flatMap((e) => e.materiais)
          .filter((mm) => mm.materialId === mat.id && !mm.retornado)
          .reduce((acc, mm) => acc + mm.quantidade, 0);
        return { material: mat, emCampo, disponivel: mat.quantidade - emCampo };
      }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [materiais, eventos, leads, vendedores, isLoading, syncStatus]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
