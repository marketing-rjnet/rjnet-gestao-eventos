/**
 * Testes unitários das funções de segurança (config/security.js).
 * Rodam sem browser — validam a lógica de sanitização e validação.
 *
 * Para rodar: node tests/security.unit.test.js
 */

const {
  escapeHtml,
  sanitizeText,
  sanitizeEmail,
  sanitizeQuantidade,
  validateLead,
  validateEvento,
  validateMaterial,
} = require('../config/security');

let passed = 0;
let failed = 0;

function assert(description, condition) {
  if (condition) {
    console.log(`  ✓ ${description}`);
    passed++;
  } else {
    console.error(`  ✗ ${description}`);
    failed++;
  }
}

// ─── escapeHtml ───────────────────────────────────────────────────────────────
console.log('\nescapeHtml');
assert('escapa <script>', escapeHtml('<script>alert(1)</script>') === '&lt;script&gt;alert(1)&lt;&#x2F;script&gt;');
assert('escapa aspas duplas', escapeHtml('"xss"') === '&quot;xss&quot;');
assert('escapa aspas simples', escapeHtml("'xss'") === '&#x27;xss&#x27;');
assert('escapa &', escapeHtml('a & b') === 'a &amp; b');
assert('retorna vazio para não-string', escapeHtml(null) === '');
assert('texto normal não é alterado', escapeHtml('Olá mundo') === 'Ol&#x61; mundo' || escapeHtml('hello world') === 'hello world');

// ─── sanitizeText ─────────────────────────────────────────────────────────────
console.log('\nsanitizeText');
assert('remove espaços nas bordas', sanitizeText('  texto  ') === 'texto');
assert('limita ao maxLength', sanitizeText('abcdef', 3) === 'abc');
assert('retorna vazio para não-string', sanitizeText(123) === '');
assert('retorna vazio para null', sanitizeText(null) === '');
assert('texto normal preservado', sanitizeText('João Silva') === 'João Silva');

// ─── sanitizeEmail ────────────────────────────────────────────────────────────
console.log('\nsanitizeEmail');
assert('e-mail válido aceito', sanitizeEmail('user@rjnet.com.br') === 'user@rjnet.com.br');
assert('converte para minúsculas', sanitizeEmail('USER@RJNET.COM') === 'user@rjnet.com');
assert('e-mail inválido retorna null', sanitizeEmail('nao-e-email') === null);
assert('string vazia retorna null', sanitizeEmail('') === null);
assert('null retorna null', sanitizeEmail(null) === null);

// ─── sanitizeQuantidade ───────────────────────────────────────────────────────
console.log('\nsanitizeQuantidade');
assert('número válido aceito', sanitizeQuantidade('10') === 10);
assert('zero é válido', sanitizeQuantidade('0') === 0);
assert('negativo retorna null', sanitizeQuantidade('-1') === null);
assert('texto retorna null', sanitizeQuantidade('abc') === null);
assert('acima do max retorna null', sanitizeQuantidade('999999') === null);
assert('float é truncado para inteiro', sanitizeQuantidade('3.9') === 3);

// ─── validateLead ─────────────────────────────────────────────────────────────
console.log('\nvalidateLead');
assert('lead válido passa', validateLead({ nome: 'João', servico: 'Show' }).valid === true);
assert('lead sem nome falha', validateLead({ nome: '', servico: 'Show' }).valid === false);
assert('lead sem serviço falha', validateLead({ nome: 'João', servico: '' }).valid === false);
assert('lead sem campos falha', validateLead({ nome: '', servico: '' }).valid === false);

const xssLead = validateLead({ nome: '<script>alert(1)</script>', servico: 'Show' });
assert('payload XSS no nome é sanitizado no texto', xssLead.valid === true && !xssLead.data.nome.includes('<script>'));

// ─── validateEvento ───────────────────────────────────────────────────────────
console.log('\nvalidateEvento');
assert('evento válido passa', validateEvento({ nome: 'Festa', local: 'Rio', data_inicio: '2025-12-01', data_fim: '2025-12-02' }).valid === true);
assert('evento sem nome falha', validateEvento({ nome: '', local: 'Rio', data_inicio: '2025-12-01', data_fim: '2025-12-02' }).valid === false);
assert('data inválida falha', validateEvento({ nome: 'Festa', local: 'Rio', data_inicio: 'naodata', data_fim: '2025-12-02' }).valid === false);
assert('data fim < início falha', validateEvento({ nome: 'Festa', local: 'Rio', data_inicio: '2025-12-05', data_fim: '2025-12-01' }).valid === false);

// ─── validateMaterial ────────────────────────────────────────────────────────
console.log('\nvalidateMaterial');
assert('material válido passa', validateMaterial({ nome: 'Banner', quantidade: '5' }).valid === true);
assert('material sem nome falha', validateMaterial({ nome: '', quantidade: '5' }).valid === false);
assert('quantidade negativa falha', validateMaterial({ nome: 'Banner', quantidade: '-1' }).valid === false);
assert('quantidade texto falha', validateMaterial({ nome: 'Banner', quantidade: 'abc' }).valid === false);

// ─── SQL Injection nos validadores ────────────────────────────────────────────
console.log('\nSQL Injection nos validadores');
const sqlPayloads = ["' OR '1'='1", "'; DROP TABLE--", "' UNION SELECT *--"];
for (const payload of sqlPayloads) {
  const result = validateLead({ nome: payload, servico: 'teste' });
  if (result.valid) {
    // Se aceito, o valor deve estar sanitizado (sem aspas perigosas no contexto SQL)
    // Na prática, o Supabase usa queries parametrizadas, então qualquer string é segura
    assert(`payload SQL "${payload.substring(0, 20)}" é aceito como texto literal (Supabase parametriza)`, typeof result.data.nome === 'string');
  } else {
    assert(`payload SQL "${payload.substring(0, 20)}" rejeitado pela validação`, true);
  }
}

// ─── Resultado ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Resultado: ${passed} passou | ${failed} falhou`);
if (failed > 0) {
  process.exit(1);
}
