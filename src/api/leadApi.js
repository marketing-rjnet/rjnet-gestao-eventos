import { db, invalidarRanking, rankingEvento, invalidarRankingMes, rankingMes } from '../lib/dataService';
import { genId } from '../utils/ids';
import { isSupabaseMode } from '../lib/mode';
import { logActivity } from '../lib/activityLog';

// D-058: invalida o placar certo (evento ou mês) conforme o contexto do lead.
const invalidarPlacar = (l) => {
  if (l?.eventoId) invalidarRanking(l.eventoId);
  if (l?.mesReferencia) invalidarRankingMes(l.mesReferencia);
};

export function createLeadApi({ leads, setLeads }) {
  return {
    addLead: (l) => {
      const novo = { id: genId('l'), criadoEm: new Date().toISOString(), ...l };
      setLeads((p) => [...p, novo]);
      logActivity({ type: 'lead_add', vendedor: novo.vendedorNome, eventoId: novo.eventoId, mesReferencia: novo.mesReferencia, detail: novo.nome });
      db.saveLead(novo, () => {
        logActivity({ type: 'lead_sync_ok', vendedor: novo.vendedorNome, eventoId: novo.eventoId, mesReferencia: novo.mesReferencia, detail: novo.nome });
      });
      invalidarPlacar(novo);
      return novo;
    },
    updateLead: (id, patch) => {
      const atual = leads.find((l) => l.id === id);
      setLeads((p) => p.map((l) => (l.id === id ? { ...l, ...patch } : l)));
      if (atual) {
        const atualizado = { ...atual, ...patch };
        logActivity({ type: 'lead_update', vendedor: atual.vendedorNome, eventoId: atual.eventoId, mesReferencia: atual.mesReferencia, detail: atual.nome });
        db.saveLead(atualizado, () => {
          logActivity({ type: 'lead_sync_ok', vendedor: atual.vendedorNome, eventoId: atual.eventoId, mesReferencia: atual.mesReferencia, detail: atual.nome });
        });
        invalidarPlacar(atual);
      }
    },
    removeLead: (id) => {
      const atual = leads.find((l) => l.id === id);
      setLeads((p) => p.filter((l) => l.id !== id));
      db.removeLead(
        id,
        () => { if (atual) setLeads((p) => [...p, atual]); },
        () => { if (atual) logActivity({ type: 'lead_sync_ok', vendedor: atual.vendedorNome, eventoId: atual.eventoId, mesReferencia: atual.mesReferencia, detail: atual.nome }); },
        { vendedor: atual?.vendedorNome, eventoId: atual?.eventoId, mesReferencia: atual?.mesReferencia },
      );
      invalidarPlacar(atual);
      if (atual) logActivity({ type: 'lead_remove', level: 'warn', vendedor: atual.vendedorNome, eventoId: atual.eventoId, mesReferencia: atual.mesReferencia, detail: atual.nome });
    },
    obterRanking: async (eventoId) => {
      if (isSupabaseMode()) {
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
    },
    // D-058: mesmo placar, só que agregado por mês de referência em vez de evento.
    obterRankingMes: async (mesReferencia) => {
      if (isSupabaseMode()) {
        const r = await rankingMes(mesReferencia);
        if (r) return r;
      }
      const mapa = {};
      leads.filter((l) => l.mesReferencia === mesReferencia).forEach((l) => {
        mapa[l.vendedorNome] = (mapa[l.vendedorNome] || 0) + 1;
      });
      return Object.entries(mapa)
        .map(([nome, total]) => ({ nome, total }))
        .sort((a, b) => b.total - a.total);
    },
  };
}
