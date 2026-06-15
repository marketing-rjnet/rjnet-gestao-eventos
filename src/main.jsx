import React, { createContext, useEffect, useRef, useMemo, useState, Component } from 'react';
import ReactDOM from 'react-dom/client';
import { Chart, registerables } from 'chart.js';
import { supabaseEnabled } from './lib/supabase';
import { fetchAll, db, subscribeChanges, auth, rankingEvento, invalidarRanking, flushPendingQueue } from './lib/dataService';
import { SYNC_STATUS, STATUS_EVENTO } from './lib/constants';
import './index.css';
import { MOCK_MATERIAIS, MOCK_VENDEDORES, MOCK_EVENTOS, MOCK_LEADS } from './utils/mockData';
import { usePersisted } from './hooks/usePersisted';
import Root from './apps/Root';

Chart.register(...registerables);



      Chart.defaults.color = "#666";
      Chart.defaults.font.family = "DM Sans, sans-serif";

      /* ============================================================
         APP CONTEXT (state + Supabase-ready actions)
         ============================================================ */
      /* ============================================================
         ERROR BOUNDARY — captura exceções em qualquer filho
         ============================================================ */
      class ErrorBoundary extends Component {
        constructor(props) { super(props); this.state = { hasError: false, message: "" }; }
        static getDerivedStateFromError(error) { return { hasError: true, message: error?.message || "Erro desconhecido." }; }
        componentDidCatch(error, info) { console.error("[rjnet] Erro não tratado:", error, info); }
        render() {
          if (this.state.hasError) {
            return (
              <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--red, #ef4444)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r=".5" fill="var(--red, #ef4444)"/></svg>
                <div style={{ fontWeight: 700, fontSize: 18 }}>Algo deu errado</div>
                <div style={{ color: "var(--text-3, #666)", fontSize: 14, maxWidth: 320 }}>{this.state.message}</div>
                <button className="btn-primary" onClick={() => window.location.reload()}>Recarregar</button>
              </div>
            );
          }
          return this.props.children;
        }
      }

      export const AppContext = createContext(null);

      function AppProvider({ children }) {
        // Com Supabase ativo o banco é a fonte de verdade — não inicializa com
        // dados fictícios (eles só existem no modo 100% local)
        const [materiais, setMateriais] = usePersisted("rjnet_materiais", supabaseEnabled ? [] : MOCK_MATERIAIS);
        const [eventos, setEventos] = usePersisted("rjnet_eventos", supabaseEnabled ? [] : MOCK_EVENTOS);
        const [leads, setLeads] = usePersisted("rjnet_leads", supabaseEnabled ? [] : MOCK_LEADS);
        const [vendedores, setVendedores] = usePersisted("rjnet_vendedores", supabaseEnabled ? [] : MOCK_VENDEDORES);
        const [isLoading, setIsLoading] = useState(supabaseEnabled);
        const [syncStatus, setSyncStatus] = useState(SYNC_STATUS.IDLE);

        const abortRef = useRef(null);
        const carregar = async () => {
          // Cancela requisição anterior que ainda esteja em voo
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

        // Placar do evento: com auth ativa vem do servidor (o vendedor não
        // tem acesso aos leads dos colegas); sem Supabase, calcula localmente
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

        const genId = (prefix) => prefix + Date.now() + Math.random().toString(36).slice(2, 7);

        const patchEvento = (id, patch) => {
          const atual = eventos.find((e) => e.id === id);
          setEventos((p) => p.map((e) => (e.id === id ? { ...e, ...patch } : e)));
          if (atual) db.saveEvento({ ...atual, ...patch });
        };

        const value = useMemo(() => ({
          materiais, eventos, leads, vendedores,
          isLoading, syncStatus,
          addEvento: (e) => {
            const novo = { ...e, id: genId("e"), criadoEm: new Date().toISOString() };
            setEventos((p) => [...p, novo]);
            db.saveEvento(novo);
          },
          updateEvento: patchEvento,
          removeEvento: (id) => {
            setEventos((p) => p.filter((e) => e.id !== id));
            db.removeEvento(id);
          },
          addLead: (l) => {
            const novo = { id: genId("l"), criadoEm: new Date().toISOString(), ...l };
            setLeads((p) => [...p, novo]);
            db.saveLead(novo);
            if (novo.eventoId) invalidarRanking(novo.eventoId);
          },
          updateLead: (id, patch) => {
            const atual = leads.find((l) => l.id === id);
            setLeads((p) => p.map((l) => l.id === id ? { ...l, ...patch } : l));
            if (atual) { db.saveLead({ ...atual, ...patch }); invalidarRanking(atual.eventoId); }
          },
          removeLead: (id) => {
            const atual = leads.find((l) => l.id === id);
            setLeads((p) => p.filter((l) => l.id !== id));
            db.removeLead(id);
            if (atual?.eventoId) invalidarRanking(atual.eventoId);
          },
          addMaterial: (m) => {
            const novo = { ...m, id: genId("m") };
            setMateriais((p) => [...p, novo]);
            db.saveMaterial(novo);
          },
          updateMaterial: (id, patch) => {
            const atual = materiais.find((m) => m.id === id);
            setMateriais((p) => p.map((m) => (m.id === id ? { ...m, ...patch } : m)));
            if (atual) db.saveMaterial({ ...atual, ...patch });
          },
          addMaterialEvento: (eventoId, materialId, quantidade) => {
            const ev = eventos.find((e) => e.id === eventoId);
            if (!ev) return;
            patchEvento(eventoId, {
              materiais: [...ev.materiais, { materialId, quantidade: Number(quantidade), estadoSaida: "ok", retornado: false }]
            });
          },
          removeMaterialEvento: (eventoId, idx) => {
            const ev = eventos.find((e) => e.id === eventoId);
            if (!ev) return;
            patchEvento(eventoId, { materiais: ev.materiais.filter((_, i) => i !== idx) });
          },
          toggleRetornadoEvento: (eventoId, idx) => {
            const ev = eventos.find((e) => e.id === eventoId);
            if (!ev) return;
            patchEvento(eventoId, { materiais: ev.materiais.map((m, i) => i === idx ? { ...m, retornado: !m.retornado } : m) });
          },
          addVendedor: (nome) => {
            const novo = { id: genId("v"), nome, ativo: true };
            setVendedores((p) => [...p, novo]);
            db.saveVendedor(novo);
          },
          updateVendedor: (id, patch) => {
            const atual = vendedores.find((v) => v.id === id);
            setVendedores((p) => p.map((v) => v.id === id ? { ...v, ...patch } : v));
            if (atual) db.saveVendedor({ ...atual, ...patch });
          },
          toggleVendedor: (id) => {
            const atual = vendedores.find((v) => v.id === id);
            setVendedores((p) => p.map((v) => (v.id === id ? { ...v, ativo: !v.ativo } : v)));
            if (atual) db.saveVendedor({ ...atual, ativo: !atual.ativo });
          },
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


      ReactDOM.createRoot(document.getElementById("root")).render(
        <ErrorBoundary>
          <AppProvider><Root /></AppProvider>
        </ErrorBoundary>
      );
