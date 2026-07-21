// Edge Function: submeter-simulador
// Porta pública de Captação do Simulador: recebe as respostas do quiz +
// contato que o próprio titular preenche na página pública (sem sessão),
// RECALCULA pontuação/temperatura/oferta no servidor (o cliente nunca
// manda score pronto — formulário público é input hostil, D-067), exige
// consentimento LGPD e grava o Lead com service_role. vendedor_id nasce
// nulo — distribuição manual por marketing/comercial, mesma fila do Form
// Builder ("Leads sem vendedor" em LeadsTab.jsx).
//
// D-076/D-077: 2 fluxos independentes por campanha (tipo), nunca mais
// encadeados na mesma sessão — cada campanha só carrega e só usa a config
// do SEU próprio tipo:
// - 'oferta': quiz FIXO de qualificação (PERGUNTAS_OFERTA) — o perfil de
//   uso (e portanto o pacote) é DEDUZIDO das respostas via
//   perfilPorRespostasOferta(), nunca escolhido/enviado pelo cliente
//   (D-077) → pacote + combo de upsell (apps, upgrade, plano Móvel). Lead
//   sempre nasce temperatura='quente', pontuacao=null.
// - 'demanda': perguntas configuráveis DAQUELA CAMPANHA (D-075, texto +
//   peso por opção, editadas pelo marketing) → pontuação/temperatura
//   calculadas no servidor. Substitui o antigo tipo 'territorial'
//   (removido) como captação qualificada sem pacote fixo.
// - 'quiz' (D-080): teste de CONHECIMENTO configurável DAQUELA CAMPANHA —
//   cada pergunta tem uma resposta certa; pontuação = contagem de acertos
//   (nunca soma de peso). O marketing também define faixas de
//   classificação (min/max de acertos → emoji/título), recalculadas aqui
//   a partir da config gravada — o cliente nunca manda `acertos`/faixa
//   prontos. Primeiro uso real: evento MotoFest (universo de motoclube).
//
// D-083: 'quiz' passa a ser em DUAS fases — nunca mais um insert único
// como 'oferta'/'demanda' continuam sendo. O cadastro (nome/WhatsApp/LGPD)
// acontece ANTES do quiz, pra garantir o contato mesmo que a pessoa
// abandone no meio (todo cadastro é um dado bom pra empresa, termine o
// quiz ou não). `body.fase` distingue as duas escritas:
//   - 'cadastro': INSERT do lead com contato/consentimento/utm já
//     completos, mas `pontuacao`/`perfil_consumo` ainda nulos (quiz não
//     feito) — servidor gera o `id` e devolve em `leadId` pro cliente
//     guardar (localStorage) e usar depois.
//   - 'conclusao': UPDATE desse mesmo lead com o resultado do quiz
//     (`perfil_consumo`/`pontuacao`/`temperatura`), disparado só quando a
//     pessoa clica "Participar do sorteio" no final — nunca automático.
//     Guardado por `pontuacao is null` no WHERE (atômico): só a PRIMEIRA
//     conclusão vale, 1 chance só, sem corrida de concorrência.
// 'oferta'/'demanda' não usam `fase` — continuam exatamente como antes,
// um único INSERT com tudo already computado.
//
// D-084: o bloqueio de "1 cadastro por pessoa" é por NÚMERO de WhatsApp
// dentro da MESMA campanha (`simulador_id` + `telefone`), nunca por
// navegador/aparelho — uma família com um único celular pode cadastrar
// várias pessoas normalmente (números diferentes); só o MESMO número não
// pode se cadastrar 2 vezes na mesma campanha. Checado na fase 'cadastro',
// antes do insert.
//
// O motor de scoring abaixo ESPELHA src/lib/simulador.js — duplicado
// porque este código roda em Deno, fora do bundle do app (mesmo padrão dos
// validadores em _shared/captacao.ts). Mudou lá, muda aqui.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getCorsHeaders, json, sanitizeText, validarTelefone, containsLink,
  getClientIp, atingiuRateLimit,
} from '../_shared/captacao.ts';

const PERGUNTAS_SIMULADOR_VERSAO = 3;

type Opcao = { id: string; texto: string; peso: number };
type Pergunta = { id: string; texto: string; tipo: 'single' | 'multi'; opcoes: Opcao[] };

