import { db } from '../lib/dataService';
import { genId } from '../utils/ids';
import { STATUS_LP, sanitizarTracking, normalizarWhatsapp } from '../lib/aquisicao';

// D-104: Landing Pages — entidade GENÉRICA de aquisição (Fibra é só a
// primeira instância). Mesmo padrão factory de simuladorApi/formularioApi:
// atualização otimista local + db.save* fire-and-forget. Nada aqui é
// específico de um produto; cadastrar LP TV/Móvel/sazonal é só chamar
// addLandingPage com outro slug/serviço.
export function createLandingPageApi({ landingPages, setLandingPages }) {
  const normalizar = (lp) => ({
    ...lp,
    whatsappNumber: normalizarWhatsapp(lp.whatsappNumber),
    tracking: sanitizarTracking(lp.tracking),
  });

  return {
    addLandingPage: (lp) => {
      const novo = normalizar({
        status: STATUS_LP.PREPARACAO,
        whatsappEnabled: true,
        whatsappNumber: null,
        whatsappLabel: 'Falar no WhatsApp',
        whatsappMensagem: '',
        campanhaPadrao: '',
        tracking: {},
        ...lp,
        id: genId('lp'),
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      });
      setLandingPages((p) => [novo, ...p]);
      db.saveLandingPage(novo);
      return novo;
    },
    updateLandingPage: (id, patch) => {
      const atual = landingPages.find((l) => l.id === id);
      if (!atual) return;
      const atualizado = normalizar({ ...atual, ...patch, atualizadoEm: new Date().toISOString() });
      setLandingPages((p) => p.map((l) => (l.id === id ? atualizado : l)));
      db.saveLandingPage(atualizado);
    },
    removeLandingPage: (id) => {
      setLandingPages((p) => p.filter((l) => l.id !== id));
      db.removeLandingPage(id);
    },
  };
}
