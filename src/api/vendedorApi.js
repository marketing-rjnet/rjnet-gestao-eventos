import { db } from '../lib/dataService';
import { genId } from '../utils/ids';

export function createVendedorApi({ vendedores, setVendedores }) {
  return {
    addVendedor: (nome) => {
      const novo = { id: genId('v'), nome, ativo: true };
      setVendedores((p) => [...p, novo]);
      db.saveVendedor(novo);
    },
    updateVendedor: (id, patch) => {
      const atual = vendedores.find((v) => v.id === id);
      setVendedores((p) => p.map((v) => (v.id === id ? { ...v, ...patch } : v)));
      if (atual) db.saveVendedor({ ...atual, ...patch });
    },
    toggleVendedor: (id) => {
      const atual = vendedores.find((v) => v.id === id);
      setVendedores((p) => p.map((v) => (v.id === id ? { ...v, ativo: !v.ativo } : v)));
      if (atual) db.saveVendedor({ ...atual, ativo: !atual.ativo });
    },
  };
}
