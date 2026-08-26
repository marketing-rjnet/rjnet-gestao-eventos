import { db } from '../lib/dataService';
import { genId, slugify } from '../utils/ids';
import { calcularResultadoDesafio, TARGET_CENTISECONDS_PADRAO, MAX_TENTATIVAS_PADRAO } from '../lib/desafioCronometro';
import { broadcastDesafioPainel } from '../lib/desafioRealtime';

// Desafio RJNet — Acerte 00:03:33 (D-089, D-098). Mesmo padrão factory dos
// demais domínios: atualização otimista local + gravação assíncrona via
// db.*. `desafios` são os dias/edições (carregados no boot, tabela
// pequena); `entries` são os PARTICIPANTES do dia atualmente aberto na
// gestão (carregadas on-demand via carregarDesafioEntries), cada um já
// com o array `tentativas` anexado (D-098 — até `maxTentativas` linhas
// por participante, nunca colunas tentativa1/tentativa2/tentativa3).
export function createDesafioApi({ desafios, setDesafios, entries, setEntries }) {
  return {
    addDesafioEvento: ({ nome, targetCentiseconds, maxTentativas }) => {
      const novo = {
        id: genId('desafio'),
        nome,
        slug: `${slugify(nome)}-${Math.random().toString(36).slice(2, 6)}`,
        targetCentiseconds: targetCentiseconds || TARGET_CENTISECONDS_PADRAO,
        maxTentativas: maxTentativas || MAX_TENTATIVAS_PADRAO,
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
    // D-099: onSuccess dispara broadcastDesafioPainel — faltava aqui (bug
    // anterior ao D-098), então em modo Supabase (sem poll, só broadcast) a
    // Tela de TV nunca refletia a troca do prêmio até algum OUTRO evento
    // disparar um broadcast por coincidência.
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
        () => broadcastDesafioPainel(eventId),
        onError,
      );
    },

    // D-092/D-093: prêmios por posição do ranking (1º ao 10º) — independente
    // do prêmio geral acima. `ranking` chega com as 10 posições, cada uma
    // com `name` sendo uma das 3 opções fixas (`PREMIOS_POSICAO_RANKING`)
    // ou string vazia (sem prêmio) — sem imagem/ícone (D-093 removeu). 100%
    // otimista: sem upload, reflete na hora. D-099: broadcast no onSuccess
    // (mesmo fix do saveDesafioPremio acima).
    saveDesafioPremiosRanking: (eventId, { ranking }, onError) => {
      const atual = desafios.find((d) => d.id === eventId);
      if (!atual) { onError?.('Dia do desafio não encontrado.'); return; }
      setDesafios((p) => p.map((d) => (d.id === eventId ? {
        ...d,
        premiosRanking: ranking.map((r) => ({ position: r.position, nome: r.name })),
      } : d)));
      db.saveDesafioPremiosRanking(
        { eventId, ranking },
        () => broadcastDesafioPainel(eventId),
        onError,
      );
    },

    // Cadastro (D-089, D-090, D-098): cria o PARTICIPANTE já com a 1ª
    // tentativa — calcula tudo (centésimos, diferença, acerto exato) ANTES
    // de gravar, mesmo princípio de sempre. `prizeType` (opcional, D-098) é
    // o prêmio que a pessoa está concorrendo/recebeu, mesmo catálogo
    // TIPOS_PREMIO já usado no controle de entrega dos ganhadores — aqui só
    // populado mais cedo, no cadastro, em vez de só depois em Ganhadores.
    // Tentativas seguintes usam addDesafioTentativa() sobre este MESMO id —
    // o operador nunca recadastra a pessoa. Ganhadores instantâneos e
    // ranking nunca são listas separadas no banco: um participante entra
    // num ou noutro conforme sua MELHOR tentativa (melhorTentativa(),
    // desafioCronometro.js) tiver isExactHit ou não.
    addDesafioEntry: (eventId, { participantName, phone, prizeType, jaClienteRjnet }, resultDisplay, onError) => {
      const desafio = desafios.find((d) => d.id === eventId);
      if (!desafio) { onError?.('Dia do desafio não encontrado.'); return null; }
      let calculo;
      try {
        calculo = calcularResultadoDesafio({ resultDisplay, targetCentiseconds: desafio.targetCentiseconds });
      } catch (err) {
        onError?.(err.message);
        return null;
      }
      const entryId = genId('tce');
      const tentativa1 = { id: genId('tca'), eventId, entryId, attemptNumber: 1, ...calculo, criadoEm: new Date().toISOString() };
      const novo = {
        id: entryId,
        eventId,
        participantName: participantName.trim(),
        phone: (phone || '').trim(),
        prizeType: prizeType || null,
        delivered: false,
        deliveryResponsible: null,
        deliveryAt: null,
        // D-099: mesmo campo/semântica de leads.jaClienteRjnet.
        jaClienteRjnet: jaClienteRjnet ?? false,
        criadoEm: new Date().toISOString(),
        tentativas: [tentativa1],
      };
      setEntries((p) => [novo, ...p]);
      db.saveDesafioEntry(novo, () => broadcastDesafioPainel(eventId), () => onError?.('Falha ao salvar — tentando novamente.'));
      db.saveDesafioAttempt(tentativa1, () => broadcastDesafioPainel(eventId), () => onError?.('Falha ao salvar a tentativa — tentando novamente.'));
      return novo;
    },

    // D-098: nova tentativa sobre um participante JÁ cadastrado — nunca
    // cria um segundo registro (o operador não recadastra a pessoa).
    // Bloqueia além do limite configurado do dia (`maxTentativas`, padrão
    // 3) — "depois da terceira tentativa, não permitir uma quarta".
    addDesafioTentativa: (entryId, resultDisplay, onError) => {
      const atual = entries.find((e) => e.id === entryId);
      if (!atual) { onError?.('Participante não encontrado.'); return null; }
      const desafio = desafios.find((d) => d.id === atual.eventId);
      if (!desafio) { onError?.('Dia do desafio não encontrado.'); return null; }
      const max = desafio.maxTentativas || MAX_TENTATIVAS_PADRAO;
      const tentativasAtuais = atual.tentativas || [];
      if (tentativasAtuais.length >= max) { onError?.(`Limite de ${max} tentativas atingido para este participante.`); return null; }
      let calculo;
      try {
        calculo = calcularResultadoDesafio({ resultDisplay, targetCentiseconds: desafio.targetCentiseconds });
      } catch (err) {
        onError?.(err.message);
        return null;
      }
      const proximoNumero = tentativasAtuais.length + 1;
      const nova = { id: genId('tca'), eventId: atual.eventId, entryId, attemptNumber: proximoNumero, ...calculo, criadoEm: new Date().toISOString() };
      setEntries((p) => p.map((e) => (e.id === entryId ? { ...e, tentativas: [...(e.tentativas || []), nova] } : e)));
      db.saveDesafioAttempt(nova, () => broadcastDesafioPainel(atual.eventId), () => onError?.('Falha ao salvar — tentando novamente.'));
      return nova;
    },

    // Correção de uma tentativa já registrada — mesmo cálculo de sempre
    // (calcularResultadoDesafio, contra o target do dia), só que sobre o
    // id da tentativa existente em vez de criar uma nova. Nunca mexe em
    // attemptNumber (identidade da tentativa dentro do participante).
    updateDesafioTentativa: (entryId, attemptId, resultDisplay, onError) => {
      const atual = entries.find((e) => e.id === entryId);
      if (!atual) { onError?.('Participante não encontrado.'); return null; }
      const tentativaAtual = (atual.tentativas || []).find((t) => t.id === attemptId);
      if (!tentativaAtual) { onError?.('Tentativa não encontrada.'); return null; }
      const desafio = desafios.find((d) => d.id === atual.eventId);
      if (!desafio) { onError?.('Dia do desafio não encontrado.'); return null; }
      let calculo;
      try {
        calculo = calcularResultadoDesafio({ resultDisplay, targetCentiseconds: desafio.targetCentiseconds });
      } catch (err) {
        onError?.(err.message);
        return null;
      }
      const atualizada = { ...tentativaAtual, ...calculo };
      setEntries((p) => p.map((e) => (e.id === entryId
        ? { ...e, tentativas: (e.tentativas || []).map((t) => (t.id === attemptId ? atualizada : t)) }
        : e)));
      db.updateDesafioAttempt(atualizada, () => broadcastDesafioPainel(atual.eventId), () => onError?.('Falha ao salvar — tentando novamente.'));
      return atualizada;
    },

    // D-098/D-099: edição rápida do participante — SEMPRE sobre o id do
    // registro existente (nunca nome/telefone como identificador, nunca
    // cria um participante novo). Só toca nome/telefone/já-cliente;
    // tentativas, prêmio, evento e ranking ficam intocados (preservados
    // via spread de `atual`).
    updateDesafioParticipante: (entryId, { participantName, phone, jaClienteRjnet }, onError) => {
      const atual = entries.find((e) => e.id === entryId);
      if (!atual) { onError?.('Participante não encontrado.'); return; }
      const atualizado = {
        ...atual,
        ...(participantName !== undefined ? { participantName: participantName.trim() } : {}),
        ...(phone !== undefined ? { phone: phone.trim() } : {}),
        ...(jaClienteRjnet !== undefined ? { jaClienteRjnet } : {}),
      };
      setEntries((p) => p.map((e) => (e.id === entryId ? atualizado : e)));
      db.saveDesafioEntry(atualizado, () => broadcastDesafioPainel(atual.eventId), () => onError?.('Falha ao salvar — tentando novamente.'));
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
