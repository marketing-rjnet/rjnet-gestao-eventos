export const genId = (prefix) =>
  prefix + Date.now() + Math.random().toString(36).slice(2, 7);

// Usado por QR Code e Form Builder pra gerar um identificador legível na
// URL pública a partir de um nome livre (ex: "Feirão de Carros" -> "feirao-de-carros").
export const slugify = (str) =>
  str
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
