import React, { useEffect, useRef, useMemo, useState } from 'react';
import { isSupabaseMode } from '../lib/mode';
import { fetchAll, fetchLeadsEvento, fetchLeadsMes, fetchLeadsQrCode, fetchOfertasEnviadasEvento, fetchOfertasEnviadasMes, subscribeChanges, auth, flushPendingQueue } from '../lib/dataService';
import { SYNC_STATUS, STATUS_EVENTO } from '../lib/constants';
import { MOCK_MATERIAIS, MOCK_VENDEDORES, MOCK_EVENTOS, MOCK_LEADS } from '../utils/mockData';
import { usePersisted } from '../hooks/usePersisted';
import { AppContext } from './AppContext';
import { createEventoApi } from '../api/eventoApi';
import { createLeadApi } from '../api/leadApi';
import { createMaterialApi } from '../api/materialApi';
import { createVendedorApi } from '../api/vendedorApi';
import { createEquipeApi } from '../api/equipeApi';
import { createOfertaApi } from '../api/ofertaApi';
import { createFormularioApi } from '../api/formularioApi';
import { createCampoPersonalizadoApi } from '../api/campoPersonalizadoApi';
import { createSimuladorApi } from '../api/simuladorApi';

export function AppProvider({ children }) {
  const [materiais, setMateriais] = usePersisted("rjnet_materiais", isSupabaseMode() ? [] : MOCK_MATERIAIS);
  const [eventos, setEventos] = usePersisted("rjnet_eventos", isSupabaseMode() ? [] : MOCK_EVENTOS);
  const [leads, setLeads] = usePersisted("rjnet_leads", isSupabaseMode() ? [] : MOCK_LEADS);
  const [vendedores, setVendedores] = usePersisted("rjnet_vendedores", isSupabaseMode() ? [] : MOCK_VENDEDORES);
  // D-057: ofertas prontas por serviço (marketing) + indicador de envio (vendedor) — só em modo Supabase
  const [ofertas, setOfertas] = usePersisted("rjnet_ofertas", []);
  const [ofertasEnviadas, setOfertasEnviadas] = usePersisted("rjnet_ofertas_enviadas", []);
  // Form Builder: formulários configuráveis pelo marketing/comercial
  const [formularios, setFormularios] = usePersisted("rjnet_formularios", []);
  // Campos personalizados (sempre texto livre) reutilizáveis entre formulários
  const [camposPersonalizados, setCamposPersonalizados] = usePersisted("rjnet_campos_personalizados", []);
  // Simulador: campanhas de captação gamificada (QR + link de tráfego pago)
  const [simuladores, setSimuladores] = usePersisted("rjnet_simuladores", []);
  const [isLoading, setIsLoading] = useState(isSupabaseMode());
  const [syncStatus, setSyncStatus] = useState(SYNC_STATUS.IDLE);

  const abortRef = useRef(null);
  // TB-004/D-058: rastreia qual contexto (evento ou mês) tem leads carregados —
  // usado pelo realtime para recarregar o mesmo contexto.
  const leadsContextRef = useRef(null); // { tipo: 'evento' | 'mes', id }

  const carregar = async () => {
    abortRef.current?.abort();
    // QW-003: timeout de 15s para evitar loading infinito em conexão instável
    const controller = new AbortController();
    const timeoutSignal = AbortSignal.timeout(15_000);
    const signal = AbortSignal.any([controller.signal, timeoutSignal]);
    abortRef.current = controller;

    setSyncStatus(SYNC_STATUS.SYNCING);
    await flushPendingQueue();
    const dados = await fetchAll(signal);
    if (controller.signal.aborted) return;
    if (!dados) { setSyncStatus(SYNC_STATUS.ERROR); return; }
    setMateriais(dados.materiais);
    setVendedores(dados.vendedores);
    setEventos(dados.eventos);
    setOfertas(dados.ofertas);
    setFormularios(dados.formularios);
    setCamposPersonalizados(dados.camposPersonalizados);
    setSimuladores(dados.simuladores);
    // TB-004/D-058: recarrega leads do contexto ativo (evento ou mês) quando realtime dispara
    const ctx = leadsContextRef.current;
    if (ctx?.tipo === 'evento') {
      const [leadsData, enviosData] = await Promise.all([
        fetchLeadsEvento(ctx.id, signal),
        fetchOfertasEnviadasEvento(ctx.id, signal),
      ]);
      if (leadsData !== null && !controller.signal.aborted) setLeads(leadsData);
      if (enviosData !== null && !controller.signal.aborted) setOfertasEnviadas(enviosData);
    } else if (ctx?.tipo === 'mes') {
      const [leadsData, enviosData] = await Promise.all([
        fetchLeadsMes(ctx.id, signal),
        fetchOfertasEnviadasMes(ctx.id, signal),
      ]);
      if (leadsData !== null && !controller.signal.aborted) setLeads(leadsData);
      if (enviosData !== null && !controller.signal.aborted) setOfertasEnviadas(enviosData);
    } else if (ctx?.tipo === 'qrcode') {
      const leadsData = await fetchLeadsQrCode(signal);
      if (leadsData !== null && !controller.signal.aborted) setLeads(leadsData);
    }
    setSyncStatus(SYNC_STATUS.IDLE);
    setIsLoading(false);
  };

  // TB-004: carrega leads de um evento específico on-demand (+ ofertas já enviadas, D-057)
  const carregarLeadsEvento = async (eventoId) => {
    if (!isSupabaseMode() || !eventoId) return;
    leadsContextRef.current = { tipo: 'evento', id: eventoId };
    const [data, envios] = await Promise.all([fetchLeadsEvento(eventoId), fetchOfertasEnviadasEvento(eventoId)]);
    if (data !== null) setLeads(data);
    if (envios !== null) setOfertasEnviadas(envios);
  };

  // D-058: mesmo modelo on-demand, para leads de um mês de referência
  const carregarLeadsMes = async (mesReferencia) => {
    if (!isSupabaseMode() || !mesReferencia) return;
    leadsContextRef.current = { tipo: 'mes', id: mesReferencia };
    const [data, envios] = await Promise.all([fetchLeadsMes(mesReferencia), fetchOfertasEnviadasMes(mesReferencia)]);
    if (data !== null) setLeads(data);
    if (envios !== null) setOfertasEnviadas(envios);
  };

  // QR Code: não é contexto operacional (sem evento_id/mes_referencia), só
  // atribuição — RLS decide o recorte (vendedor só vê os já distribuídos).
  const carregarLeadsQrCode = async () => {
    if (!isSupabaseMode()) return;
    leadsContextRef.current = { tipo: 'qrcode' };
    const data = await fetchLeadsQrCode();
    if (data !== null) setLeads(data);
  };

  useEffect(() => {
    if (!isSupabaseMode()) return;
    carregar();
    const unsubRealtime = subscribeChanges(carregar);
    const unsubAuth = auth.onChange((evento) => {
      if (evento === 'SIGNED_IN') carregar();
      if (evento === 'SIGNED_OUT') {
        abortRef.current?.abort();
        setMateriais([]); setVendedores([]); setEventos([]); setLeads([]);
        setOfertas([]); setOfertasEnviadas([]); setFormularios([]); setCamposPersonalizados([]); setSimuladores([]);
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

  const { patchEvento, addEvento, updateEvento, removeEvento } =
    createEventoApi({ eventos, setEventos });

  const { addLead, updateLead, removeLead, obterRanking, obterRankingMes } =
    createLeadApi({ leads, setLeads });

  const { removeMaterial, addMaterial, updateMaterial, addMaterialEvento, removeMaterialEvento, toggleRetornadoEvento } =
    createMaterialApi({ materiais, setMateriais, eventos, patchEvento });

  const { addVendedor, updateVendedor, toggleVendedor } =
    createVendedorApi({ vendedores, setVendedores });

  const { criarUsuario, atualizarPerfil, excluirUsuario } =
    createEquipeApi({ recarregar: carregar });

  const { saveOferta, removeOferta, registrarOfertaEnviada } =
    createOfertaApi({ ofertas, setOfertas, setOfertasEnviadas });

  const { addFormulario, updateFormulario, removeFormulario } =
    createFormularioApi({ formularios, setFormularios });

  const { addCampoPersonalizado, updateCampoPersonalizado, removeCampoPersonalizado } =
    createCampoPersonalizadoApi({ camposPersonalizados, setCamposPersonalizados });

  const { addSimulador, updateSimulador, removeSimulador } =
    createSimuladorApi({ simuladores, setSimuladores });

  // TB-009: antes recalculava o flatMap sobre eventos/materiais a cada
  // chamada de getMateriaisDisponiveis() (EstoqueTab, Dashboard, EventDetail
  // chamam em todo render). Memoizado por [materiais, eventos] — a função
  // exposta no contexto só retorna o valor já calculado.
  const materiaisDisponiveis = useMemo(() =>
    materiais.map((mat) => {
      const emCampo = eventos
        .filter((e) => e.status === STATUS_EVENTO.ATIVO || e.status === STATUS_EVENTO.PLANEJADO)
        .flatMap((e) => e.materiais)
        .filter((mm) => mm.materialId === mat.id && !mm.retornado)
        .reduce((acc, mm) => acc + mm.quantidade, 0);
      return { material: mat, emCampo, disponivel: mat.quantidade - emCampo };
    }),
  [materiais, eventos]);

  const value = useMemo(() => ({
    materiais, eventos, leads, vendedores, ofertas, formularios, camposPersonalizados, simuladores,
    isLoading, syncStatus,
    addEvento, updateEvento, removeEvento,
    addLead, updateLead, removeLead,
    removeMaterial, addMaterial, updateMaterial,
    addMaterialEvento, removeMaterialEvento, toggleRetornadoEvento,
    addVendedor, updateVendedor, toggleVendedor,
    criarUsuario, atualizarPerfil, excluirUsuario,
    saveOferta, removeOferta, registrarOfertaEnviada,
    addFormulario, updateFormulario, removeFormulario,
    addCampoPersonalizado, updateCampoPersonalizado, removeCampoPersonalizado,
    addSimulador, updateSimulador, removeSimulador,
    obterRanking, obterRankingMes,
    recarregar: carregar,
    carregarLeadsEvento, carregarLeadsMes, carregarLeadsQrCode,
    getLeadsEvento: (eid) => leads.filter((l) => l.eventoId === eid),
    getLeadsMes: (mes) => leads.filter((l) => l.mesReferencia === mes),
    getEventosAtivos: () => eventos.filter((e) => e.status === STATUS_EVENTO.ATIVO),
    getOferta: (servico) => ofertas.find((o) => o.servico === servico),
    ofertaJaEnviada: (leadId, servico) => ofertasEnviadas.some((o) => o.leadId === leadId && o.servico === servico),
    getMateriaisDisponiveis: () => materiaisDisponiveis,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [materiais, eventos, leads, vendedores, ofertas, ofertasEnviadas, formularios, camposPersonalizados, simuladores, isLoading, syncStatus, materiaisDisponiveis]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
