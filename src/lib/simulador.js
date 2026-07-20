// Simulador de Perfil de Consumo — catálogo de pacotes/perfis + motor de
// pontuação das perguntas de intenção.
//
// D-076: o Simulador virou 2 fluxos públicos independentes por campanha,
// nunca mais encadeados na mesma sessão:
// - tipo 'oferta': quiz FIXO de qualificação (PERGUNTAS_OFERTA, D-077) —
//   o perfil de uso (PERFIS_SIMULADOR, D-074) é DEDUZIDO das respostas via
//   perfilPorRespostasOferta(), nunca escolhido por clique direto → pacote
//   FIXO + combo de upsell (apps, upgrade, plano Móvel).
// - tipo 'demanda': só as perguntas de intenção configuráveis por campanha
//   (D-075, texto + peso por opção) → pontuação/temperatura → mensagem de
//   resultado PERSONALIZADA pela campanha (mensagemResultadoPadrao() é só
//   o valor inicial editável). Sem pergunta de perfil/pacote.
// O tipo 'territorial' (D-073) foi removido — as campanhas geolocalizadas
// sem quiz não existem mais como opção; 'demanda' cobre esse papel de
// captação qualificada com pontuação configurável pelo marketing.
//
// D-080: 3º tipo de campanha, 'quiz' — teste de CONHECIMENTO com resposta
// certa/errada por pergunta (não uma pergunta de intenção/perfil como
// 'demanda', nem de qualificação como 'oferta'). Pontuação = contagem de
// acertos; o marketing define faixas de classificação (min/max de acertos
// → emoji + título) totalmente editáveis por campanha, sem número fixo de
// perguntas nem de faixas. Primeiro uso real: evento MotoFest (universo de
// motoclube) — ver quizPerguntasPadrao()/quizFaixasPadrao() abaixo, usadas
// só como molde inicial editável de uma campanha nova (mesmo princípio de
// perguntasPadrao() em 'demanda'). Nunca encadeado com 'oferta'/'demanda'
// na mesma sessão — os 3 tipos continuam mutuamente exclusivos (D-076).
//
// Módulo deliberadamente SEM imports: é carregado standalone pelo teste
// unitário Node (tests/simulador.unit.test.js) e espelhado em Deno na Edge
// Function submeter-simulador (que recalcula o score no servidor — o
// cliente nunca manda pontuação pronta, só as respostas brutas + o id da
// campanha; o servidor busca a config dela mesmo e recalcula).

// Versão do formato de `leads.perfil_consumo` — bump quando a FORMA do
// jsonb muda (não quando só o conteúdo de uma campanha muda). v2 (D-075)
// passou a incluir `perguntas` (snapshot) e `combo`/`perfil` (D-074); a
// separação em 2 tipos (D-076) não mudou a forma do jsonb em si (cada lead
// só carrega o bloco relevante ao seu tipo). v3 (D-080) acrescenta o bloco
// `tipo:'quiz'` + `acertos`/`total`/`faixa` — shape nova, só usada por
// leads de campanha 'quiz'; leads de 'oferta'/'demanda' não mudam.
export const PERGUNTAS_SIMULADOR_VERSAO = 3;

// Catálogo de pacotes de Internet Fibra e apps adicionais — fonte única de
// preço, reaproveitada pela aba "Pacotes" do vendedor (VendedorApp.jsx) além
// do Simulador. Editar preço/pacote é uma mudança neste array só.
export const PACOTES_INTERNET = [
  { mega: 60,  preco: 49.90 },
  { mega: 90,  preco: 74.90 },
  { mega: 120, preco: 79.90 },
  { mega: 240, preco: 89.90 },
  { mega: 420, preco: 99.90, destaque: true },
  { mega: 680, preco: 119.90 },
];

export const APPS_ADICIONAIS = [
  { key: 'yellow', nome: 'Yellow', preco: 15, itens: ['Deezer', 'Ubook', 'Kaspersky', 'PlayKids', 'Estuda+', 'HUB Vantagens', 'e outros'] },
  { key: 'black',  nome: 'Black',  preco: 30, itens: ['Max', 'Disney+', 'NBA', 'Smart Fit', 'Zen', 'Queima Diária', 'Kaspersky'] },
];

