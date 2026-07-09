// Simulador de Perfil de Consumo — catálogo de perguntas + scoring.
//
// Mesmo princípio do CAMPOS_FORMULARIO (D-062): catálogo FIXO e versionado
// em código, nunca um motor de quiz genérico configurável em runtime. A
// tabela `simuladores` guarda só a identidade da campanha (nome/slug);
// mudar pergunta = commit aqui + bump de PERGUNTAS_SIMULADOR_VERSAO.
//
// Módulo deliberadamente SEM imports: é carregado standalone pelo teste
// unitário Node (tests/simulador.unit.test.js) e espelhado em Deno na Edge
// Function submeter-simulador (que recalcula o score no servidor — o
// cliente nunca manda pontuação pronta, só as respostas brutas).

export const PERGUNTAS_SIMULADOR_VERSAO = 1;

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
    exibirSe: { tem_internet: 'sim' },
    opcoes: [
      { key: 'lenta',      label: 'Internet lenta' },
      { key: 'oscilacao',  label: 'Oscilação / quedas' },
      { key: 'velocidade', label: 'Pouca velocidade pro que eu preciso' },
      { key: 'preco',      label: 'Preço' },
      { key: 'satisfeito', label: 'Estou satisfeito(a) com o serviço atual' },
    ],
  },
];

// Usos que puxam banda/estabilidade — cada um soma pontos de intenção.
const USOS_ALTA_DEMANDA = ['streaming', 'jogos', 'home_office', 'muitos_disp'];

// Perguntas que a página deve exibir dado o estado atual das respostas
// (perguntas condicionais via exibirSe). Compartilhada entre wizard e testes.
export function perguntasVisiveis(respostas) {
  return PERGUNTAS_SIMULADOR.filter((p) => {
    if (!p.exibirSe) return true;
    return Object.entries(p.exibirSe).every(([k, v]) => respostas[k] === v);
  });
}

// Normaliza respostas brutas (potencialmente hostis — vêm de formulário
// público) contra o catálogo: descarta chaves/opções desconhecidas,
// garante single=string válida e multi=array de opções válidas.
export function normalizarRespostas(brutas) {
  const respostas = {};
  if (!brutas || typeof brutas !== 'object') return respostas;
  for (const pergunta of PERGUNTAS_SIMULADOR) {
    const valor = brutas[pergunta.key];
    const validas = new Set(pergunta.opcoes.map((o) => o.key));
    if (pergunta.tipo === 'single') {
      if (typeof valor === 'string' && validas.has(valor)) respostas[pergunta.key] = valor;
    } else {
      if (Array.isArray(valor)) {
        const arr = valor.filter((v) => typeof v === 'string' && validas.has(v));
        if (arr.length) respostas[pergunta.key] = arr;
      }
    }
  }
  // Coerência da condicional: dificuldade só vale se tem_internet === 'sim'
  if (respostas.tem_internet !== 'sim') delete respostas.dificuldade;
  return respostas;
}

// Soma ponderada → pontuação de intenção. Pesos calibráveis por commit
// (cobertos por tests/simulador.unit.test.js — ajustar os dois juntos).
export function calcularPerfil(brutas) {
  const r = normalizarRespostas(brutas);
  let pontuacao = 0;

  if (r.tem_internet === 'nao') pontuacao += 30; // demanda reprimida — sinal mais quente
  if (['lenta', 'oscilacao', 'velocidade'].includes(r.dificuldade)) pontuacao += 20; // dor ativa
  if (r.dificuldade === 'preco') pontuacao += 15;
  if (r.dificuldade === 'satisfeito') pontuacao -= 15;

  const usosAlta = (r.usos || []).filter((u) => USOS_ALTA_DEMANDA.includes(u));
  pontuacao += usosAlta.length * 8;

  if (r.moradores === '5_mais') pontuacao += 10;
  if (r.moradores === '2_4') pontuacao += 5;
  if ((r.equipamentos || []).length >= 3) pontuacao += 5;

  pontuacao = Math.max(0, pontuacao);

  const temperatura = pontuacao >= 60 ? 'quente' : pontuacao >= 30 ? 'morno' : 'frio';

  // servicoInteresse do Lead: sempre residencial; streaming declarado vira
  // interesse secundário (alimenta a ordenação do OfertaPickerModal, D-057).
  const servicosInteresse = ['internet_residencial'];
  if ((r.usos || []).includes('streaming')) servicosInteresse.push('streamings');

  return {
    pontuacao,
    temperatura,
    ofertaRecomendada: 'internet_residencial',
    servicosInteresse,
    respostas: r,
  };
}

export function fmtMoeda(valor) {
  return `R$ ${Number(valor).toFixed(2).replace('.', ',')}`;
}

// Resumo legível do perfil ("2 a 4 pessoas · Streaming · Sem internet hoje
// · Perfil: Gamer / Casa Conectada · Pacote: 680 Mega (upgrade) · + Apps
// Yellow · Total: R$ 119,90/mês") pra fila de distribuição e card do lead
// — labels sempre derivados do catálogo, nunca redigitados em outra tela.
export function resumoPerfil(perfilConsumo) {
  const r = perfilConsumo?.respostas;
  const partes = [];
  if (r) {
    for (const pergunta of PERGUNTAS_SIMULADOR) {
      const valor = r[pergunta.key];
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
  const perfilDef = perfilPorKey(perfilConsumo?.perfil);
  if (perfilDef) partes.push(`Perfil: ${perfilDef.label}`);
  const combo = perfilConsumo?.combo;
  if (combo) {
    partes.push(`Pacote: ${combo.pacoteFinalMega} Mega${combo.upgrade ? ' (upgrade)' : ''}`);
    if (combo.yellow) partes.push('+ Apps Yellow');
    if (combo.black) partes.push('+ Apps Black');
    partes.push(`Total: ${fmtMoeda(combo.valorTotal)}/mês`);
  }
  return partes;
}
