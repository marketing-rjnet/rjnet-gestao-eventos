import { db } from '../lib/dataService';
import { genId } from '../utils/ids';

export function createFormularioApi({ formularios, setFormularios }) {
  return {
    addFormulario: (f) => {
      const novo = { ...f, id: genId('form'), ativo: true, criadoEm: new Date().toISOString() };
      setFormularios((p) => [novo, ...p]);
      db.saveFormulario(novo);
      return novo;
    },
    updateFormulario: (id, patch) => {
      const atual = formularios.find((f) => f.id === id);
      setFormularios((p) => p.map((f) => (f.id === id ? { ...f, ...patch } : f)));
      if (atual) db.saveFormulario({ ...atual, ...patch });
    },
    removeFormulario: (id) => {
      setFormularios((p) => p.filter((f) => f.id !== id));
      db.removeFormulario(id);
    },
  };
}