// Catálogo de planos de Internet Móvel — mesma fonte única de preço da aba
// "Pacotes" do vendedor (VendedorApp.jsx) e do combo de upsell do Simulador
// (D-077). Editar preço/franquia é uma mudança neste array só.
export const PLANOS_MOVEL = [
  { key: 'pre_2gb',       plano: 'Pré',      franquia: '2 GB',  preco: 29.90 },
  { key: 'controle_10gb', plano: 'Controle', franquia: '10 GB', preco: 39.90 },
  { key: 'controle_24gb', plano: 'Controle', franquia: '24 GB', preco: 54.90 },
  { key: 'controle_35gb', plano: 'Controle', franquia: '35 GB', preco: 69.90 },
];

export function planoMovelPorKey(key) {
  return PLANOS_MOVEL.find((p) => p.key === key) || null;
}

export function pacotePorMega(mega) {
  return PACOTES_INTERNET.find((p) => p.mega === mega) || null;
}

// Próximo pacote acima do informado — usado como sugestão de upgrade na
// tela de resultado. null quando já é o pacote mais alto (680).
export function pacoteUpgrade(mega) {
  const idx = PACOTES_INTERNET.findIndex((p) => p.mega === mega);
  return idx >= 0 && idx < PACOTES_INTERNET.length - 1 ? PACOTES_INTERNET[idx + 1] : null;
}

// Categoria de perfil de uso — cada uma tem pacote FIXO associado, nunca um
// preço calculado por soma de sinais. Até o D-076 a pessoa escolhia direto
// (1 clique); a partir do D-077 o perfil é DEDUZIDO das respostas do quiz
// de qualificação (ver PERGUNTAS_OFERTA/perfilPorRespostasOferta abaixo) —
// só o RESULTADO da dedução continua sendo uma dessas 4 categorias fixas.
// Editar textos/pacote de um perfil é uma mudança neste array só.
export const PERFIS_SIMULADOR = [
  { key: 'basico',      label: 'Básico',                  descricao: 'Uso o dia a dia — redes sociais, WhatsApp, pesquisas.', pacoteMega: 120 },
  { key: 'streaming',   label: 'Streaming',                descricao: 'Assisto bastante streaming, às vezes em mais de uma tela.', pacoteMega: 240 },
  { key: 'home_office', label: 'Home Office',              descricao: 'Trabalho ou estudo de casa, faço videochamadas.', pacoteMega: 240 },
  { key: 'gamer',       label: 'Gamer / Casa Conectada',   descricao: 'Uso muita internet e navego bastante — jogos, streaming, vários dispositivos.', pacoteMega: 420 },
];

export function perfilPorKey(key) {
  return PERFIS_SIMULADOR.find((p) => p.key === key) || null;
}