// Espelho de PACOTES_INTERNET/APPS_ADICIONAIS/PERFIS_SIMULADOR em
// src/lib/simulador.js (D-074) — o combo (pacote + adicionais) é sempre
// recalculado aqui a partir do perfilKey; o cliente nunca manda valorTotal.
const PACOTES_INTERNET: { mega: number; preco: number }[] = [
  { mega: 60, preco: 49.90 }, { mega: 90, preco: 74.90 }, { mega: 120, preco: 79.90 },
  { mega: 240, preco: 89.90 }, { mega: 420, preco: 99.90 }, { mega: 680, preco: 119.90 },
];
const APPS_PRECO: Record<string, number> = { yellow: 15, black: 30 };
const PERFIS_SIMULADOR: Record<string, number> = {
  basico: 120, streaming: 240, home_office: 240, gamer: 420,
};

// Espelho de PLANOS_MOVEL em src/lib/simulador.js (D-077) — upsell de
// plano Móvel no combo; `key` é a única coisa que o cliente manda, preço
// sempre vem daqui.
const PLANOS_MOVEL: Record<string, number> = {
  pre_2gb: 29.90, controle_10gb: 39.90, controle_24gb: 54.90, controle_35gb: 69.90,
};

function pacotePorMega(mega: number) {
  return PACOTES_INTERNET.find((p) => p.mega === mega) || null;
}
function pacoteUpgrade(mega: number) {
  const idx = PACOTES_INTERNET.findIndex((p) => p.mega === mega);
  return idx >= 0 && idx < PACOTES_INTERNET.length - 1 ? PACOTES_INTERNET[idx + 1] : null;
}

function montarCombo(perfilKey: string, opcoes: { yellow?: boolean; black?: boolean; upgrade?: boolean; movel?: string }) {
  const pacoteMega = PERFIS_SIMULADOR[perfilKey];
  if (!pacoteMega) return null;
  const pacote = pacotePorMega(pacoteMega)!;
  const upgradePacote = pacoteUpgrade(pacoteMega);
  const yellow = opcoes.yellow === true;
  const black = opcoes.black === true;
  const upgrade = opcoes.upgrade === true && !!upgradePacote;
  const movelKey = typeof opcoes.movel === 'string' && PLANOS_MOVEL[opcoes.movel] !== undefined ? opcoes.movel : null;

  let valorTotal = pacote.preco;
  if (yellow) valorTotal += APPS_PRECO.yellow;
  if (black) valorTotal += APPS_PRECO.black;
  if (upgrade) valorTotal += upgradePacote!.preco - pacote.preco;
  if (movelKey) valorTotal += PLANOS_MOVEL[movelKey];

  return {
    perfil: perfilKey, pacoteMega, pacotePreco: pacote.preco,
    yellow, black, upgrade, movel: movelKey,
    pacoteFinalMega: upgrade ? upgradePacote!.mega : pacoteMega,
    valorTotal: Math.round(valorTotal * 100) / 100,
  };
}

