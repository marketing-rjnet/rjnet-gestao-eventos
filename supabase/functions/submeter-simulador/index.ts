// Edge Function: submeter-simulador
// Porta pública de Captação do Simulador de Perfil de Consumo: recebe as
// respostas do quiz + contato que o próprio titular preenche na página
// pública (sem sessão), valida as respostas contra o catálogo FIXO de
// perguntas, RECALCULA pontuação/temperatura/oferta no servidor (o cliente
// nunca manda score pronto — formulário público é input hostil, D-067),
// exige consentimento LGPD e grava o Lead com service_role. vendedor_id
// nasce nulo — distribuição manual por marketing/comercial, mesma fila do
// Form Builder ("Leads sem vendedor" em LeadsTab.jsx).
//
// O catálogo e o scoring abaixo ESPELHAM src/lib/simulador.js — duplicados
// porque este código roda em Deno, fora do bundle do app (mesmo padrão dos
// validadores em _shared/captacao.ts). Mudou lá, muda aqui + bump de versão.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getCorsHeaders, json, sanitizeText, validarTelefone, containsLink,
  getClientIp, atingiuRateLimit,
} from '../_shared/captacao.ts';

const PERGUNTAS_SIMULADOR_VERSAO = 1;

// Serviços aceitos no interesse declarado do tipo 'territorial' — mesmo
// enum de servicoInteresse do restante do sistema.
const SERVICOS_VALIDOS = new Set([
  'internet_residencial',
  'internet_empresarial',
  'rjnet_movel',
  'streamings',
  'outro',
]);

// Só chaves/tipos — labels ficam no frontend (src/lib/simulador.js).
const PERGUNTAS: { key: string; tipo: 'single' | 'multi'; opcoes: string[] }[] = [
  { key: 'moradores',    tipo: 'single', opcoes: ['1', '2_4', '5_mais'] },
  { key: 'usos',         tipo: 'multi',  opcoes: ['streaming', 'jogos', 'home_office', 'estudos', 'redes', 'muitos_disp'] },
  { key: 'equipamentos', tipo: 'multi',  opcoes: ['smart_tv', 'pc', 'console', 'celular', 'iot'] },
  { key: 'tem_internet', tipo: 'single', opcoes: ['sim', 'nao'] },
  { key: 'dificuldade',  tipo: 'single', opcoes: ['lenta', 'oscilacao', 'velocidade', 'preco', 'satisfeito'] },
];

const USOS_ALTA_DEMANDA = ['streaming', 'jogos', 'home_office', 'muitos_disp'];

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

function pacotePorMega(mega: number) {
  return PACOTES_INTERNET.find((p) => p.mega === mega) || null;
}
function pacoteUpgrade(mega: number) {
  const idx = PACOTES_INTERNET.findIndex((p) => p.mega === mega);
  return idx >= 0 && idx < PACOTES_INTERNET.length - 1 ? PACOTES_INTERNET[idx + 1] : null;
}

function montarCombo(perfilKey: string, opcoes: { yellow?: boolean; black?: boolean; upgrade?: boolean }) {
  const pacoteMega = PERFIS_SIMULADOR[perfilKey];
  if (!pacoteMega) return null;
  const pacote = pacotePorMega(pacoteMega)!;
  const upgradePacote = pacoteUpgrade(pacoteMega);
  const yellow = opcoes.yellow === true;
  const black = opcoes.black === true;
  const upgrade = opcoes.upgrade === true && !!upgradePacote;

  let valorTotal = pacote.preco;
  if (yellow) valorTotal += APPS_PRECO.yellow;
  if (black) valorTotal += APPS_PRECO.black;
  if (upgrade) valorTotal += upgradePacote!.preco - pacote.preco;

  return {
    perfil: perfilKey, pacoteMega, pacotePreco: pacote.preco,
    yellow, black, upgrade,
    pacoteFinalMega: upgrade ? upgradePacote!.mega : pacoteMega,
    valorTotal: Math.round(valorTotal * 100) / 100,
  };
}

function normalizarRespostas(brutas: unknown): Record<string, string | string[]> {
  const respostas: Record<string, string | string[]> = {};
  if (!brutas || typeof brutas !== 'object') return respostas;
  const b = brutas as Record<string, unknown>;
  for (const pergunta of PERGUNTAS) {
    const valor = b[pergunta.key];
    const validas = new Set(pergunta.opcoes);
    if (pergunta.tipo === 'single') {
      if (typeof valor === 'string' && validas.has(valor)) respostas[pergunta.key] = valor;
    } else if (Array.isArray(valor)) {
      const arr = valor.filter((v) => typeof v === 'string' && validas.has(v));
      if (arr.length) respostas[pergunta.key] = arr;
    }
  }
  if (respostas.tem_internet !== 'sim') delete respostas.dificuldade;
  return respostas;
}

