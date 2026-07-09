import { db } from '../lib/dataService';
import { genId } from '../utils/ids';
import { PERGUNTAS_SIMULADOR_VERSAO, perguntasPadrao } from '../lib/simulador';

export function createSimuladorApi({ simuladores, setSimuladores }) {
  return {
    addSimulador: (s) => {
      const novo = {
        ...s, id: genId('sim'), ativo: true,
        versaoPerguntas: PERGUNTAS_SIMULADOR_VERSAO,
        // D-075: campanha de perfil_consumo já nasce com um questionário
        // padrão editável (o marketing ajusta depois); territorial não usa.
        perguntas: s.tipo === 'perfil_consumo' ? perguntasPadrao() : null,
        criadoEm: new Date().toISOString(),
      };
      setSimuladores((p) => [novo, ...p]);
      db.saveSimulador(novo);
      return novo;
    },
    updateSimulador: (id, patch) => {
      const atual = simuladores.find((s) => s.id === id);
      setSimuladores((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      if (atual) db.saveSimulador({ ...atual, ...patch });
    },
    removeSimulador: (id) => {
      setSimuladores((p) => p.filter((s) => s.id !== id));
      db.removeSimulador(id);
    },
  };
}
