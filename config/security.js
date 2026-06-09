/**
 * Utilitários de segurança — use em TODA entrada de usuário antes de persistir ou exibir dados.
 *
 * Quando integrar Supabase: importe este módulo e passe os inputs por sanitize() antes de inserir.
 * O Supabase client usa queries parametrizadas por padrão (sem concatenação de SQL),
 * mas a sanitização de XSS continua necessária para dados exibidos no DOM.
 */

// ─── Sanitização de strings ────────────────────────────────────────────────────

/**
 * Remove caracteres HTML perigosos para prevenir XSS.
 * Use antes de exibir qualquer dado vindo do usuário ou banco de dados.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
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
 * Remove tags HTML e espaços excessivos, e limita o tamanho de strings de entrada.
 * Campos de texto puro nunca devem conter HTML — isso previne XSS na camada de dados.
 * @param {string} str
 * @param {number} maxLength
 * @returns {string}
 */
function sanitizeText(str, maxLength = 255) {
  if (typeof str !== 'string') return '';
  // Remove todas as tags HTML antes de trimmar
  return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLength);
}

/**
 * Valida e sanitiza e-mail.
 * @param {string} email
 * @returns {string|null} e-mail sanitizado ou null se inválido
 */
function sanitizeEmail(email) {
  if (typeof email !== 'string') return null;
  const clean = email.trim().toLowerCase().slice(0, 254);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(clean) ? clean : null;
}

/**
 * Valida número inteiro positivo (ex: quantidade em estoque).
 * @param {any} value
 * @param {number} max
 * @returns {number|null}
 */
function sanitizeQuantidade(value, max = 99999) {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 0 || n > max) return null;
  return n;
}

// ─── Prevenção de SQL Injection (Supabase) ────────────────────────────────────
//
// O Supabase JS client usa queries parametrizadas automaticamente:
//
//   ✅ CORRETO — parametrizado (seguro):
//   await supabase.from('leads').insert({ nome: sanitizeText(input), evento_id: id })
//
//   ❌ ERRADO — concatenação (vulnerável):
//   await supabase.rpc('query_raw', { sql: `SELECT * WHERE nome = '${input}'` })
//
// NUNCA use supabase.rpc() com SQL concatenado de input do usuário.
// SEMPRE use os métodos .select(), .insert(), .update(), .delete() do client.

// ─── Rate limiting (referência — implemente no backend/Edge Functions) ─────────
//
// Para proteger contra força bruta no login, implemente via Supabase Edge Function:
//
// const attempts = await supabase
//   .from('login_attempts')
//   .select('count', { count: 'exact' })
//   .eq('ip', clientIp)
//   .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
//
// if (count >= 10) return new Response('Too Many Requests', { status: 429 })

// ─── Validação de dados por entidade ─────────────────────────────────────────

/**
 * Valida e sanitiza os campos de um Lead antes de salvar.
 * @param {{ nome: string, servico: string, obs?: string }} lead
 * @returns {{ valid: boolean, data?: object, errors?: string[] }}
 */
function validateLead(lead) {
  const errors = [];
  const nome = sanitizeText(lead.nome, 100);
  const servico = sanitizeText(lead.servico, 100);
  const obs = sanitizeText(lead.obs || '', 500);

  if (!nome) errors.push('Nome do lead é obrigatório');
  if (!servico) errors.push('Tipo de serviço é obrigatório');

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data: { nome, servico, obs } };
}

/**
 * Valida e sanitiza os campos de um Evento antes de salvar.
 * @param {{ nome: string, local: string, data_inicio: string, data_fim: string }} evento
 * @returns {{ valid: boolean, data?: object, errors?: string[] }}
 */
function validateEvento(evento) {
  const errors = [];
  const nome = sanitizeText(evento.nome, 150);
  const local = sanitizeText(evento.local, 150);
  const data_inicio = sanitizeText(evento.data_inicio, 10);
  const data_fim = sanitizeText(evento.data_fim, 10);

  if (!nome) errors.push('Nome do evento é obrigatório');
  if (!local) errors.push('Local é obrigatório');
  if (!data_inicio || isNaN(Date.parse(data_inicio))) errors.push('Data de início inválida');
  if (!data_fim || isNaN(Date.parse(data_fim))) errors.push('Data de fim inválida');
  if (data_inicio && data_fim && data_fim < data_inicio) errors.push('Data de fim anterior à data de início');

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data: { nome, local, data_inicio, data_fim } };
}

/**
 * Valida e sanitiza campos de um Material antes de salvar.
 * @param {{ nome: string, quantidade: any }} material
 * @returns {{ valid: boolean, data?: object, errors?: string[] }}
 */
function validateMaterial(material) {
  const errors = [];
  const nome = sanitizeText(material.nome, 100);
  const quantidade = sanitizeQuantidade(material.quantidade);

  if (!nome) errors.push('Nome do material é obrigatório');
  if (quantidade === null) errors.push('Quantidade deve ser um número inteiro positivo');

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data: { nome, quantidade } };
}

module.exports = {
  escapeHtml,
  sanitizeText,
  sanitizeEmail,
  sanitizeQuantidade,
  validateLead,
  validateEvento,
  validateMaterial,
};
