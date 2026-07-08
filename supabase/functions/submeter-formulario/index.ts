// Edge Function: submeter-formulario
// Porta pública de Captação para o Form Builder: recebe a resposta que o
// próprio titular preenche na página pública (sem sessão), busca a
// configuração do formulário (catálogo fixo de campos, nunca schema
// arbitrário — ver supabase/migracao-form-builder.sql), valida com o
// mesmo catálogo de validadores usado no restante do sistema, exige
// consentimento LGPD, e grava o Lead com service_role. vendedor_id nasce
// nulo — Distribuição é feita depois, manualmente, por marketing/comercial.
//
// CORS restrito via secret CORS_ALLOWED_ORIGINS (Dashboard → Edge Functions
// → Secrets). Sanitização/validadores/rate limit compartilhados com as
// demais portas públicas em _shared/captacao.ts.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getCorsHeaders, json, sanitizeText, validarTelefone, containsLink,
  getClientIp, atingiuRateLimit,
} from '../_shared/captacao.ts';

const SERVICOS_VALIDOS = new Set([
  'internet_residencial',
  'internet_empresarial',
  'rjnet_movel',
  'streamings',
  'outro',
]);

// Catálogo fixo — espelha CAMPOS_FORMULARIO em src/lib/constants.js.
// Só decide QUAL validador rodar por campo; nunca aceita um `tipo` novo
// vindo do cliente (o `tipo` sempre vem da config gravada em `formularios`,
// que só marketing/comercial autenticados podem escrever).
const TIPO_POR_CAMPO: Record<string, string> = {
  nome: 'texto',
  telefone: 'telefone',
  endereco: 'texto',
  bairro: 'texto',
  cpf: 'cpf',
  servicoInteresse: 'servico',
};

const TAMANHO_MAX: Record<string, number> = {
  nome: 120, endereco: 200, bairro: 80, cpf: 14,
};

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, corsHeaders);

  try {
    const body = await req.json();

    // Honeypot: campo que só um robô preenche (invisível na UI real).
    // Aceita silenciosamente sem gravar nada — não dá pista pro spammer.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return json({ ok: true }, 200, corsHeaders);
    }

    const formularioId = sanitizeText(body.formularioId, 80);
    if (!formularioId) return json({ error: 'Formulário inválido.' }, 400, corsHeaders);
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

    const { data: formulario, error: formErro } = await admin
      .from('formularios')
      .select('id,campos,campos_obrigatorios,campos_personalizados_ids,campos_personalizados_obrigatorios,ativo')
      .eq('id', formularioId)
      .maybeSingle();
    if (formErro || !formulario || !formulario.ativo) {
      return json({ error: 'Formulário não encontrado ou inativo.' }, 404, corsHeaders);
    }

    const valoresBrutos = body.valores || {};
    const campos: string[] = formulario.campos || [];
    const obrigatorios: string[] = formulario.campos_obrigatorios || [];
    const valores: Record<string, unknown> = {};

    for (const campo of campos) {
      const tipo = TIPO_POR_CAMPO[campo];
      if (!tipo) continue; // campo desconhecido no catálogo — ignora silenciosamente
      const bruto = valoresBrutos[campo];
      const obrigatorio = obrigatorios.includes(campo);

      if (tipo === 'servico') {
        const arr = Array.isArray(bruto) ? bruto.filter((s) => typeof s === 'string' && SERVICOS_VALIDOS.has(s)) : [];
        if (obrigatorio && arr.length === 0) {
          return json({ error: 'Selecione ao menos um serviço de interesse.' }, 400, corsHeaders);
        }
        valores.servicoInteresse = arr;
        continue;
      }

      if (tipo === 'telefone') {
        const tel = typeof bruto === 'string' ? bruto.trim() : '';
        if (obrigatorio && !validarTelefone(tel)) {
          return json({ error: 'Telefone inválido. Informe DDD + número (10 ou 11 dígitos).' }, 400, corsHeaders);
        }
        valores.telefone = tel;
        continue;
      }

      // texto / cpf
      const texto = sanitizeText(bruto, TAMANHO_MAX[campo] ?? 255);
      if (obrigatorio && !texto) {
        return json({ error: `Campo obrigatório ausente: ${campo}.` }, 400, corsHeaders);
      }
      if (tipo === 'texto' && texto && containsLink(texto)) {
        return json({ error: `Campo "${campo}" não pode conter link.` }, 400, corsHeaders);
      }
      valores[campo] = texto;
    }

    if (!valores.nome) return json({ error: 'Nome é obrigatório.' }, 400, corsHeaders);

    // Campos personalizados: sempre texto livre, definidos pela própria
    // equipe (marketing/comercial) — nunca um tipo/validação novo. A
    // resposta é gravada num espaço à parte (campos_extras), fora das
    // colunas fixas do Lead.
    const idsPersonalizados: string[] = formulario.campos_personalizados_ids || [];
    const obrigatoriosPersonalizados: string[] = formulario.campos_personalizados_obrigatorios || [];
    const valoresPersonalizadosBrutos = body.valoresPersonalizados || {};
    const camposExtras: Record<string, string> = {};

    if (idsPersonalizados.length > 0) {
      const { data: definicoes } = await admin
        .from('campos_personalizados')
        .select('id,label,key,ativo')
        .in('id', idsPersonalizados);

      for (const def of definicoes || []) {
        if (!def.ativo) continue;
        const bruto = valoresPersonalizadosBrutos[def.id];
        const texto = sanitizeText(bruto, 255);
        if (obrigatoriosPersonalizados.includes(def.id) && !texto) {
          return json({ error: `Preencha o campo "${def.label}".` }, 400, corsHeaders);
        }
        if (texto && containsLink(texto)) {
          return json({ error: `Campo "${def.label}" não pode conter link.` }, 400, corsHeaders);
        }
        if (texto) camposExtras[def.key] = texto;
      }
    }

    const agora = new Date().toISOString();
    const { error } = await admin.from('leads').insert({
      id: `l-form-${crypto.randomUUID()}`,
      evento_id: null,
      mes_referencia: null,
      vendedor_id: null,
      vendedor_nome: null,
      origem: 'formulario',
      origem_ip: clientIp,
      formulario_id: formularioId,
      nome: valores.nome as string,
      telefone: (valores.telefone as string) || null,
      cpf: (valores.cpf as string) || null,
      endereco: (valores.endereco as string) || null,
      bairro: (valores.bairro as string) || null,
      campos_extras: camposExtras,
      servico_interesse: JSON.stringify(valores.servicoInteresse || []),
      temperatura: 'morno',
      observacao: null,
      ja_cliente_rjnet: false,
      criado_em: agora,
      consentimento_coletado: true,
      consentimento_em: agora,
      versao_termo: 'formulario-v1',
      deletado: false,
    });

    if (error) {
      console.error('[rjnet:edge] Falha ao gravar lead de formulário:', error);
      return json({ error: 'Não foi possível registrar seus dados agora. Tente novamente em instantes.' }, 500, corsHeaders);
    }

    return json({ ok: true }, 200, corsHeaders);
  } catch (err) {
    console.error('[rjnet:edge] Erro não tratado em submeter-formulario:', err);
    return json({ error: 'Erro interno do servidor. Tente novamente em instantes.' }, 500, getCorsHeaders(req));
  }
});
