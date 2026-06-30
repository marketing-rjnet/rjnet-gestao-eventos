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
  dia_a_dia: "Dia a Dia",
};

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
export const fmtMes = (d) => {
  if (!d) return '';
  const date = new Date(d + 'T12:00:00');
  return `${MESES_PT[date.getMonth()]} ${date.getFullYear()}`;
};
export const mesRefAtual = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const STATUS_LABEL = { ativo: "Ativo", planejado: "Planejado", encerrado: "Encerrado" };

export const servicoLabel = (s) => {
  if (Array.isArray(s)) return s.map((x) => SERVICO_LABEL[x] || x).join(', ') || '—';
  return SERVICO_LABEL[s] || s || '—';
};
export const tipoLabel = (t) => TIPO_LABEL[t] || t;
export const fmtDate = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "";
export const fmtDateLong = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "";
export const initials = (n) => n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