// D-077: quiz FIXO de qualificação do Simulador de Oferta — substitui a
// escolha direta de perfil (D-074/D-076) por uma análise prévia. Sem
// construtor/edição pelo marketing (ao contrário das perguntas de
// 'demanda', D-075) — é catálogo fixo em código, igual PERFIS_SIMULADOR.
// Mesmo shape das perguntas configuráveis (id/texto/opcoes[].id/texto) pra
// reaproveitar normalizarRespostasDinamico() e o branch de snapshot de
// resumoPerfil() sem duplicar lógica — `peso` não é usado aqui (a dedução é
// por regra, não soma de pontos).
export const PERGUNTAS_OFERTA = [
  { id: 'dispositivos', texto: 'Quantos dispositivos estão conectados na sua rede atual?', tipo: 'single', opcoes: [
    { id: 'poucos', texto: 'Poucos (1 a 3)', peso: 0 },
    { id: 'alguns', texto: 'Alguns (4 a 7)', peso: 0 },
    { id: 'muitos', texto: 'Muitos (8 ou mais)', peso: 0 },
  ] },
  { id: 'usos', texto: 'Como vocês usam a internet?', tipo: 'multi', opcoes: [
    { id: 'streaming', texto: 'Streaming (Netflix, filmes, séries)', peso: 0 },
    { id: 'jogos', texto: 'Jogos online', peso: 0 },
    { id: 'home_office', texto: 'Trabalho / home office', peso: 0 },
    { id: 'estudos', texto: 'Estudos', peso: 0 },
    { id: 'redes', texto: 'Redes sociais', peso: 0 },
    { id: 'muitos_disp', texto: 'Muitos dispositivos ao mesmo tempo', peso: 0 },
  ] },
  { id: 'equipamentos', texto: 'Quais equipamentos usam a internet aí?', tipo: 'multi', opcoes: [
    { id: 'smart_tv', texto: 'Smart TV', peso: 0 },
    { id: 'pc', texto: 'Computadores / notebooks', peso: 0 },
    { id: 'console', texto: 'Videogames / consoles', peso: 0 },
    { id: 'celular', texto: 'Celulares', peso: 0 },
    { id: 'iot', texto: 'Câmeras / dispositivos inteligentes', peso: 0 },
  ] },
  { id: 'tem_internet', texto: 'Você já tem internet em casa?', tipo: 'single', opcoes: [
    { id: 'sim', texto: 'Sim, já tenho', peso: 0 },
    { id: 'nao', texto: 'Ainda não tenho', peso: 0 },
  ] },
  { id: 'dificuldade', texto: 'Qual a sua maior dificuldade hoje?', tipo: 'single', opcoes: [
    { id: 'lenta', texto: 'Internet lenta', peso: 0 },
    { id: 'oscilacao', texto: 'Oscilação / quedas', peso: 0 },
    { id: 'velocidade', texto: 'Pouca velocidade pro que eu preciso', peso: 0 },
    { id: 'preco', texto: 'Preço', peso: 0 },
    { id: 'satisfeito', texto: 'Estou satisfeito(a) com o serviço atual', peso: 0 },
  ] },
];

// Deduz o perfil (e portanto o pacote) a partir das respostas normalizadas
// do quiz de qualificação — por REGRA de prioridade, não soma de pontos
// (D-074 continua valendo: pacote nunca é calculado por score). Prioridade:
// jogos ou muitos dispositivos → gamer; senão home_office declarado →
// home_office; senão streaming declarado → streaming; senão básico.
// `respostas` deve vir de normalizarRespostasDinamico(PERGUNTAS_OFERTA, …)
// — nunca respostas brutas não validadas.
export function perfilPorRespostasOferta(respostas) {
  const usos = Array.isArray(respostas?.usos) ? respostas.usos : [];
  const muitosDispositivos = respostas?.dispositivos === 'muitos' || usos.includes('muitos_disp');

  if (usos.includes('jogos') || muitosDispositivos) return 'gamer';
  if (usos.includes('home_office')) return 'home_office';
  if (usos.includes('streaming')) return 'streaming';
  return 'basico';
}

// Monta o combo (pacote do perfil + adicionais marcados) e calcula o total
// SEMPRE a partir do catálogo — nunca aceita um valorTotal pronto de fora.
// Espelhada na Edge Function: o cliente manda só perfilKey + booleans/chave
// do plano Móvel, o servidor recalcula e grava a versão dele (mesmo
// princípio do scoring). `opcoes.movel` é a `key` de PLANOS_MOVEL ou null —
// nunca o preço (D-077).
export function montarCombo(perfilKey, opcoes = {}) {
  const perfil = perfilPorKey(perfilKey);
  if (!perfil) return null;
  const pacote = pacotePorMega(perfil.pacoteMega);
  const upgradePacote = pacoteUpgrade(perfil.pacoteMega);
  const yellow = opcoes.yellow === true;
  const black = opcoes.black === true;
  const upgrade = opcoes.upgrade === true && !!upgradePacote;
  const movelPlano = planoMovelPorKey(opcoes.movel);

  let valorTotal = pacote.preco;
  if (yellow) valorTotal += APPS_ADICIONAIS.find((a) => a.key === 'yellow').preco;
  if (black) valorTotal += APPS_ADICIONAIS.find((a) => a.key === 'black').preco;
  if (upgrade) valorTotal += upgradePacote.preco - pacote.preco;
  if (movelPlano) valorTotal += movelPlano.preco;

  return {
    perfil: perfilKey,
    pacoteMega: perfil.pacoteMega,
    pacotePreco: pacote.preco,
    yellow, black, upgrade,
    movel: movelPlano ? movelPlano.key : null,
    pacoteFinalMega: upgrade ? upgradePacote.mega : perfil.pacoteMega,
    valorTotal: Math.round(valorTotal * 100) / 100,
  };
}

