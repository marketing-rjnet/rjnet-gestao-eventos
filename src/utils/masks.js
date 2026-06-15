export function maskCpf(v) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.slice(0,3) + "." + d.slice(3);
  if (d.length <= 9) return d.slice(0,3) + "." + d.slice(3,6) + "." + d.slice(6);
  return d.slice(0,3) + "." + d.slice(3,6) + "." + d.slice(6,9) + "-" + d.slice(9);
}

export function maskTel(v) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? "(" + d : "";
  if (d.length <= 7) return "(" + d.slice(0,2) + ") " + d.slice(2);
  if (d.length <= 10) return "(" + d.slice(0,2) + ") " + d.slice(2,6) + "-" + d.slice(6);
  return "(" + d.slice(0,2) + ") " + d.slice(2,7) + "-" + d.slice(7);
}
