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

  // Intensidade da recomendação exibida na página pública (não vai pro banco —
  // derivável da demanda a qualquer momento).
  const demanda = usosAlta.length + (r.moradores === '5_mais' ? 1 : 0);
  const nivel = demanda >= 3 ? 'alta' : demanda >= 1 ? 'media' : 'essencial';

  // servicoInteresse do Lead: sempre residencial; streaming declarado vira
  // interesse secundário (alimenta a ordenação do OfertaPickerModal, D-057).
  const servicosInteresse = ['internet_residencial'];
  if ((r.usos || []).includes('streaming')) servicosInteresse.push('streamings');

  return {
    pontuacao,
    temperatura,
    nivel,
    ofertaRecomendada: 'internet_residencial',
    servicosInteresse,
    respostas: r,
  };
}

// Headline/subtítulo da tela de resultado, por nível de demanda.
export const RECOMENDACAO_POR_NIVEL = {
  alta: {
    titulo: 'Seu perfil pede uma conexão de alta performance',
    texto: 'Com esse uso, sua casa precisa de velocidade de sobra e estabilidade pra todo mundo ao mesmo tempo — streaming, jogos e trabalho sem travar.',
  },
  media: {
    titulo: 'Uma conexão rápida e estável é o ideal pra sua casa',
    texto: 'Seu perfil combina com um plano que dá conta do dia a dia com folga: vídeos sem travar, chamadas estáveis e todo mundo conectado.',
  },
  essencial: {
    titulo: 'Um plano essencial resolve o seu dia a dia',
    texto: 'Pro seu uso, uma conexão estável e com bom custo-benefício é o suficiente — sem pagar por velocidade que você não usa.',
  },
};

// Resumo legível do perfil ("2 a 4 pessoas · Streaming · Sem internet hoje")
// pra fila de distribuição e card do lead — labels sempre derivados do
// catálogo, nunca redigitados em outra tela.
export function resumoPerfil(perfilConsumo) {
  const r = perfilConsumo?.respostas;
  if (!r) return [];
  const partes = [];
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
  return partes;
}