// D-075: perguntas de INTENÇÃO configuráveis POR CAMPANHA — cada campanha
// do tipo 'perfil_consumo' tem seu próprio questionário (texto + peso por
// opção), criado/editado pelo marketing na gestão (SimuladorTab). Isto é
// DIFERENTE da pergunta de "perfil de uso" acima (D-074, PERFIS_SIMULADOR)
// que continua fixa e decide o pacote — só as perguntas de intenção (que
// alimentam pontuação/temperatura da fila) viram editáveis.
//
// Forma de uma pergunta configurável (gravada em `simuladores.perguntas`):
//   { id, texto, tipo: 'single'|'multi', opcoes: [{ id, texto, peso }] }
// Forma das respostas (gravadas em `leads.perfil_consumo.respostas`):
//   { [perguntaId]: opcaoId | opcaoId[] }
//
// PERGUNTAS_SIMULADOR (abaixo) deixou de ser o catálogo AO VIVO do quiz —
// vira só (1) o molde usado por perguntasPadrao() pra pré-preencher
// campanhas novas com um ponto de partida editável, e (2) a fonte de
// labels pra renderizar leads ANTIGOS (capturados antes do D-075, que
// gravaram respostas pela chave fixa em vez de um snapshot de perguntas).
export const PERGUNTAS_SIMULADOR = [
  {
    key: 'moradores', label: 'Quantas pessoas moram com você?', tipo: 'single',
    opcoes: [
      { key: '1',      label: 'Moro sozinho(a)' },
      { key: '2_4',    label: '2 a 4 pessoas' },
      { key: '5_mais', label: '5 ou mais pessoas' },
    ],
  },
  {
    key: 'usos', label: 'Como vocês usam a internet?', hint: 'Pode marcar mais de uma opção', tipo: 'multi',
    opcoes: [
      { key: 'streaming',   label: 'Streaming (Netflix, filmes, séries)' },
      { key: 'jogos',       label: 'Jogos online' },
      { key: 'home_office', label: 'Trabalho / home office' },
      { key: 'estudos',     label: 'Estudos' },
      { key: 'redes',       label: 'Redes sociais' },
      { key: 'muitos_disp', label: 'Muitos dispositivos ao mesmo tempo' },
    ],
  },
  {
    key: 'equipamentos', label: 'Quais equipamentos usam a internet aí?', hint: 'Pode marcar mais de uma opção', tipo: 'multi',
    opcoes: [
      { key: 'smart_tv', label: 'Smart TV' },
      { key: 'pc',       label: 'Computadores / notebooks' },
      { key: 'console',  label: 'Videogames / consoles' },
      { key: 'celular',  label: 'Celulares' },
      { key: 'iot',      label: 'Câmeras / dispositivos inteligentes' },
    ],
  },
  {
    key: 'tem_internet', label: 'Você já tem internet em casa?', tipo: 'single',
    opcoes: [
      { key: 'sim', label: 'Sim, já tenho' },
      { key: 'nao', label: 'Ainda não tenho' },
    ],
  },
  {
    key: 'dificuldade', label: 'Qual a sua maior dificuldade hoje?', tipo: 'single',
    opcoes: [
      { key: 'lenta',      label: 'Internet lenta' },
      { key: 'oscilacao',  label: 'Oscilação / quedas' },
      { key: 'velocidade', label: 'Pouca velocidade pro que eu preciso' },
      { key: 'preco',      label: 'Preço' },
      { key: 'satisfeito', label: 'Estou satisfeito(a) com o serviço atual' },
    ],
  },
];

