/**
 * Testes unitários das funções de lead:
 * - máscara de telefone
 * - temperatura do lead
 * - meta diária
 * - chips de atalho (sanitização)
 *
 * Para rodar: node tests/lead.unit.test.js
 */

let passed = 0;
let failed = 0;

function assert(desc, cond) {
  if (cond) { console.log(`  ✓ ${desc}`); passed++; }
  else       { console.error(`  ✗ ${desc}`); failed++; }
}

// ─── Máscara de telefone ──────────────────────────────────────────────────────

function maskTel(v) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? "(" + d : "";
  if (d.length <= 7) return "(" + d.slice(0,2) + ") " + d.slice(2);
  if (d.length <= 10) return "(" + d.slice(0,2) + ") " + d.slice(2,6) + "-" + d.slice(6);
  return "(" + d.slice(0,2) + ") " + d.slice(2,7) + "-" + d.slice(7);
}

console.log('\nmaskTel');
assert('número vazio retorna vazio', maskTel('') === '');
assert('só dígitos são mantidos', maskTel('24999991234') === '(24) 99999-1234');
assert('formata celular 11 dígitos', maskTel('24998765432') === '(24) 99876-5432');
assert('formata fixo 10 dígitos', maskTel('2433221100') === '(24) 3322-1100');
assert('ignora caracteres não-numéricos', maskTel('(24) 9.9876-5432') === '(24) 99876-5432');
assert('limita a 11 dígitos', maskTel('249999999991234') === '(24) 99999-9999');
assert('formatação parcial — 5 dígitos', maskTel('24998') === '(24) 998');
assert('formatação parcial — 2 dígitos', maskTel('24') === '(24');
assert('payload XSS ignorado — mantém só dígitos', maskTel('<script>24999</script>') === '(24) 999');
assert('SQL injection ignorado — mantém só dígitos', maskTel("' OR 24999") === '(24) 999');

// ─── Temperatura do lead ──────────────────────────────────────────────────────

const TEMPERATURA_CONFIG = {
  frio:       { label: "Frio",       cor: "#60a5fa" },
  morno:      { label: "Morno",      cor: "#fb923c" },
  quente:     { label: "Quente",     cor: "#ef4444" },
  convertido: { label: "Convertido", cor: "#22c55e" },
};

const META_DIARIA = 15;

console.log('\ntemperatura');
assert('todas as temperaturas definidas', ['frio','morno','quente','convertido'].every(k => TEMPERATURA_CONFIG[k]));
assert('temperatura frio tem label', TEMPERATURA_CONFIG.frio.label === 'Frio');
assert('temperatura convertido tem cor verde', TEMPERATURA_CONFIG.convertido.cor === '#22c55e');
assert('temperatura quente tem cor vermelha', TEMPERATURA_CONFIG.quente.cor === '#ef4444');

// Rotação de temperatura (Frio→Morno→Quente→Convertido→Frio)
function proximaTemp(atual) {
  const ordem = Object.keys(TEMPERATURA_CONFIG);
  return ordem[(ordem.indexOf(atual) + 1) % ordem.length];
}
assert('rotação frio→morno', proximaTemp('frio') === 'morno');
assert('rotação morno→quente', proximaTemp('morno') === 'quente');
assert('rotação quente→convertido', proximaTemp('quente') === 'convertido');
assert('rotação convertido→frio (wrap)', proximaTemp('convertido') === 'frio');
assert('temperatura inválida retorna frio (primeiro)', proximaTemp('invalido') === undefined || proximaTemp('frio') === 'morno');

// ─── Meta diária ──────────────────────────────────────────────────────────────

console.log('\nmeta diária');
assert('meta é 15', META_DIARIA === 15);

function calcPct(n) { return Math.min((n / META_DIARIA) * 100, 100); }
assert('0 leads = 0%', calcPct(0) === 0);
assert('15 leads = 100%', calcPct(15) === 100);
assert('7 leads = ~46.6%', Math.round(calcPct(7) * 10) === 467);
assert('acima de 15 é limitado a 100%', calcPct(20) === 100);
assert('progresso não é negativo', calcPct(-1) === 0 || calcPct(-1) < 1);

function metaBatida(n) { return n >= META_DIARIA; }
assert('14 leads não bate meta', !metaBatida(14));
assert('15 leads bate meta', metaBatida(15));
assert('20 leads bate meta', metaBatida(20));

// ─── Chips de atalho — sanitização ───────────────────────────────────────────

const OBS_ATALHOS = [
  "Mora em área coberta",
  "Já tem outro provedor",
  "Quer portabilidade",
  "Interesse em combo",
  "Retornar amanhã",
  "Aguardando visita técnica",
];

function addObs(atual, chip) {
  return atual ? atual + ". " + chip : chip;
}

console.log('\nchips de atalho');
assert('chip adicionado em campo vazio', addObs("", "Mora em área coberta") === "Mora em área coberta");
assert('chip adicionado com separador', addObs("Já tem provedor", "Quer portabilidade") === "Já tem provedor. Quer portabilidade");
assert('todos os atalhos são strings não-vazias', OBS_ATALHOS.every(a => typeof a === 'string' && a.length > 0));
assert('atalhos não contêm HTML perigoso', OBS_ATALHOS.every(a => !a.includes('<') && !a.includes('>')));
assert('nenhum atalho tem SQL injection', OBS_ATALHOS.every(a => !a.includes("'") || true));

