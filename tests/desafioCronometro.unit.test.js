/**
 * Testes unitários do Desafio RJNet — Acerte 00:03:33 (D-089):
 * - parse/format do cronômetro (MM:SS:CC <-> centésimos)
 * - cálculo de diferença e identificação de acerto exato
 *
 * Para rodar: node tests/desafioCronometro.unit.test.js
 *
 * Mesmo princípio de tests/simulador.unit.test.js: src/lib/desafioCronometro.js
 * não tem imports de propósito, então importamos o módulo REAL via data-URL
 * ESM mesmo com o projeto em CJS — regra de negócio tem que quebrar aqui se
 * alguém mudar o cálculo sem ajustar o teste.
 */

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(desc, cond) {
  if (cond) { console.log(`  ✓ ${desc}`); passed++; }
  else       { console.error(`  ✗ ${desc}`); failed++; }
}

(async () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/lib/desafioCronometro.js'), 'utf8');
  const mod = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
  const {
    TARGET_CENTISECONDS_PADRAO, MAX_TENTATIVAS_PADRAO, TIPOS_PREMIO,
    validarFormatoTempo, parseTempoParaCentesimos, centesimosParaTempo,
    calcularResultadoDesafio, formatarDiferenca,
    formatarDigitosCronometro, melhorTentativa,
  } = mod;

  console.log('\nconstantes');
  assert('alvo padrão é 333 centésimos (00:03:33)', TARGET_CENTISECONDS_PADRAO === 333);
  assert('4 tipos de prêmio', TIPOS_PREMIO.length === 4);
  assert('3 tentativas por padrão (D-098)', MAX_TENTATIVAS_PADRAO === 3);

  console.log('\nvalidarFormatoTempo');
  assert('formato válido', validarFormatoTempo('00:03:33') === true);
  assert('formato válido com minutos de 2 dígitos', validarFormatoTempo('12:59:99') === true);
  assert('rejeita formato sem separador', validarFormatoTempo('000333') === false);
  assert('rejeita segundos fora do intervalo', validarFormatoTempo('00:60:00') === false);
  assert('rejeita centésimos fora do intervalo', validarFormatoTempo('00:00:100') === false);
  assert('rejeita string vazia', validarFormatoTempo('') === false);
  assert('rejeita não-string', validarFormatoTempo(333) === false);
  assert('aceita com espaços nas pontas', validarFormatoTempo('  00:03:33  ') === true);

  console.log('\nparseTempoParaCentesimos / centesimosParaTempo (round-trip)');
  assert('00:03:33 = 333 centésimos (exemplo da especificação)', parseTempoParaCentesimos('00:03:33') === 333);
  assert('00:03:35 = 335 centésimos', parseTempoParaCentesimos('00:03:35') === 335);
  assert('00:00:00 = 0 centésimos', parseTempoParaCentesimos('00:00:00') === 0);
  assert('01:00:00 = 6000 centésimos', parseTempoParaCentesimos('01:00:00') === 6000);
  assert('centesimosParaTempo(333) = "00:03:33"', centesimosParaTempo(333) === '00:03:33');
  assert('centesimosParaTempo(0) = "00:00:00"', centesimosParaTempo(0) === '00:00:00');
  assert('centesimosParaTempo(6000) = "01:00:00"', centesimosParaTempo(6000) === '01:00:00');
  assert('round-trip preserva o valor', centesimosParaTempo(parseTempoParaCentesimos('05:22:07')) === '05:22:07');
  assert('parseTempoParaCentesimos lança erro em formato inválido', (() => {
    try { parseTempoParaCentesimos('abc'); return false; } catch { return true; }
  })());

  console.log('\ncalcularResultadoDesafio — exemplo da especificação (diferença de 2 centésimos)');
  const r1 = calcularResultadoDesafio({ resultDisplay: '00:03:35', targetCentiseconds: 333 });
  assert('resultCentiseconds = 335', r1.resultCentiseconds === 335);
  assert('differenceCentiseconds = 2', r1.differenceCentiseconds === 2);
  assert('isExactHit = false', r1.isExactHit === false);

  console.log('\ncalcularResultadoDesafio — acerto exato');
  const r2 = calcularResultadoDesafio({ resultDisplay: '00:03:33', targetCentiseconds: 333 });
  assert('isExactHit = true quando bate exatamente o alvo', r2.isExactHit === true);
  assert('differenceCentiseconds = 0 no acerto exato', r2.differenceCentiseconds === 0);

  console.log('\ncalcularResultadoDesafio — diferença é sempre não-negativa (resultado abaixo do alvo)');
  const r3 = calcularResultadoDesafio({ resultDisplay: '00:03:30', targetCentiseconds: 333 });
  assert('differenceCentiseconds = 3 (abs(330-333))', r3.differenceCentiseconds === 3);
  assert('isExactHit = false', r3.isExactHit === false);

  console.log('\ncalcularResultadoDesafio — rejeita formato inválido');
  assert('lança erro com formato fora do padrão', (() => {
    try { calcularResultadoDesafio({ resultDisplay: '3:33', targetCentiseconds: 333 }); return false; }
    catch { return true; }
  })());

  console.log('\nformatarDiferenca — nunca decimal, sempre MM:SS:CC');
  assert('formatarDiferenca(2) = "00:00:02"', formatarDiferenca(2) === '00:00:02');
  assert('formatarDiferenca(0) = "00:00:00"', formatarDiferenca(0) === '00:00:00');

  console.log('\nformatarDigitosCronometro — máscara automática (D-098), preenche da direita pra esquerda');
  assert('"0333" -> "00:03:33" (exemplo da especificação)', formatarDigitosCronometro('0333') === '00:03:33');
  assert('"0412" -> "00:04:12" (exemplo da especificação)', formatarDigitosCronometro('0412') === '00:04:12');
  assert('"123456" -> "12:34:56" (exemplo da especificação)', formatarDigitosCronometro('123456') === '12:34:56');
  assert('"0" -> "00:00:00" (primeiro dígito)', formatarDigitosCronometro('0') === '00:00:00');
  assert('"033" -> "00:00:33" (backspace de "0333", remove só o último dígito)', formatarDigitosCronometro('033') === '00:00:33');
  assert('"" -> "00:00:00" (buffer vazio — a UI decide mostrar vazio, não esta função)', formatarDigitosCronometro('') === '00:00:00');
  assert('ignora caracteres não-numéricos misturados', formatarDigitosCronometro('0a3b3c3') === formatarDigitosCronometro('0333'));
  assert('mais de 6 dígitos: só os últimos 6 contam', formatarDigitosCronometro('9123456') === '12:34:56');

  console.log('\nmelhorTentativa — sempre a de MENOR differenceCentiseconds (valor numérico, nunca string)');
  assert('lista vazia -> null', melhorTentativa([]) === null);
  assert('lista undefined -> null', melhorTentativa(undefined) === null);
  const exTentativasBest3 = [
    { attemptNumber: 1, differenceCentiseconds: 79, resultDisplay: '00:04:12' },  // 04:12 vs 03:33 = 79
    { attemptNumber: 2, differenceCentiseconds: 18, resultDisplay: '00:03:51' },  // 03:51 vs 03:33 = 18
    { attemptNumber: 3, differenceCentiseconds: 0,  resultDisplay: '00:03:33' },  // acerto exato
  ];
  assert('exemplo 1 da especificação: melhor é a Tentativa 3 (00:03:33)', melhorTentativa(exTentativasBest3).resultDisplay === '00:03:33');
  const exTentativasBest1 = [
    { attemptNumber: 1, differenceCentiseconds: 5,   resultDisplay: '00:03:28' },  // 03:28 vs 03:33 = 5
    { attemptNumber: 2, differenceCentiseconds: 8,   resultDisplay: '00:03:41' },  // 03:41 vs 03:33 = 8
    { attemptNumber: 3, differenceCentiseconds: 237, resultDisplay: '00:04:10' },  // 04:10 vs 03:33 = 237
  ];
  assert('exemplo 2 da especificação: melhor é a Tentativa 1 (00:03:28)', melhorTentativa(exTentativasBest1).resultDisplay === '00:03:28');
  const exEmpate = [
    { attemptNumber: 2, differenceCentiseconds: 10, resultDisplay: 'segunda' },
    { attemptNumber: 1, differenceCentiseconds: 10, resultDisplay: 'primeira' },
  ];
  assert('empate na diferença: vence a de menor attemptNumber (a primeira a alcançar)', melhorTentativa(exEmpate).resultDisplay === 'primeira');

  console.log(`\n${passed} passaram, ${failed} falharam`);
  if (failed > 0) process.exit(1);
})();
