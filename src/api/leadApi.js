import { db, invalidarRanking } from '../lib/dataService';

export function createLeadApi({ leads, setLeads, genId }) {
  return {
    addLead: (l) => {
      const novo = { id: genId('l'), criadoEm: new Date().toISOString(), ...l };
      setLeads((p) => [...p, novo]);
      db.saveLead(novo);
      if (novo.eventoId) invalidarRanking(novo.eventoId);
    },
    updateLead: (id, patch) => {
      const atual = leads.find((l) => l.id === id);
      setLeads((p) => p.map((l) => (l.id === id ? { ...l, ...patch } : l)));
      if (atual) { db.saveLead({ ...atual, ...patch }); invalidarRanking(atual.eventoId); }
    },
    removeLead: (id) => {
      const atual = leads.find((l) => l.id === id);
      setLeads((p) => p.filter((l) => l.id !== id));
      db.removeLead(id);
      if (atual?.eventoId) invalidarRanking(atual.eventoId);
    },
  };
}