// Espelho de calcularPerfil em src/lib/simulador.js — pesos idênticos.
function calcularPerfil(brutas: unknown) {
  const r = normalizarRespostas(brutas);
  let pontuacao = 0;

  if (r.tem_internet === 'nao') pontuacao += 30;
  if (['lenta', 'oscilacao', 'velocidade'].includes(r.dificuldade as string)) pontuacao += 20;
  if (r.dificuldade === 'preco') pontuacao += 15;
  if (r.dificuldade === 'satisfeito') pontuacao -= 15;

  const usosAlta = ((r.usos as string[]) || []).filter((u) => USOS_ALTA_DEMANDA.includes(u));
  pontuacao += usosAlta.length * 8;

  if (r.moradores === '5_mais') pontuacao += 10;
  if (r.moradores === '2_4') pontuacao += 5;
  if (((r.equipamentos as string[]) || []).length >= 3) pontuacao += 5;

  pontuacao = Math.max(0, pontuacao);
  const temperatura = pontuacao >= 60 ? 'quente' : pontuacao >= 30 ? 'morno' : 'frio';

  const servicosInteresse = ['internet_residencial'];
  if (((r.usos as string[]) || []).includes('streaming')) servicosInteresse.push('streamings');

  return { pontuacao, temperatura, ofertaRecomendada: 'internet_residencial', servicosInteresse, respostas: r };
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
    // submeter-formulario) — não dá pista pro spammer.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return json({ ok: true }, 200, corsHeaders);
    }

    const simuladorId = sanitizeText(body.simuladorId, 80);
    if (!simuladorId) return json({ error: 'Campanha inválida.' }, 400, corsHeaders);
    if (body.consentimentoColetado !== true) {
      return json({ error: 'É necessário confirmar o consentimento para uso dos dados.' }, 400, corsHeaders);
    }

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const clientIp = getClientIp(req);
    if (await atingiuRateLimit(admin, clientIp)) {
      return json({ error: 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.' }, 429, corsHeaders);
    }

    const { data: simulador, error: simErro } = await admin
      .from('simuladores')
      .select('id,tipo,ativo')
      .eq('id', simuladorId)
      .maybeSingle();
    if (simErro || !simulador || !simulador.ativo) {
      return json({ error: 'Campanha não encontrada ou encerrada.' }, 404, corsHeaders);
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

    // D-073: tipo 'territorial' — questionário reduzido (cidade/bairro/
    // interesse), sem quiz nem scoring; alimenta o relatório interno de
    // demanda por região (demanda_por_regiao). cidade/bairro viram
    // obrigatórios porque SÃO o dado da campanha.
    const territorial = simulador.tipo === 'territorial';
    let perfilConsumo: unknown = null;
    let pontuacao: number | null = null;
    let ofertaRecomendada: string | null = null;
    let servicosInteresse: string[];
    let temperatura: string;

    if (territorial) {
      if (!cidade || !bairro) {
        return json({ error: 'Informe cidade e bairro.' }, 400, corsHeaders);
      }
      servicosInteresse = Array.isArray(body.servicoInteresse)
        ? body.servicoInteresse.filter((s: unknown) => typeof s === 'string' && SERVICOS_VALIDOS.has(s))
        : [];
      if (servicosInteresse.length === 0) {
        return json({ error: 'Selecione ao menos um interesse.' }, 400, corsHeaders);
      }
      temperatura = 'morno'; // interesse declarado espontaneamente, sem score
    } else {
      // D-074: perfilKey escolhido pela pessoa decide o pacote (fixo, nunca
      // calculado); o combo (adicionais + upgrade) é sempre recalculado
      // aqui — cliente manda só a chave do perfil e os booleans marcados.
      const perfilKey = sanitizeText(body.perfil, 40);
      if (!PERFIS_SIMULADOR[perfilKey]) {
        return json({ error: 'Selecione um perfil de uso.' }, 400, corsHeaders);
      }
      const comboBruto = (body.combo && typeof body.combo === 'object') ? body.combo : {};
      const combo = montarCombo(perfilKey, {
        yellow: comboBruto.yellow === true,
        black: comboBruto.black === true,
        upgrade: comboBruto.upgrade === true,
      });

      // Score SEMPRE recalculado aqui — body.respostas é a única entrada.
      const perfil = calcularPerfil(body.respostas);
      perfilConsumo = { versao: PERGUNTAS_SIMULADOR_VERSAO, respostas: perfil.respostas, perfil: perfilKey, combo };
      pontuacao = perfil.pontuacao;
      ofertaRecomendada = perfil.ofertaRecomendada;
      servicosInteresse = perfil.servicosInteresse;
      temperatura = perfil.temperatura;
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
