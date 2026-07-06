import { db } from '../lib/dataService';
import { genId, slugify } from '../utils/ids';

// Campo personalizado: sempre texto livre — só a legenda é definida pela
// equipe (marketing/comercial), nunca um tipo/validação novo. Reutilizável
// em qualquer formulário (não é específico de um form).
export function createCampoPersonalizadoApi({ camposPersonalizados, setCamposPersonalizados }) {
  return {
    addCampoPersonalizado: (label) => {
      const novo = {
        id: genId('campo'),
        label,
        key: `${slugify(label)}-${Math.random().toString(36).slice(2, 6)}`,
        ativo: true,
        criadoEm: new Date().toISOString(),
      };
      setCamposPersonalizados((p) => [novo, ...p]);
      db.saveCampoPersonalizado(novo);
      return novo;
    },
    updateCampoPersonalizado: (id, patch) => {
      const atual = camposPersonalizados.find((c) => c.id === id);
      setCamposPersonalizados((p) => p.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      if (atual) db.saveCampoPersonalizado({ ...atual, ...patch });
    },
    removeCampoPersonalizado: (id) => {
      setCamposPersonalizados((p) => p.filter((c) => c.id !== id));
      db.removeCampoPersonalizado(id);
    },
  };
}