// Pesos do molde padrão — aproximam o comportamento do scoring fixo que
// existia antes do D-075. Não são mais uma fórmula especial de código, só
// valores iniciais de uma campanha nova; o marketing edita à vontade.
const PESOS_PADRAO = {
  moradores:    { '1': 0, '2_4': 5, '5_mais': 10 },
  usos:         { streaming: 8, jogos: 8, home_office: 8, estudos: 0, redes: 0, muitos_disp: 8 },
  equipamentos: { smart_tv: 2, pc: 2, console: 2, celular: 2, iot: 2 },
  tem_internet: { sim: 0, nao: 30 },
  dificuldade:  { lenta: 20, oscilacao: 20, velocidade: 20, preco: 15, satisfeito: 0 },
};

// Molde padrão pra pré-preencher campanhas novas (e fallback de campanhas
// criadas antes do D-075, sem `perguntas` configurada ainda) — sempre uma
// cópia nova (nunca a mesma referência), pra edição não vazar entre
// campanhas diferentes.
export function perguntasPadrao() {
  return PERGUNTAS_SIMULADOR.map((p) => ({
    id: p.key,
    texto: p.label,
    tipo: p.tipo,
    opcoes: p.opcoes.map((o) => ({
      id: o.key,
      texto: o.label,
      peso: PESOS_PADRAO[p.key]?.[o.key] ?? 0,
    })),
  }));
}

// Normaliza respostas brutas (potencialmente hostis — vêm de formulário
// público) contra a config DE UMA CAMPANHA específica — descarta
// perguntas/opções que não existem naquele array. Cada campanha valida
// contra o próprio questionário, nunca um catálogo fixo global.
export function normalizarRespostasDinamico(perguntas, brutas) {
  const respostas = {};
  if (!Array.isArray(perguntas) || !brutas || typeof brutas !== 'object') return respostas;
  for (const pergunta of perguntas) {
    const valor = brutas[pergunta.id];
    const validas = new Set((pergunta.opcoes || []).map((o) => o.id));
    if (pergunta.tipo === 'multi') {
      if (Array.isArray(valor)) {
        const arr = valor.filter((v) => typeof v === 'string' && validas.has(v));
        if (arr.length) respostas[pergunta.id] = arr;
      }
    } else if (typeof valor === 'string' && validas.has(valor)) {
      respostas[pergunta.id] = valor;
    }
  }
  return respostas;
}

// Soma os pesos das opções escolhidas — sempre a partir da config da
// PRÓPRIA campanha, nunca aceita pontuação pronta vinda de fora (mesmo
// princípio de segurança do D-072, só que a "régua" agora vem do banco em
// vez de um array fixo em código). Temperatura é um PERCENTUAL da
// pontuação máxima possível daquela campanha específica — não um número
// fixo — porque cada campanha pode ter perguntas/pesos bem diferentes:
// ≥60% quente, 30–59% morno, <30% frio.
export function calcularPerfilDinamico(perguntas, brutas) {
  const respostas = normalizarRespostasDinamico(perguntas, brutas);
  let pontuacao = 0;
  let pontuacaoMaxima = 0;

  for (const pergunta of (perguntas || [])) {
    const pesos = (pergunta.opcoes || []).map((o) => Number(o.peso) || 0);
    const maxPergunta = pergunta.tipo === 'multi'
      ? pesos.filter((p) => p > 0).reduce((a, b) => a + b, 0)
      : Math.max(0, ...pesos);
    pontuacaoMaxima += maxPergunta;

    const valor = respostas[pergunta.id];
    if (valor === undefined) continue;
    if (pergunta.tipo === 'multi') {
      for (const opcaoId of valor) {
        const opcao = pergunta.opcoes.find((o) => o.id === opcaoId);
        if (opcao) pontuacao += Number(opcao.peso) || 0;
      }
    } else {
      const opcao = pergunta.opcoes.find((o) => o.id === valor);
      if (opcao) pontuacao += Number(opcao.peso) || 0;
    }
  }

  pontuacao = Math.max(0, pontuacao);
  const percentual = pontuacaoMaxima > 0 ? (pontuacao / pontuacaoMaxima) * 100 : 0;
  const temperatura = percentual >= 60 ? 'quente' : percentual >= 30 ? 'morno' : 'frio';

  return { pontuacao, pontuacaoMaxima, temperatura, respostas };
}

