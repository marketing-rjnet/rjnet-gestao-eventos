export function buildLeadsCSV(dados, { servicoLabel, evName }) {
  const cabecalho = [
    "Nome", "CPF", "Telefone", "Endereço", "Serviço", "Temperatura",
    "Já Cliente RJNet", "Vendedor", "Evento", "Observação", "Cadastrado em",
  ];
  const linhas = dados.map((l) => [
    l.nome,
    l.cpf || "",
    l.telefone,
    l.endereco || "",
    servicoLabel(l.servicoInteresse),
    l.temperatura,
    l.jaClienteRjnet ? "Sim" : "Não",
    l.vendedorNome,
    evName(l.eventoId),
    (l.observacao || "").replace(/"/g, '""'),
    new Date(l.criadoEm).toLocaleString("pt-BR"),
  ]);
  return [cabecalho, ...linhas].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
}

export function downloadCSV(conteudo, filename) {
  const blob = new Blob(["﻿" + conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
