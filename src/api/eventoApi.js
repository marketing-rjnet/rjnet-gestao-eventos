import { db } from '../lib/dataService';

export function createEventoApi({ eventos, setEventos, genId }) {
  const patchEvento = (id, patch) => {
    const atual = eventos.find((e) => e.id === id);
    setEventos((p) => p.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    if (atual) db.saveEvento({ ...atual, ...patch });
  };

  return {
    patchEvento,
    addEvento: (e) => {
      const novo = { ...e, id: genId('e'), criadoEm: new Date().toISOString() };
      setEventos((p) => [...p, novo]);
      db.saveEvento(novo);
    },
    updateEvento: patchEvento,
    removeEvento: (id) => {
      setEventos((p) => p.filter((e) => e.id !== id));
      db.removeEvento(id);
    },
  };
}