export function fmtMoeda(valor) {
  return `R$ ${Number(valor).toFixed(2).replace('.', ',')}`;
}

// ─────────────────────────────────────────────────────────────────────
// D-080: Quiz de Acertos — teste de conhecimento por campanha, sem
// intenção/perfil. Cada pergunta é SEMPRE de escolha única (`tipo:
// 'single'`, reaproveita normalizarRespostasDinamico) e tem uma
// `respostaCorretaId` — a opção certa entre as opções da própria pergunta.
// Pontuação = contagem de acertos (não soma de peso); a temperatura da
// fila usa o mesmo princípio percentual de 'demanda' (≥60% quente, 30–59%
// morno, <30% frio), mas sobre acertos/total em vez de pontos/máximo.
// ─────────────────────────────────────────────────────────────────────

// Molde de exemplo pra campanha 'quiz' nova — primeiro uso real do
// recurso: evento MotoFest (universo de motoclube). O marketing edita
// livremente (texto, opções, resposta certa) depois de criar a campanha,
// igual perguntasPadrao() em 'demanda' — isto NÃO é um catálogo fixo.
export function quizPerguntasPadrao() {
  return [
    { id: 'q1', texto: 'O que significa a sigla "cc" usada para motores de moto (ex: 150cc)?', tipo: 'single', respostaCorretaId: 'a', opcoes: [
      { id: 'a', texto: 'Centímetros cúbicos' },
      { id: 'b', texto: 'Cavalos consumidos' },
      { id: 'c', texto: 'Corrida contínua' },
      { id: 'd', texto: 'Combustível concentrado' },
    ] },
    { id: 'q2', texto: 'Qual dessas é uma marca de motocicleta?', tipo: 'single', respostaCorretaId: 'a', opcoes: [
      { id: 'a', texto: 'Ducati' },
      { id: 'b', texto: 'Ferrari' },
      { id: 'c', texto: 'Brastemp' },
      { id: 'd', texto: 'Positron' },
    ] },
    { id: 'q3', texto: 'O que é um "role" no universo motociclista?', tipo: 'single', respostaCorretaId: 'a', opcoes: [
      { id: 'a', texto: 'Um passeio de moto' },
      { id: 'b', texto: 'Um tipo de pneu' },
      { id: 'c', texto: 'O documento da moto' },
      { id: 'd', texto: 'Uma peça do motor' },
    ] },
    { id: 'q4', texto: 'Qual EPI é obrigatório para pilotar moto no Brasil?', tipo: 'single', respostaCorretaId: 'a', opcoes: [
      { id: 'a', texto: 'Capacete' },
      { id: 'b', texto: 'Luvas' },
      { id: 'c', texto: 'Jaqueta de couro' },
      { id: 'd', texto: 'Bota de cano alto' },
    ] },
    { id: 'q5', texto: 'O que significa "biker"?', tipo: 'single', respostaCorretaId: 'a', opcoes: [
      { id: 'a', texto: 'Motociclista' },
      { id: 'b', texto: 'Mecânico de moto' },
      { id: 'c', texto: 'Vendedor de moto' },
      { id: 'd', texto: 'Fabricante de capacete' },
    ] },
    { id: 'q6', texto: 'Qual dessas é uma categoria de motocicleta?', tipo: 'single', respostaCorretaId: 'a', opcoes: [
      { id: 'a', texto: 'Custom' },
      { id: 'b', texto: 'Sedan' },
      { id: 'c', texto: 'Hatch' },
      { id: 'd', texto: 'SUV' },
    ] },
    { id: 'q7', texto: 'O que é o "grupo de rodagem" num motoclube?', tipo: 'single', respostaCorretaId: 'a', opcoes: [
      { id: 'a', texto: 'O pelotão que anda junto num passeio' },
      { id: 'b', texto: 'O estacionamento do evento' },
      { id: 'c', texto: 'O uniforme oficial do clube' },
      { id: 'd', texto: 'O mecânico responsável pelo clube' },
    ] },
    { id: 'q8', texto: 'Qual item é essencial pra levar bagagem numa viagem longa de moto?', tipo: 'single', respostaCorretaId: 'a', opcoes: [
      { id: 'a', texto: 'Bagageiro / alforje' },
      { id: 'b', texto: 'Rodas extras' },
      { id: 'c', texto: 'Guarda-chuva' },
      { id: 'd', texto: 'Cadeira de praia' },
    ] },
    { id: 'q9', texto: 'O que significa a expressão "cair na estrada"?', tipo: 'single', respostaCorretaId: 'a', opcoes: [
      { id: 'a', texto: 'Sair para viajar de moto' },
      { id: 'b', texto: 'Sofrer uma queda' },
      { id: 'c', texto: 'Trocar de moto' },
      { id: 'd', texto: 'Lavar a moto' },
    ] },
    { id: 'q10', texto: 'Qual é o principal cuidado antes de uma viagem longa de moto?', tipo: 'single', respostaCorretaId: 'a', opcoes: [
      { id: 'a', texto: 'Revisar pneus, óleo e freios' },
      { id: 'b', texto: 'Encher o tanque de água' },
      { id: 'c', texto: 'Trocar o capacete de cor' },
      { id: 'd', texto: 'Conferir a previsão de estrelas' },
    ] },
  ];
}

