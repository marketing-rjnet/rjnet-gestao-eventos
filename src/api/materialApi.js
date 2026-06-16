import { db } from '../lib/dataService';

export function createMaterialApi({ materiais, setMateriais, eventos, patchEvento, genId }) {
  return {
    addMaterial: (m) => {
      const novo = { ...m, id: genId('m') };
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
        materiais: [...ev.materiais, { materialId, quantidade: Number(quantidade), estadoSaida: 'ok', retornado: false }],
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
      patchEvento(eventoId, {
        materiais: ev.materiais.map((m, i) => (i === idx ? { ...m, retornado: !m.retornado } : m)),
      });
    },
  };
}