// D-077: quiz FIXO de qualificação do Simulador de Oferta — espelho de
// PERGUNTAS_OFERTA em src/lib/simulador.js. Sem construtor/edição pelo
// marketing (ao contrário das perguntas de 'demanda').
function perguntasOferta(): Pergunta[] {
  return [
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
}

// Espelho de perfilPorRespostasOferta em src/lib/simulador.js — deduz o
// perfil por REGRA de prioridade a partir das respostas JÁ normalizadas
// (nunca aceita perfil pronto do cliente, D-077).
function perfilPorRespostasOferta(respostas: Record<string, string | string[]>): string {
  const usos = Array.isArray(respostas.usos) ? respostas.usos : [];
  const muitosDispositivos = respostas.dispositivos === 'muitos' || usos.includes('muitos_disp');

  if (usos.includes('jogos') || muitosDispositivos) return 'gamer';
  if (usos.includes('home_office')) return 'home_office';
  if (usos.includes('streaming')) return 'streaming';
  return 'basico';
}

// D-075: molde padrão — mesmo conteúdo de perguntasPadrao() em
// src/lib/simulador.js. Usado como fallback quando a campanha 'demanda'
// ainda não tem `perguntas` configurada.
function perguntasPadraoFallback(): Pergunta[] {
  return [
    { id: 'moradores', texto: 'Quantas pessoas moram com você?', tipo: 'single', opcoes: [
      { id: '1', texto: 'Moro sozinho(a)', peso: 0 },
      { id: '2_4', texto: '2 a 4 pessoas', peso: 5 },
      { id: '5_mais', texto: '5 ou mais pessoas', peso: 10 },
    ] },
    { id: 'usos', texto: 'Como vocês usam a internet?', tipo: 'multi', opcoes: [
      { id: 'streaming', texto: 'Streaming (Netflix, filmes, séries)', peso: 8 },
      { id: 'jogos', texto: 'Jogos online', peso: 8 },
      { id: 'home_office', texto: 'Trabalho / home office', peso: 8 },
      { id: 'estudos', texto: 'Estudos', peso: 0 },
      { id: 'redes', texto: 'Redes sociais', peso: 0 },
      { id: 'muitos_disp', texto: 'Muitos dispositivos ao mesmo tempo', peso: 8 },
    ] },
    { id: 'equipamentos', texto: 'Quais equipamentos usam a internet aí?', tipo: 'multi', opcoes: [
      { id: 'smart_tv', texto: 'Smart TV', peso: 2 },
      { id: 'pc', texto: 'Computadores / notebooks', peso: 2 },
      { id: 'console', texto: 'Videogames / consoles', peso: 2 },
      { id: 'celular', texto: 'Celulares', peso: 2 },
      { id: 'iot', texto: 'Câmeras / dispositivos inteligentes', peso: 2 },
    ] },
    { id: 'tem_internet', texto: 'Você já tem internet em casa?', tipo: 'single', opcoes: [
      { id: 'sim', texto: 'Sim, já tenho', peso: 0 },
      { id: 'nao', texto: 'Ainda não tenho', peso: 30 },
    ] },
    { id: 'dificuldade', texto: 'Qual a sua maior dificuldade hoje?', tipo: 'single', opcoes: [
      { id: 'lenta', texto: 'Internet lenta', peso: 20 },
      { id: 'oscilacao', texto: 'Oscilação / quedas', peso: 20 },
      { id: 'velocidade', texto: 'Pouca velocidade pro que eu preciso', peso: 20 },
      { id: 'preco', texto: 'Preço', peso: 15 },
      { id: 'satisfeito', texto: 'Estou satisfeito(a) com o serviço atual', peso: 0 },
    ] },
  ];
}

// Espelho de normalizarRespostasDinamico em src/lib/simulador.js — valida
// respostas brutas (hostis) contra a config DESTA campanha, não um
// catálogo fixo global.
function normalizarRespostasDinamico(perguntas: Pergunta[], brutas: unknown): Record<string, string | string[]> {
  const respostas: Record<string, string | string[]> = {};
  if (!Array.isArray(perguntas) || !brutas || typeof brutas !== 'object') return respostas;
  const b = brutas as Record<string, unknown>;
  for (const pergunta of perguntas) {
    const valor = b[pergunta.id];
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

// Espelho de calcularPerfilDinamico em src/lib/simulador.js — soma pesos
// das opções escolhidas SEMPRE a partir da config desta campanha; a
// temperatura é um percentual da pontuação máxima possível dela.
function calcularPerfilDinamico(perguntas: Pergunta[], brutas: unknown) {
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
      for (const opcaoId of (valor as string[])) {
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

// Serviço de interesse do Lead deriva do PERFIL escolhido (D-074, tipo
// 'oferta') — não das perguntas de intenção, que agora são livres e não
// têm mais uma chave garantida tipo "usos"/"streaming".
function servicosInteressePorPerfil(perfilKey: string): string[] {
  return perfilKey === 'streaming' ? ['internet_residencial', 'streamings'] : ['internet_residencial'];
}

// ─────────────────────────────────────────────────────────────────────
// D-080: Quiz de Acertos — espelho de faixaPorAcertos/corrigirQuiz em
// src/lib/simulador.js. Cada pergunta de 'quiz' é sempre `tipo: 'single'`
// (reaproveita normalizarRespostasDinamico) e tem `respostaCorretaId`.
// ─────────────────────────────────────────────────────────────────────
type QuizPergunta = Pergunta & { respostaCorretaId?: string };
type QuizFaixa = { min: number; max: number | null; emoji?: string; titulo: string };

function faixaPorAcertos(faixas: QuizFaixa[] | null | undefined, acertos: number): QuizFaixa | null {
  if (!Array.isArray(faixas)) return null;
  return faixas.find((f) => acertos >= Number(f.min) && (f.max == null || acertos <= Number(f.max))) || null;
}

function corrigirQuiz(perguntas: QuizPergunta[], brutas: unknown) {
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

// Atribuição de tráfego pago: whitelist de chaves UTM capturadas pela
// página pública. Valores sanitizados e curtos — nunca texto livre longo.
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

function sanitizarUtm(bruto: unknown): Record<string, string> | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const b = bruto as Record<string, unknown>;
  const utm: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const valor = sanitizeText(b[key], 120);
    if (valor && !containsLink(valor)) utm[key] = valor;
  }
  return Object.keys(utm).length > 0 ? utm : null;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, corsHeaders);

  try {
    const body = await req.json();

    // Honeypot: aceita silenciosamente sem gravar nada (mesmo padrão do
    // submeter-formulario) — não dá pista pro spammer. Só o cadastro/
    // fluxo legado manda esse campo — 'conclusao' nunca reenvia o form.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return json({ ok: true }, 200, corsHeaders);
    }

    const simuladorId = sanitizeText(body.simuladorId, 80);
    if (!simuladorId) return json({ error: 'Campanha inválida.' }, 400, corsHeaders);

    // D-083: 'cadastro'/'conclusao' só existem pro tipo 'quiz' (2 escritas
    // no servidor); qualquer outro valor de `fase` (incluindo ausente) é o
    // fluxo legado de 'oferta'/'demanda', um único insert com tudo já
    // calculado, inalterado.
    const fase: 'cadastro' | 'conclusao' | null =
      body.fase === 'cadastro' || body.fase === 'conclusao' ? body.fase : null;

    // Consentimento só é exigido em quem grava contato pela primeira vez —
    // a conclusão do quiz não reenvia contato/consentimento, só atualiza o
    // lead que já os tem gravados desde o cadastro.
    if (fase !== 'conclusao' && body.consentimentoColetado !== true) {
      return json({ error: 'É necessário confirmar o consentimento para uso dos dados.' }, 400, corsHeaders);
    }

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const clientIp = getClientIp(req);
    // Rate limit conta linhas NOVAS em `leads` (D-067) — 'conclusao' é um
    // UPDATE, não cria linha, então fica fora dessa contagem; quem
    // protege contra flood é o INSERT do cadastro/legado.
    if (fase !== 'conclusao' && await atingiuRateLimit(admin, clientIp)) {
      return json({ error: 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.' }, 429, corsHeaders);
    }

    const { data: simulador, error: simErro } = await admin
      .from('simuladores')
      .select('id,tipo,ativo,perguntas,quiz_perguntas,quiz_faixas')
      .eq('id', simuladorId)
      .maybeSingle();
    if (simErro || !simulador || !simulador.ativo) {
      return json({ error: 'Campanha não encontrada ou encerrada.' }, 404, corsHeaders);
    }

    // ─── D-083: conclusão do quiz — UPDATE no lead já cadastrado ───────
    // Nunca aceita `acertos`/faixa prontos do cliente — recalcula tudo a
    // partir da config gravada da campanha, igual ao fluxo legado. A
    // guarda `pontuacao is null` no WHERE torna a escrita atômica: só a
    // PRIMEIRA conclusão bem-sucedida vale (1 chance só, sem corrida de
    // concorrência entre 2 chamadas simultâneas com o mesmo leadId).
    if (fase === 'conclusao') {
      if (simulador.tipo !== 'quiz') {
        return json({ error: 'Essa campanha não usa esse tipo de submissão.' }, 400, corsHeaders);
      }
      const leadId = sanitizeText(body.leadId, 80);
      if (!leadId) return json({ error: 'Cadastro não encontrado. Recarregue a página e cadastre-se novamente.' }, 400, corsHeaders);

      const perguntasQuiz: QuizPergunta[] = simulador.quiz_perguntas ?? [];
      if (perguntasQuiz.length === 0) {
        return json({ error: 'Essa campanha ainda está sendo preparada.' }, 400, corsHeaders);
      }
      const resultado = corrigirQuiz(perguntasQuiz, body.respostas);
      const faixa = faixaPorAcertos(simulador.quiz_faixas, resultado.acertos)
        ?? { emoji: '🎯', titulo: 'Participante' };

      const { data: atualizado, error: updErro } = await admin
        .from('leads')
        .update({
          perfil_consumo: {
            versao: PERGUNTAS_SIMULADOR_VERSAO, tipo: 'quiz', perguntas: perguntasQuiz,
            respostas: resultado.respostas, acertos: resultado.acertos, total: resultado.total, faixa,
          },
          pontuacao: resultado.acertos,
          temperatura: resultado.temperatura,
        })
        .eq('id', leadId)
        .eq('simulador_id', simuladorId)
        .is('pontuacao', null)
        .select('id');

      if (updErro) {
        console.error('[rjnet:edge] Falha ao concluir quiz do simulador:', updErro);
        return json({ error: 'Não foi possível registrar sua participação agora. Tente novamente em instantes.' }, 500, corsHeaders);
      }
      if (!atualizado || atualizado.length === 0) {
        return json({ error: 'Esse quiz já foi concluído para esse cadastro.' }, 409, corsHeaders);
      }
      return json({ ok: true }, 200, corsHeaders);
    }

    // Contato: nome e WhatsApp obrigatórios (são o próprio objetivo da
    // captação); bairro/cidade opcionais mas validados.
    const nome = sanitizeText(body.nome, 120);
    if (!nome) return json({ error: 'Nome é obrigatório.' }, 400, corsHeaders);
    if (containsLink(nome)) return json({ error: 'Campo "nome" não pode conter link.' }, 400, corsHeaders);

    const telefone = typeof body.telefone === 'string' ? body.telefone.trim() : '';
    if (!validarTelefone(telefone)) {
      return json({ error: 'Telefone inválido. Informe DDD + número (10 ou 11 dígitos).' }, 400, corsHeaders);
    }

    const bairro = sanitizeText(body.bairro, 80);
    const cidade = sanitizeText(body.cidade, 80);
    if ((bairro && containsLink(bairro)) || (cidade && containsLink(cidade))) {
      return json({ error: 'Bairro/cidade não podem conter link.' }, 400, corsHeaders);
    }

    // ─── D-083: cadastro do quiz — INSERT parcial, sem resultado ainda ─
    // Garante o contato mesmo que a pessoa abandone o quiz depois — todo
    // cadastro é gravado, termine o quiz ou não. `perfil_consumo`/
    // `pontuacao` ficam nulos até a conclusão (fase 'conclusao' acima).
    if (fase === 'cadastro') {
      if (simulador.tipo !== 'quiz') {
        return json({ error: 'Essa campanha não usa esse tipo de submissão.' }, 400, corsHeaders);
      }

      // D-084: bloqueio é por NÚMERO de WhatsApp dentro da MESMA campanha,
      // nunca por navegador/aparelho — uma família com 1 celular só pode
      // cadastrar várias pessoas (números diferentes) normalmente; só o
      // MESMO número não pode se cadastrar 2 vezes na mesma campanha.
      const { count: jaCadastrado, error: dupErro } = await admin
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('simulador_id', simuladorId)
        .eq('telefone', telefone)
        .eq('deletado', false);
      if (dupErro) {
        console.error('[rjnet:edge] Falha ao verificar duplicidade do cadastro:', dupErro);
        return json({ error: 'Não foi possível registrar seus dados agora. Tente novamente em instantes.' }, 500, corsHeaders);
      }
      if ((jaCadastrado ?? 0) > 0) {
        return json({ error: 'Esse número de WhatsApp já está cadastrado nessa campanha.' }, 409, corsHeaders);
      }

      const utmCadastro = sanitizarUtm(body.utm);
      const leadId = `l-sim-${crypto.randomUUID()}`;
      const agoraCadastro = new Date().toISOString();
      const { error: insErro } = await admin.from('leads').insert({
        id: leadId,
        evento_id: null,
        mes_referencia: null,
        vendedor_id: null,
        vendedor_nome: null,
        origem: 'simulador',
        origem_ip: clientIp,
        simulador_id: simuladorId,
        nome,
        telefone,
        cpf: null,
        endereco: null,
        bairro: bairro || null,
        cidade: cidade || null,
        campos_extras: {},
        perfil_consumo: null,
        pontuacao: null,
        oferta_recomendada: null,
        utm: utmCadastro,
        servico_interesse: JSON.stringify(['outro']),
        observacao: null,
        ja_cliente_rjnet: false,
        criado_em: agoraCadastro,
        consentimento_coletado: true,
        consentimento_em: agoraCadastro,
        versao_termo: 'simulador-v1',
        deletado: false,
      });

      if (insErro) {
        console.error('[rjnet:edge] Falha ao gravar cadastro do simulador:', insErro);
        return json({ error: 'Não foi possível registrar seus dados agora. Tente novamente em instantes.' }, 500, corsHeaders);
      }
      return json({ ok: true, leadId }, 200, corsHeaders);
    }

    // ─── Legado: 'oferta'/'demanda' — um único insert com tudo calculado ─
    // D-076/D-077: 2 fluxos independentes por tipo de campanha — nunca mais
    // encadeados na mesma sessão (ver comentário de topo do arquivo).
    let perfilConsumo: unknown = null;
    let pontuacao: number | null = null;
    let ofertaRecomendada: string | null = null;
    let servicosInteresse: string[];
    let temperatura: string;

    if (simulador.tipo === 'demanda') {
      // null/undefined = campanha criada antes do D-075, cai pro molde
      // padrão; array vazio (marketing removeu tudo) é diferente e barra
      // a submissão abaixo, em vez de mascarar com o molde.
      const perguntas: Pergunta[] = simulador.perguntas == null
        ? perguntasPadraoFallback()
        : simulador.perguntas;
      if (perguntas.length === 0) {
        return json({ error: 'Essa campanha ainda está sendo preparada.' }, 400, corsHeaders);
      }

      // Score SEMPRE recalculado aqui — body.respostas é a única entrada.
      const perfil = calcularPerfilDinamico(perguntas, body.respostas);
      perfilConsumo = { versao: PERGUNTAS_SIMULADOR_VERSAO, perguntas, respostas: perfil.respostas };
      pontuacao = perfil.pontuacao;
      servicosInteresse = ['internet_residencial'];
      temperatura = perfil.temperatura;
    } else if (simulador.tipo === 'quiz') {
      // D-083: 'quiz' sempre manda `fase` ('cadastro'/'conclusao') — os 2
      // branches acima já tratam e retornam antes de chegar aqui. Só cai
      // neste ponto com um bundle desatualizado em cache (version skew).
      return json({ error: 'Atualize a página e tente novamente.' }, 400, corsHeaders);
    } else {
      // 'oferta' (D-077): perfil DEDUZIDO das respostas do quiz FIXO de
      // qualificação — nunca aceita `body.perfil` pronto do cliente. O
      // combo (adicionais + upgrade + plano Móvel) é sempre recalculado
      // aqui a partir só das chaves marcadas. Sem score de intenção — lead
      // sempre entra quente (chegou até o fim do quiz + deixou contato).
      const perguntas = perguntasOferta();
      const respostasNormalizadas = normalizarRespostasDinamico(perguntas, body.respostas);
      const perfilKey = perfilPorRespostasOferta(respostasNormalizadas);

      const comboBruto = (body.combo && typeof body.combo === 'object') ? body.combo : {};
      const combo = montarCombo(perfilKey, {
        yellow: comboBruto.yellow === true,
        black: comboBruto.black === true,
        upgrade: comboBruto.upgrade === true,
        movel: typeof comboBruto.movel === 'string' ? comboBruto.movel : undefined,
      });

      perfilConsumo = { versao: PERGUNTAS_SIMULADOR_VERSAO, perguntas, respostas: respostasNormalizadas, perfil: perfilKey, combo };
      ofertaRecomendada = 'internet_residencial';
      servicosInteresse = servicosInteressePorPerfil(perfilKey);
      temperatura = 'quente';
    }

    const utm = sanitizarUtm(body.utm);

    const agora = new Date().toISOString();
    const { error } = await admin.from('leads').insert({
      id: `l-sim-${crypto.randomUUID()}`,
      evento_id: null,
      mes_referencia: null,
      vendedor_id: null,
      vendedor_nome: null,
      origem: 'simulador',
      origem_ip: clientIp,
      simulador_id: simuladorId,
      nome,
      telefone,
      cpf: null,
      endereco: null,
      bairro: bairro || null,
      cidade: cidade || null,
      campos_extras: {},
      perfil_consumo: perfilConsumo,
      pontuacao,
      oferta_recomendada: ofertaRecomendada,
      utm,
      servico_interesse: JSON.stringify(servicosInteresse),
      temperatura,
      observacao: null,
      ja_cliente_rjnet: false,
      criado_em: agora,
      consentimento_coletado: true,
      consentimento_em: agora,
      versao_termo: 'simulador-v1',
      deletado: false,
    });

    if (error) {
      console.error('[rjnet:edge] Falha ao gravar lead do simulador:', error);
      return json({ error: 'Não foi possível registrar seus dados agora. Tente novamente em instantes.' }, 500, corsHeaders);
    }

    return json({ ok: true }, 200, corsHeaders);
  } catch (err) {
    console.error('[rjnet:edge] Erro não tratado em submeter-simulador:', err);
    return json({ error: 'Erro interno do servidor. Tente novamente em instantes.' }, 500, getCorsHeaders(req));
  }
});
