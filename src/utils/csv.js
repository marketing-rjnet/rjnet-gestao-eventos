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
