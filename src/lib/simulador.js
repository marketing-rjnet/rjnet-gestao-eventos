// Simulador de Perfil de Consumo — catálogo de pacotes/perfis + motor de
// pontuação das perguntas de intenção.
//
// D-075: as perguntas de intenção (as que valem ponto pra fila) deixaram
// de ser um catálogo fixo em código (D-072) — agora cada campanha do tipo
// 'perfil_consumo' tem seu PRÓPRIO questionário (texto + peso por opção),
// criado/editado pelo marketing na gestão (SimuladorTab), gravado em
// `simuladores.perguntas`. A pergunta de "perfil de uso" (D-074,
// PERFIS_SIMULADOR) continua fixa e decide o pacote — só as de intenção
// viram configuráveis.
//
// Módulo deliberadamente SEM imports: é carregado standalone pelo teste
// unitário Node (tests/simulador.unit.test.js) e espelhado em Deno na Edge
// Function submeter-simulador (que recalcula o score no servidor — o
// cliente nunca manda pontuação pronta, só as respostas brutas + o id da
// campanha; o servidor busca a config dela mesmo e recalcula).

// Versão do formato de `leads.perfil_consumo` — bump quando a FORMA do
// jsonb muda (não quando só o conteúdo de uma campanha muda). v2 (D-075)
// passou a incluir `perguntas` (snapshot) e `combo`/`perfil` (D-074).
export const PERGUNTAS_SIMULADOR_VERSAO = 2;

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

export function pacotePorMega(mega) {
  return PACOTES_INTERNET.find((p) => p.mega === mega) || null;
}

// Próximo pacote acima do informado — usado como sugestão de upgrade na
// tela de resultado. null quando já é o pacote mais alto (680).
export function pacoteUpgrade(mega) {
  const idx = PACOTES_INTERNET.findIndex((p) => p.mega === mega);
  return idx >= 0 && idx < PACOTES_INTERNET.length - 1 ? PACOTES_INTERNET[idx + 1] : null;
}

// Pergunta de perfil (nova, D-074): categoria explícita escolhida pela
// pessoa — cada uma já tem pacote FIXO associado, nunca calculado por soma
// de sinais. Diferente das demais perguntas do catálogo (que só alimentam
// pontuação/temperatura da fila), esta decide sozinha o pacote recomendado.
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

// Monta o combo (pacote do perfil + adicionais marcados) e calcula o total
// SEMPRE a partir do catálogo — nunca aceita um valorTotal pronto de fora.
// Espelhada na Edge Function: o cliente manda só perfilKey + booleans, o
// servidor recalcula e grava a versão dele (mesmo princípio do scoring).
export function montarCombo(perfilKey, opcoes = {}) {
  const perfil = perfilPorKey(perfilKey);
  if (!perfil) return null;
  const pacote = pacotePorMega(perfil.pacoteMega);
  const upgradePacote = pacoteUpgrade(perfil.pacoteMega);
  const yellow = opcoes.yellow === true;
  const black = opcoes.black === true;
  const upgrade = opcoes.upgrade === true && !!upgradePacote;

  let valorTotal = pacote.preco;
  if (yellow) valorTotal += APPS_ADICIONAIS.find((a) => a.key === 'yellow').preco;
  if (black) valorTotal += APPS_ADICIONAIS.find((a) => a.key === 'black').preco;
  if (upgrade) valorTotal += upgradePacote.preco - pacote.preco;

  return {
    perfil: perfilKey,
    pacoteMega: perfil.pacoteMega,
    pacotePreco: pacote.preco,
    yellow, black, upgrade,
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
    partes.push(`Total: ${fmtMoeda(combo.valorTotal)}/mês`);
  }
  return partes;
}
