// Desafio RJNet — Acerte 00:03:33 (D-089)
// Lógica de domínio pura — sem imports, testável standalone (mesmo
// princípio de src/lib/simulador.js: nunca confia em cálculo pronto vindo
// de fora, aqui o "servidor" e a UI compartilham a MESMA função).
//
// Formato do cronômetro: MM:SS:CC (minutos:segundos:centésimos), sempre 2
// dígitos por bloco. Convertido para um único inteiro de centésimos só
// para cálculo — a interface nunca mostra o valor em centésimos crus.

// Tempo-alvo padrão deste desafio: 00:03:33 = 3*100 + 33 = 333 centésimos.
export const TARGET_CENTISECONDS_PADRAO = 333;

export const TIPOS_PREMIO = ['RJNET Móvel 24GB', 'Disney+', 'HBO Max', 'Outro'];

const REGEX_TEMPO = /^(\d{2}):(\d{2}):(\d{2})$/;

// Valida o formato exato MM:SS:CC com segundos/centésimos dentro do range
// (0–59 / 0–99) — minutos livres (0–99 cobre qualquer cronômetro real).
export function validarFormatoTempo(str) {
  if (typeof str !== 'string') return false;
  const m = REGEX_TEMPO.exec(str.trim());
  if (!m) return false;
  const [, mm, ss, cc] = m;
  return Number(ss) <= 59 && Number(cc) <= 99 && Number(mm) <= 99;
}

// "00:03:33" -> 333. Lança erro se o formato for inválido — quem chama
// deve validar com validarFormatoTempo() antes (ou tratar o throw).
export function parseTempoParaCentesimos(str) {
  const m = REGEX_TEMPO.exec(String(str).trim());
  if (!m) throw new Error('Formato de tempo inválido. Use MM:SS:CC (ex: 00:03:33).');
  const [, mm, ss, cc] = m;
  const minutos = Number(mm), segundos = Number(ss), centesimos = Number(cc);
  if (segundos > 59 || centesimos > 99) throw new Error('Segundos/centésimos fora do intervalo (00–59 / 00–99).');
  return minutos * 6000 + segundos * 100 + centesimos;
}

// 333 -> "00:03:33". Sempre 2 dígitos por bloco (minutos podem passar de
// 99 num cronômetro incomum — nesse caso o bloco só cresce, sem quebrar).
export function centesimosParaTempo(total) {
  const n = Math.max(0, Math.round(Number(total) || 0));
  const minutos = Math.floor(n / 6000);
  const segundos = Math.floor((n % 6000) / 100);
  const centesimos = n % 100;
  const pad = (v) => String(v).padStart(2, '0');
  return `${pad(minutos)}:${pad(segundos)}:${pad(centesimos)}`;
}

// Núcleo do desafio: a partir do texto digitado (MM:SS:CC) e do alvo da
// campanha (em centésimos), calcula tudo que decide o participante —
// mesma função usada pelo cadastro (marketing) e pelos testes. Não há
// Edge Function pública aqui (cadastro é sempre feito por usuário
// autenticado, nunca por formulário público), então este cálculo já é a
// fonte de verdade — diferente do Simulador, que precisa recalcular no
// servidor por receber submissão anônima.
export function calcularResultadoDesafio({ resultDisplay, targetCentiseconds }) {
  if (!validarFormatoTempo(resultDisplay)) {
    throw new Error('Formato de tempo inválido. Use MM:SS:CC (ex: 00:03:33).');
  }
  const target = Math.max(0, Math.round(Number(targetCentiseconds) || 0));
  const resultCentiseconds = parseTempoParaCentesimos(resultDisplay);
  const differenceCentiseconds = Math.abs(resultCentiseconds - target);
  const isExactHit = differenceCentiseconds === 0;
  return {
    resultDisplay: resultDisplay.trim(),
    resultCentiseconds,
    targetCentiseconds: target,
    differenceCentiseconds,
    isExactHit,
  };
}

// Diferença sempre exibida no mesmo formato MM:SS:CC do cronômetro
// (nunca decimal) — reaproveita centesimosParaTempo, já que diferença é
// só mais uma contagem de centésimos.
export const formatarDiferenca = (diffCentesimos) => centesimosParaTempo(diffCentesimos);
