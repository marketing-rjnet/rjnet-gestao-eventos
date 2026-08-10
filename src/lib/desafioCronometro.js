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

// D-098: até 3 tentativas por participante, configurável por dia
// (`timer_challenge_events.max_attempts`) — este valor é só o PADRÃO
// usado ao criar um novo dia, nunca um limite hardcoded no cálculo.
export const MAX_TENTATIVAS_PADRAO = 3;

// D-098: mesmo catálogo já usado no controle de entrega de prêmio dos
// ganhadores instantâneos (Ganhadores) — reaproveitado como "prêmio que
// o participante está concorrendo/recebendo", selecionável já no
// cadastro (nunca uma segunda lista de prêmios).
export const TIPOS_PREMIO = ['RJNET Móvel 24GB', 'Disney+', 'HBO Max', 'Outro'];

// D-093: prêmios por POSIÇÃO do ranking (1º ao 10º) — catálogo fixo de 3
// opções (sem texto livre, sem imagem), cada posição escolhe uma delas.
// Distinto de TIPOS_PREMIO acima (que é o prêmio ENTREGUE a um ganhador
// instantâneo específico, D-089) — conceitos independentes do módulo.
export const PREMIOS_POSICAO_RANKING = ['RJNET Móvel', 'HBO Max', 'Disney+'];

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

// ─── D-098: múltiplas tentativas por participante ──────────────────────

// Formatação automática do campo de cronômetro (CronometroInput.jsx): a
// partir dos dígitos CRUS já digitados (sem os ":"), monta o texto
// MM:SS:CC preenchendo da direita pra esquerda — mesmo princípio de um
// campo de valor monetário (o último dígito digitado é sempre o de
// centésimos). Puramente textual, não passa pela conversão de
// centésimos/aritmética (diferente de centesimosParaTempo, que converte
// um TOTAL de centésimos já calculado). Só os últimos 6 dígitos contam —
// dígitos além do limite empurram os mais antigos pra fora, nunca lança
// erro nem trava a digitação.
export function formatarDigitosCronometro(digitos) {
  const limpos = String(digitos || '').replace(/\D/g, '').slice(-6);
  const preenchido = limpos.padStart(6, '0');
  return `${preenchido.slice(0, 2)}:${preenchido.slice(2, 4)}:${preenchido.slice(4, 6)}`;
}

// A "melhor tentativa" de um participante é sempre a de MENOR
// differenceCentiseconds — comparação sempre pelo valor numérico interno
// (nunca string), como pede a especificação. Empate (duas tentativas com
// a mesma diferença) resolvido pela de menor `attemptNumber` — a
// primeira a alcançar aquele resultado. Fonte ÚNICA de verdade pra "qual
// tentativa vale" em qualquer tela (Cadastro, Ranking, Ganhadores,
// Painel, Tela de TV, CSV) e também na RPC pública (mesma regra
// replicada em SQL — ver migracao-desafio-tentativas.sql). Retorna null
// se a lista estiver vazia (participante sem nenhuma tentativa ainda não
// deveria existir, mas a função não assume isso).
export function melhorTentativa(tentativas) {
  if (!tentativas || tentativas.length === 0) return null;
  return tentativas.reduce((melhor, atual) => {
    if (!melhor) return atual;
    if (atual.differenceCentiseconds < melhor.differenceCentiseconds) return atual;
    if (atual.differenceCentiseconds === melhor.differenceCentiseconds && atual.attemptNumber < melhor.attemptNumber) return atual;
    return melhor;
  }, null);
}
