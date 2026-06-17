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
