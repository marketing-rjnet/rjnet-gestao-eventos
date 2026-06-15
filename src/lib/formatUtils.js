export const fmtDate = (d) =>
  d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "";

export const fmtDateLong = (d) =>
  d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "";

export const initials = (n) =>
  n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
