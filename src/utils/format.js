export const SERVICO_LABEL = {
  internet_residencial: "Internet Residencial",
  internet_empresarial: "Internet Empresarial",
  rjnet_movel: "RJNET Móvel",
  streamings: "Streamings",
  outro: "Outro",
};

export const TIPO_LABEL = {
  sinalizacao: "Sinalização",
  presenca_comercial: "Presença Comercial",
  ativacao_especial: "Ativação Especial",
};

export const STATUS_LABEL = { ativo: "Ativo", planejado: "Planejado", encerrado: "Encerrado" };

// D-058: nomes dos meses para o seletor de "Atividade do Mês" do vendedor.
export const MES_LABEL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Gera os 12 meses de um ano como mes_referencia (primeiro dia do mês, ex:
// "2026-07-01") — sem necessidade de manutenção anual, sempre recalculado.
export const mesesDoAno = (ano) =>
  MES_LABEL.map((label, i) => ({ value: `${ano}-${String(i + 1).padStart(2, "0")}-01`, label }));

// "2026-07-01" -> "Julho/2026"
export const mesReferenciaLabel = (mesRef) => {
  if (!mesRef) return "—";
  const [ano, mes] = mesRef.split("-");
  return `${MES_LABEL[Number(mes) - 1] || mes}/${ano}`;
};

export const servicoLabel = (s) => {
  if (Array.isArray(s)) return s.map((x) => SERVICO_LABEL[x] || x).join(', ') || '—';
  return SERVICO_LABEL[s] || s || '—';
};
export const tipoLabel = (t) => TIPO_LABEL[t] || t;
export const fmtDate = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "";
export const fmtDateLong = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "";
export const initials = (n) => n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