// Faixas de classificação do molde padrão — exemplo real do evento
// MotoFest. `max: null` na última faixa marcaria "sem limite superior"
// (não é o caso aqui, com 10 perguntas fixas no molde, mas o construtor
// permite deixar em branco pra campanhas com mais perguntas).
export function quizFaixasPadrao() {
  return [
    { min: 0, max: 3, emoji: '🛵', titulo: 'Piloto de Primeira Viagem' },
    { min: 4, max: 6, emoji: '🏍️', titulo: 'Companheiro de Estrada' },
    { min: 7, max: 9, emoji: '🤘', titulo: 'Lenda do Asfalto' },
    { min: 10, max: 10, emoji: '👑', titulo: 'Mestre das Duas Rodas' },
  ];
}

// Acha a faixa cujo intervalo [min, max] cobre a contagem de acertos —
// `max` null/undefined é tratado como "sem limite superior" (última
// faixa, ex: "10 ou mais"). Retorna null se nenhuma faixa cobrir (o
// marketing deixou um buraco na configuração) — quem chama decide o
// fallback.
export function faixaPorAcertos(faixas, acertos) {
  if (!Array.isArray(faixas)) return null;
  return faixas.find((f) => acertos >= Number(f.min) && (f.max == null || acertos <= Number(f.max))) || null;
}

// Corrige o quiz: conta acertos comparando a resposta escolhida (já
// normalizada contra a config DESTA campanha, nunca respostas brutas) com
// `respostaCorretaId` de cada pergunta. Sempre recalculado a partir da
// config da própria campanha — mesmo princípio anti-cliente-hostil do
// scoring de 'demanda' (D-072/D-075): o cliente nunca manda `acertos`
// pronto, só as respostas brutas.
export function corrigirQuiz(perguntas, brutas) {
  const respostas = normalizarRespostasDinamico(perguntas, brutas);
  let acertos = 0;
  for (const pergunta of (perguntas || [])) {
    const valor = respostas[pergunta.id];
    if (valor !== undefined && valor === pergunta.respostaCorretaId) acertos += 1;
  }
  const total = (perguntas || []).length;
  const percentual = total > 0 ? (acertos / total) * 100 : 0;
  const temperatura = percentual >= 60 ? 'quente' : percentual >= 30 ? 'morno' : 'frio';
  return { respostas, acertos, total, temperatura };
}

