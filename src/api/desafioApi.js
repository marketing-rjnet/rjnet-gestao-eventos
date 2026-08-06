import { db } from '../lib/dataService';
import { genId, slugify } from '../utils/ids';
import { calcularResultadoDesafio, TARGET_CENTISECONDS_PADRAO } from '../lib/desafioCronometro';
import { broadcastDesafioPainel } from '../lib/desafioRealtime';

// Desafio RJNet — Acerte 00:03:33 (D-089). Mesmo padrão factory dos
// demais domínios: atualização otimista local + gravação assíncrona via
// db.*. `desafios` são os dias/edições (carregados no boot, tabela
// pequena); `entries` são as participações do dia atualmente aberto na
// gestão (carregadas on-demand via carregarDesafioEntries).
export function createDesafioApi({ desafios, setDesafios, entries, setEntries }) {
  return {
    addDesafioEvento: ({ nome, targetCentiseconds }) => {
      const novo = {
        id: genId('desafio'),
        nome,
        slug: `${slugify(nome)}-${Math.random().toString(36).slice(2, 6)}`,
        targetCentiseconds: targetCentiseconds || TARGET_CENTISECONDS_PADRAO,
        ativo: true,
        criadoEm: new Date().toISOString(),
      };
      setDesafios((p) => [novo, ...p]);
      db.saveDesafioEvento(novo);
      return novo;
    },
    updateDesafioEvento: (id, patch) => {
      const atual = desafios.find((d) => d.id === id);
      setDesafios((p) => p.map((d) => (d.id === id ? { ...d, ...patch } : d)));
      if (atual) db.saveDesafioEvento({ ...atual, ...patch });
    },
    removeDesafioEvento: (id) => {
      setDesafios((p) => p.filter((d) => d.id !== id));
      db.removeDesafioEvento(id);
    },

    // D-091: prêmio do dia (descrição + imagem, ex: streaming — Disney+/HBO
    // Max/RJNet Play), exibido ao lado do ranking na Tela de TV. Atualização
    // otimista local com o que já se sabe na hora (descrição sempre; imagem
    // só é confirmada depois do upload — db.saveDesafioPremio devolve o path
    // final via onSuccess, recarregado no próximo fetchAll/realtime).
    saveDesafioPremio: (eventId, { descricao, file, removerImagem }, onError) => {
      const atual = desafios.find((d) => d.id === eventId);
      if (!atual) { onError?.('Dia do desafio não encontrado.'); return; }
      setDesafios((p) => p.map((d) => (d.id === eventId ? {
        ...d,
        premioDescricao: descricao,
        ...(removerImagem ? { premioImagemPath: null, premioImagemUrl: null } : {}),
      } : d)));
      db.saveDesafioPremio(
        { eventId, descricao, file, removerImagem, oldImagemPath: atual.premioImagemPath },
        undefined,
        onError,
      );
    },

    // D-092: prêmios por posição do ranking (1º ao 10º) — independente do
    // prêmio geral acima. `ranking` chega já com as 10 posições (nome +
    // file novo opcional + flag de remover ícone), montado pelo
    // DesafioPremio.jsx a partir do estado local do formulário. Otimista:
    // nome sempre reflete na hora; ícone só é confirmado após o upload.
    saveDesafioPremiosRanking: (eventId, { ranking }, onError) => {
      const atual = desafios.find((d) => d.id === eventId);
      if (!atual) { onError?.('Dia do desafio não encontrado.'); return; }
      const atuaisPorPosicao = new Map((atual.premiosRanking || []).map((p) => [p.position, p]));
      setDesafios((p) => p.map((d) => (d.id === eventId ? {
        ...d,
        premiosRanking: ranking.map((r) => ({
          position: r.position,
          nome: r.name,
          iconPath: r.removerIcone ? null : (atuaisPorPosicao.get(r.position)?.iconPath ?? null),
          iconUrl: r.removerIcone ? null : (atuaisPorPosicao.get(r.position)?.iconUrl ?? null),
        })),
      } : d)));
      db.saveDesafioPremiosRanking(
        {
          eventId,
          ranking: ranking.map((r) => ({
            position: r.position, name: r.name, file: r.file, removerIcone: r.removerIcone,
            oldIconPath: atuaisPorPosicao.get(r.position)?.iconPath ?? null,
          })),
        },
        undefined,
        onError,
      );
    },

    // Cadastro (D-089, D-090): recebe o texto digitado no cronômetro
    // (MM:SS:CC) e o alvo do dia — calcula tudo (centésimos, diferença,
    // acerto exato) ANTES de gravar. Ganhadores instantâneos e ranking
    // nunca são listas separadas no banco: são o MESMO array filtrado por
    // `isExactHit`. D-090: não existe mais um "número do participante" à
    // parte — o telefone (opcional) já cumpre esse papel.
    addDesafioEntry: (eventId, { participantName, phone }, resultDisplay, onError) => {
      const desafio = desafios.find((d) => d.id === eventId);
      if (!desafio) { onError?.('Dia do desafio não encontrado.'); return null; }
      let calculo;
      try {
        calculo = calcularResultadoDesafio({ resultDisplay, targetCentiseconds: desafio.targetCentiseconds });
      } catch (err) {
        onError?.(err.message);
        return null;
      }
      const novo = {
        id: genId('tce'),
        eventId,
        participantName: participantName.trim(),
        phone: (phone || '').trim(),
        ...calculo,
        prizeType: null,
        delivered: false,
        deliveryResponsible: null,
        deliveryAt: null,
        criadoEm: new Date().toISOString(),
      };
      setEntries((p) => [novo, ...p]);
      db.saveDesafioEntry(novo, () => broadcastDesafioPainel(eventId), () => onError?.('Falha ao salvar — tentando novamente.'));
      return novo;
    },

    // Controle de entrega do prêmio — só relevante para ganhadores instantâneos.
    atualizarEntregaPremio: (id, { prizeType, delivered, deliveryResponsible }) => {
      const atual = entries.find((e) => e.id === id);
      if (!atual) return;
      const atualizado = {
        ...atual,
        ...(prizeType !== undefined ? { prizeType } : {}),
        ...(delivered !== undefined ? {
          delivered,
          deliveryAt: delivered ? new Date().toISOString() : null,
        } : {}),
        ...(deliveryResponsible !== undefined ? { deliveryResponsible } : {}),
      };
      setEntries((p) => p.map((e) => (e.id === id ? atualizado : e)));
      db.saveDesafioEntry(atualizado, () => broadcastDesafioPainel(atualizado.eventId));
    },

    removeDesafioEntry: (id) => {
      const atual = entries.find((e) => e.id === id);
      setEntries((p) => p.filter((e) => e.id !== id));
      db.removeDesafioEntry(id, () => atual && broadcastDesafioPainel(atual.eventId));
    },
  };
}
