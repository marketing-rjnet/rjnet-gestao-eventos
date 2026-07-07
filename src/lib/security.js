// Utilitários de segurança — versão ESM para uso no browser.
// Mantidos em sincronia com config/security.js (usado nos testes Node).

/**
 * Remove caracteres HTML perigosos para prevenir XSS.
 * React auto-escapa texto em JSX, mas use esta função antes de salvar
 * dados no banco ou ao lidar com outputs fora do JSX normal.
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Remove tags HTML e espaços excessivos, e limita o tamanho.
 * Use em TODOS os campos de texto livre antes de persistir.
 */
export function sanitizeText(str, maxLength = 255) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLength);
}

/**
 * Detecta URL/link em texto livre — usado nos campos do Form Builder que
 * não deveriam conter endereço web (nome, endereço, bairro, campos
 * personalizados). Não é filtro de conteúdo impróprio em geral, só de link.
 */
export function containsLink(str) {
  if (typeof str !== 'string') return false;
  return /https?:\/\/|www\.|\.(com|net|org|br|io|co|me|xyz|info|link)\b/i.test(str);
}

/**
 * Valida e sanitiza e-mail.
 * @returns {string|null} e-mail sanitizado ou null se inválido
 */
export function sanitizeEmail(email) {
  if (typeof email !== 'string') return null;
  const clean = email.trim().toLowerCase().slice(0, 254);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) ? clean : null;
}

/**
 * Valida número inteiro positivo (ex: quantidade em estoque).
 * @returns {number|null}
 */
export function sanitizeQuantidade(value, max = 99999) {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 0 || n > max) return null;
  return n;
}