// D-076: mensagem de resultado do tipo 'demanda' — texto livre por
// campanha (`simuladores.mensagem_resultado`), mostrado na tela final do
// quiz antes de pedir o contato (não existe pacote/oferta pra recomendar
// nesse fluxo, então quem substitui o "valor antes do dado" é essa
// mensagem). Este é só o valor inicial de uma campanha nova — o marketing
// edita à vontade na gestão.
export function mensagemResultadoPadrao() {
  return 'Show! Baseado nas suas respostas, um consultor da RJNet vai entrar em contato com a melhor solução pra você.';
}

// Resumo legível do perfil ("2 a 4 pessoas · Streaming · Sem internet hoje
// · Perfil: Gamer / Casa Conectada · Pacote: 680 Mega (upgrade) · + Apps
// Yellow · Total: R$ 119,90/mês") pra fila de distribuição e card do lead.
// Trata dois formatos: leads novos (D-075) trazem um snapshot de
// `perguntas` gravado na submissão — o lead preserva o que a pessoa
// realmente viu, mesmo que a campanha mude depois; leads antigos (D-072,
// sem esse snapshot) caem no catálogo fixo legado.
export function resumoPerfil(perfilConsumo) {
  const partes = [];
  if (!perfilConsumo) return partes;

  // D-080: quiz de acertos — bloco próprio, não compartilha renderização
  // com o snapshot de perguntas/respostas de 'oferta'/'demanda' (o quiz
  // não mostra cada resposta escolhida, só o resultado: acertos + faixa).
  if (perfilConsumo.tipo === 'quiz') {
    partes.push(`Acertou ${perfilConsumo.acertos} de ${perfilConsumo.total}`);
    if (perfilConsumo.faixa) partes.push(`${perfilConsumo.faixa.emoji || ''} ${perfilConsumo.faixa.titulo}`.trim());
    return partes;
  }

  if (Array.isArray(perfilConsumo.perguntas)) {
    for (const pergunta of perfilConsumo.perguntas) {
      const valor = perfilConsumo.respostas?.[pergunta.id];
      if (valor === undefined) continue;
      const labelDe = (id) => pergunta.opcoes?.find((o) => o.id === id)?.texto || id;
      if (Array.isArray(valor)) partes.push(...valor.map(labelDe));
      else partes.push(labelDe(valor));
    }
  } else if (perfilConsumo.respostas) {
    for (const pergunta of PERGUNTAS_SIMULADOR) {
      const valor = perfilConsumo.respostas[pergunta.key];
      if (valor === undefined) continue;
      const labelDe = (k) => pergunta.opcoes.find((o) => o.key === k)?.label || k;
      if (pergunta.key === 'tem_internet') {
        partes.push(valor === 'nao' ? 'Sem internet hoje' : 'Já tem internet');
        continue;
      }
      if (Array.isArray(valor)) partes.push(...valor.map(labelDe));
      else partes.push(labelDe(valor));
    }
  }

  const perfilDef = perfilPorKey(perfilConsumo.perfil);
  if (perfilDef) partes.push(`Perfil: ${perfilDef.label}`);
  const combo = perfilConsumo.combo;
  if (combo) {
    partes.push(`Pacote: ${combo.pacoteFinalMega} Mega${combo.upgrade ? ' (upgrade)' : ''}`);
    if (combo.yellow) partes.push('+ Apps Yellow');
    if (combo.black) partes.push('+ Apps Black');
    if (combo.movel) {
      const plano = planoMovelPorKey(combo.movel);
      if (plano) partes.push(`+ Móvel ${plano.plano} ${plano.franquia}`);
    }
    partes.push(`Total: ${fmtMoeda(combo.valorTotal)}/mês`);
  }
  return partes;
}