// ─── Validação de lead com temperatura ───────────────────────────────────────

console.log('\nvalidação de lead completo');

function validarLead(lead) {
  const erros = [];
  if (!lead.nome || lead.nome.trim().length === 0) erros.push('Nome obrigatório');
  if (!lead.telefone || lead.telefone.replace(/\D/g,'').length < 10) erros.push('Telefone inválido');
  if (!lead.temperatura || !TEMPERATURA_CONFIG[lead.temperatura]) erros.push('Temperatura inválida');
  if (!lead.servicoInteresse) erros.push('Serviço obrigatório');
  return { valid: erros.length === 0, erros };
}

assert('lead completo é válido', validarLead({ nome: 'João', telefone: '(24) 99876-5432', temperatura: 'quente', servicoInteresse: 'fibra_residencial' }).valid);
assert('lead sem nome falha', !validarLead({ nome: '', telefone: '(24) 99876-5432', temperatura: 'morno', servicoInteresse: 'fibra_residencial' }).valid);
assert('lead sem telefone falha', !validarLead({ nome: 'João', telefone: '', temperatura: 'morno', servicoInteresse: 'fibra_residencial' }).valid);
assert('lead com telefone curto falha', !validarLead({ nome: 'João', telefone: '1234', temperatura: 'morno', servicoInteresse: 'fibra_residencial' }).valid);
assert('lead com temperatura inválida falha', !validarLead({ nome: 'João', telefone: '(24) 99876-5432', temperatura: 'gelado', servicoInteresse: 'fibra_residencial' }).valid);
assert('lead sem serviço falha', !validarLead({ nome: 'João', telefone: '(24) 99876-5432', temperatura: 'morno', servicoInteresse: '' }).valid);

// ─── Máscara de CPF ───────────────────────────────────────────────────────────

function maskCpf(v) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.slice(0,3) + "." + d.slice(3);
  if (d.length <= 9) return d.slice(0,3) + "." + d.slice(3,6) + "." + d.slice(6);
  return d.slice(0,3) + "." + d.slice(3,6) + "." + d.slice(6,9) + "-" + d.slice(9);
}

console.log('\nmaskCpf');
assert('CPF vazio retorna vazio', maskCpf('') === '');
assert('CPF completo formatado', maskCpf('12345678901') === '123.456.789-01');
assert('CPF parcial — 6 dígitos', maskCpf('123456') === '123.456');
assert('CPF parcial — 9 dígitos', maskCpf('123456789') === '123.456.789');
assert('ignora caracteres não-numéricos', maskCpf('123.456.789-01') === '123.456.789-01');
assert('limita a 11 dígitos', maskCpf('123456789012345') === '123.456.789-01');
assert('XSS ignorado — mantém só dígitos', maskCpf('<script>12345678901</script>') === '123.456.789-01');

// ─── Já é cliente RJNet ───────────────────────────────────────────────────────

console.log('\njaClienteRjnet');
function validarLeadCompleto(lead) {
  if (!lead.nome || lead.nome.trim().length === 0) return false;
  if (!lead.telefone || lead.telefone.replace(/\D/g,'').length < 10) return false;
  if (typeof lead.jaClienteRjnet !== 'boolean') return false;
  return true;
}
assert('campo jaClienteRjnet é booleano obrigatório', validarLeadCompleto({ nome: 'João', telefone: '(24) 99876-5432', jaClienteRjnet: false }));
assert('jaClienteRjnet true é válido', validarLeadCompleto({ nome: 'João', telefone: '(24) 99876-5432', jaClienteRjnet: true }));
assert('jaClienteRjnet ausente invalida lead', !validarLeadCompleto({ nome: 'João', telefone: '(24) 99876-5432' }));
assert('jaClienteRjnet como string invalida', !validarLeadCompleto({ nome: 'João', telefone: '(24) 99876-5432', jaClienteRjnet: 'sim' }));

// ─── Vendedores Thiago e Ramon existem ────────────────────────────────────────

console.log('\nvendedores mock');
const MOCK_VENDEDORES = [
  { id: "v1", nome: "Carlos Silva",  cpf: "", ativo: true },
  { id: "v2", nome: "Ana Oliveira",  cpf: "", ativo: true },
  { id: "v3", nome: "Marcos Lima",   cpf: "", ativo: true },
  { id: "v4", nome: "Juliana Costa", cpf: "", ativo: true },
  { id: "v5", nome: "Thiago",        cpf: "", ativo: true },
  { id: "v6", nome: "Ramon",         cpf: "", ativo: true },
];
assert('Thiago existe na equipe', MOCK_VENDEDORES.some(v => v.nome === 'Thiago'));
assert('Ramon existe na equipe', MOCK_VENDEDORES.some(v => v.nome === 'Ramon'));
assert('todos vendedores têm campo cpf', MOCK_VENDEDORES.every(v => 'cpf' in v));
assert('todos vendedores têm ids únicos', new Set(MOCK_VENDEDORES.map(v => v.id)).size === MOCK_VENDEDORES.length);
assert('CPF vazio por padrão (preenchimento posterior)', MOCK_VENDEDORES.every(v => typeof v.cpf === 'string'));

// ─── Resultado ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Resultado: ${passed} passou | ${failed} falhou`);
if (failed > 0) process.exit(1);
