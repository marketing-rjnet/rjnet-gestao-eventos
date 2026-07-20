import { db } from '../lib/dataService';
import { genId } from '../utils/ids';
import {
  PERGUNTAS_SIMULADOR_VERSAO, perguntasPadrao, mensagemResultadoPadrao,
  quizPerguntasPadrao, quizFaixasPadrao,
} from '../lib/simulador';

export function createSimuladorApi({ simuladores, setSimuladores }) {
  return {
    addSimulador: (s) => {
      const novo = {
        ...s, id: genId('sim'), ativo: true,
        versaoPerguntas: PERGUNTAS_SIMULADOR_VERSAO,
        // D-076: campanha 'demanda' já nasce com um questionário padrão
        // editável + uma mensagem de resultado padrão editável; 'oferta'
        // não usa nenhum dos dois (fluxo fixo de perfil→pacote). D-080:
        // 'quiz' já nasce com o molde de exemplo (MotoFest) + faixas de
        // classificação padrão, ambos editáveis pelo marketing.
        perguntas: s.tipo === 'demanda' ? perguntasPadrao() : null,
        mensagemResultado: s.tipo === 'demanda' ? mensagemResultadoPadrao() : null,
        quizPerguntas: s.tipo === 'quiz' ? quizPerguntasPadrao() : null,
        quizFaixas: s.tipo === 'quiz' ? quizFaixasPadrao() : null,
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
