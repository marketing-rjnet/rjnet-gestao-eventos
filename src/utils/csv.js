// onAudit: callback opcional (async) chamado após o download com { totalRegistros }
export function exportLeadsCSV(dados, sufixo, servicoLabel, evName, onAudit) {
  if (dados.length === 0) return;
  const cabecalho = ["Nome", "CPF", "Telefone", "Endereço", "Serviço", "Temperatura", "Já Cliente RJNet", "Vendedor", "Evento", "Observação", "Cadastrado em"];
  const linhas = dados.map((l) => [
    l.nome, l.cpf || "", l.telefone, l.endereco || "",
    servicoLabel(l.servicoInteresse), l.temperatura,
    l.jaClienteRjnet ? "Sim" : "Não",
    l.vendedorNome, evName(l.eventoId),
    (l.observacao || "").replace(/"/g, '""'),
    new Date(l.criadoEm).toLocaleString("pt-BR"),
  ]);
  const csv = [cabecalho, ...linhas].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads_${sufixo}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  if (onAudit) onAudit({ totalRegistros: dados.length });
}

// Export consolidado: leads de múltiplos eventos, agrupados por evento.
// onAudit: callback opcional chamado após o download com { totalRegistros, totalEventos }
export function exportLeadsConsolidadoCSV(leads, evName, servicoLabelFn, onAudit) {
  if (leads.length === 0) return;
  const cabecalho = ["Evento", "Nome", "CPF", "Telefone", "Endereço", "Serviço", "Temperatura", "Já Cliente RJNet", "Vendedor", "Observação", "Cadastrado em"];
  const linhas = leads.map((l) => [
    evName(l.eventoId),
    l.nome, l.cpf || "", l.telefone, l.endereco || "",
    servicoLabelFn(l.servicoInteresse), l.temperatura,
    l.jaClienteRjnet ? "Sim" : "Não",
    l.vendedorNome,
    (l.observacao || "").replace(/"/g, '""'),
    new Date(l.criadoEm).toLocaleString("pt-BR"),
  ]);
  const csv = [cabecalho, ...linhas].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads_consolidado_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  const totalEventos = new Set(leads.map((l) => l.eventoId)).size;
  if (onAudit) onAudit({ totalRegistros: leads.length, totalEventos });
}

// D-061/D-072: export da fila de distribuição — leads captados por QR
// Code/Formulário/Simulador que ainda estão "em espera" (sem vendedor
// atribuído). Espelha o padrão das demais exportações desta tela: colunas
// resolvidas via funções passadas pelo chamador (servicoLabel, origemDetalhe,
// camposExtrasTexto), nunca lógica de negócio aqui.
// onAudit: callback opcional (async) chamado após o download com { totalRegistros }
export function exportLeadsSemVendedorCSV(leads, servicoLabelFn, origemDetalheFn, camposExtrasTextoFn, onAudit) {
  if (leads.length === 0) return;
  const cabecalho = ["Nome", "Telefone", "Cidade", "Bairro", "Serviço", "Perfil/Pontuação", "Temperatura", "Origem", "Campos Extras", "Responsável", "Cadastrado em"];
  const linhas = leads.map((l) => [
    l.nome, l.telefone, l.cidade || "", l.bairro || "",
    servicoLabelFn(l.servicoInteresse),
    l.pontuacao != null ? `${l.pontuacao}${l.perfilConsumo?.tipo === 'quiz' ? ' acertos' : ' pts'}` : "",
    l.temperatura || "",
    origemDetalheFn(l),
    camposExtrasTextoFn(l),
    l.vendedorNome || "Não atribuído",
    new Date(l.criadoEm).toLocaleString("pt-BR"),
  ]);
  const csv = [cabecalho, ...linhas].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads_em_espera_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  if (onAudit) onAudit({ totalRegistros: leads.length });
}

// D-058: export de leads de um único mês de referência (fora de eventos).
// onAudit: callback opcional (async) chamado após o download com { totalRegistros }
export function exportLeadsMesCSV(dados, sufixo, servicoLabel, mesLabel, onAudit) {
  if (dados.length === 0) return;
  const cabecalho = ["Nome", "CPF", "Telefone", "Endereço", "Serviço", "Temperatura", "Já Cliente RJNet", "Vendedor", "Mês", "Observação", "Cadastrado em"];
  const linhas = dados.map((l) => [
    l.nome, l.cpf || "", l.telefone, l.endereco || "",
    servicoLabel(l.servicoInteresse), l.temperatura,
    l.jaClienteRjnet ? "Sim" : "Não",
    l.vendedorNome, mesLabel(l.mesReferencia),
    (l.observacao || "").replace(/"/g, '""'),
    new Date(l.criadoEm).toLocaleString("pt-BR"),
  ]);
  const csv = [cabecalho, ...linhas].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads_${sufixo}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  if (onAudit) onAudit({ totalRegistros: dados.length });
}

// Export consolidado: leads de múltiplos meses, agrupados por mês.
// onAudit: callback opcional chamado após o download com { totalRegistros, totalMeses }
export function exportLeadsMesConsolidadoCSV(leads, mesLabel, servicoLabelFn, onAudit) {
  if (leads.length === 0) return;
  const cabecalho = ["Mês", "Nome", "CPF", "Telefone", "Endereço", "Serviço", "Temperatura", "Já Cliente RJNet", "Vendedor", "Observação", "Cadastrado em"];
  const linhas = leads.map((l) => [
    mesLabel(l.mesReferencia),
    l.nome, l.cpf || "", l.telefone, l.endereco || "",
    servicoLabelFn(l.servicoInteresse), l.temperatura,
    l.jaClienteRjnet ? "Sim" : "Não",
    l.vendedorNome,
    (l.observacao || "").replace(/"/g, '""'),
    new Date(l.criadoEm).toLocaleString("pt-BR"),
  ]);
  const csv = [cabecalho, ...linhas].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads_mensal_consolidado_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  const totalMeses = new Set(leads.map((l) => l.mesReferencia)).size;
  if (onAudit) onAudit({ totalRegistros: leads.length, totalMeses });
}

// D-089: Desafio RJNet — Acerte 00:03:33. Exporta as participações de UM
// dia (ranking + ganhadores instantâneos juntos, coluna "Acerto exato?"
// distingue) — mesmo padrão das demais exportações: sem lógica de negócio
// aqui, só formatação de colunas já calculadas em src/lib/desafioCronometro.js.
// onAudit: callback opcional (async) chamado após o download com { totalRegistros }
export function exportDesafioEntriesCSV(entries, desafioNome, formatarDiferencaFn, onAudit) {
  if (entries.length === 0) return;
  const cabecalho = ["Número", "Nome", "Telefone", "Resultado", "Acerto exato?", "Diferença", "Prêmio", "Entregue", "Responsável entrega", "Cadastrado em"];
  const linhas = entries.map((e) => [
    e.participantNumber, e.participantName, e.phone || "",
    e.resultDisplay, e.isExactHit ? "Sim" : "Não",
    e.isExactHit ? "" : formatarDiferencaFn(e.differenceCentiseconds),
    e.prizeType || "", e.delivered ? "Sim" : "Não", e.deliveryResponsible || "",
    new Date(e.criadoEm).toLocaleString("pt-BR"),
  ]);
  const csv = [cabecalho, ...linhas].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `desafio_${slugParaArquivo(desafioNome)}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  if (onAudit) onAudit({ totalRegistros: entries.length });
}

function slugParaArquivo(nome) {
  return (nome || "dia").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "") || "dia";
}
