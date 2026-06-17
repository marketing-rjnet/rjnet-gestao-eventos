import { db, invalidarRanking, rankingEvento } from '../lib/dataService';
import { genId } from '../utils/ids';
import { isSupabaseMode } from '../lib/mode';
import { logActivity } from '../lib/activityLog';

export function createLeadApi({ leads, setLeads }) {
  return {
    addLead: (l) => {
      const novo = { id: genId('l'), criadoEm: new Date().toISOString(), ...l };
      setLeads((p) => [...p, novo]);
      db.saveLead(novo);
      if (novo.eventoId) invalidarRanking(novo.eventoId);
      logActivity({ type: 'lead_add', vendedor: novo.vendedorNome, eventoId: novo.eventoId, detail: novo.nome });
      return novo;
    },
    updateLead: (id, patch) => {
      const atual = leads.find((l) => l.id === id);
      setLeads((p) => p.map((l) => (l.id === id ? { ...l, ...patch } : l)));
      if (atual) {
        db.saveLead({ ...atual, ...patch });
        invalidarRanking(atual.eventoId);
        logActivity({ type: 'lead_update', vendedor: atual.vendedorNome, eventoId: atual.eventoId, detail: atual.nome });
      }
    },
    removeLead: (id) => {
      const atual = leads.find((l) => l.id === id);
      setLeads((p) => p.filter((l) => l.id !== id));
      db.removeLead(id, () => {
        if (atual) setLeads((p) => [...p, atual]);
      });
      if (atual?.eventoId) invalidarRanking(atual.eventoId);
      if (atual) logActivity({ type: 'lead_remove', level: 'warn', vendedor: atual.vendedorNome, eventoId: atual.eventoId, detail: atual.nome });
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
  };
}
