import { db } from '../lib/dataService';

export function createOfertaApi({ ofertas, setOfertas, setOfertasEnviadas }) {
  return {
    saveOferta: (servico, { copy, file }, onError) => {
      const atual = ofertas.find((o) => o.servico === servico);
      setOfertas((p) => [
        ...p.filter((o) => o.servico !== servico),
        { servico, copy, imagemPath: atual?.imagemPath ?? null, imagemUrl: atual?.imagemUrl ?? null, atualizadoEm: new Date().toISOString() },
      ]);
      db.saveOferta({ servico, copy, file, oldImagemPath: atual?.imagemPath }, undefined, onError);
    },
    removeOferta: (servico) => {
      setOfertas((p) => p.filter((o) => o.servico !== servico));
      db.removeOferta(servico);
    },
    registrarOfertaEnviada: ({ leadId, eventoId, servico, vendedorId, vendedorNome }) => {
      setOfertasEnviadas((p) => [...p, { leadId, servico }]);
      db.registrarOfertaEnviada({ leadId, eventoId, servico, vendedorId, vendedorNome });
    },
  };
}
