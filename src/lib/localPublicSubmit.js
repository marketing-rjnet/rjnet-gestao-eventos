// Modo local (sem Supabase) para as páginas públicas (QR Code, Form
// Builder): grava o lead direto no mesmo localStorage que o AppProvider já
// usa (rjnet_leads), sem precisar de Edge Function nem backend nenhum.
//
// Isso existe só para permitir testar o fluxo completo em preview/dev sem
// projeto Supabase configurado — é o mesmo espírito do "modo legado" que já
// existe no resto do app (RootLegacy/Login), nunca usado em produção real
// (produção sempre tem Supabase configurado e passa pela Edge Function,
// que valida no servidor). Sem sessão, sem RLS — só serve pra demonstração.
const LEADS_KEY = 'rjnet_leads';

export function salvarLeadPublicoLocal(dados) {
  let atuais = [];
  try { atuais = JSON.parse(localStorage.getItem(LEADS_KEY)) || []; } catch { /* ignora storage corrompido */ }

  const novo = {
    id: `l-pub-${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
    criadoEm: new Date().toISOString(),
    eventoId: null,
    mesReferencia: null,
    vendedorNome: "",
    vendedorId: null,
    cpf: "",
    endereco: "",
    bairro: "",
    observacao: "",
    temperatura: "morno",
    jaClienteRjnet: false,
    consentimentoColetado: true,
    consentimentoEm: new Date().toISOString(),
    versaoTermo: "publico-v1",
    ...dados,
  };

  localStorage.setItem(LEADS_KEY, JSON.stringify([...atuais, novo]));
  return novo;
}

// D-084: bloqueio de duplicidade por NÚMERO de WhatsApp dentro da MESMA
// campanha — mesmo espelhado no servidor (submeter-simulador, fase
// 'cadastro'). Nunca por navegador/aparelho: uma família com um único
// celular pode cadastrar várias pessoas (números diferentes) sem
// restrição; só o MESMO número não pode se cadastrar 2 vezes.
export function leadSimuladorQuizDuplicado(simuladorId, telefone) {
  try {
    const atuais = JSON.parse(localStorage.getItem(LEADS_KEY)) || [];
    return atuais.some((l) => l.simuladorId === simuladorId && l.telefone === telefone && !l.deletado);
  } catch {
    return false;
  }
}

// D-083: fallback local (sem Supabase) do cadastro em DUAS fases do Quiz de
// Acertos — mesmo espírito de salvarLeadPublicoLocal acima, só que em duas
// escritas: o cadastro grava o lead na hora (contato/consentimento, sem
// resultado ainda) e a conclusão faz um "update" nele depois, pra que o
// modo local também exercite o mesmo fluxo real de produção (Edge Function
// submeter-simulador, fases 'cadastro'/'conclusao').
export function criarLeadSimuladorQuizLocal(dados) {
  let atuais = [];
  try { atuais = JSON.parse(localStorage.getItem(LEADS_KEY)) || []; } catch { /* ignora storage corrompido */ }

  const novo = {
    id: `l-sim-${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
    criadoEm: new Date().toISOString(),
    eventoId: null,
    mesReferencia: null,
    vendedorNome: "",
    vendedorId: null,
    origem: 'simulador',
    perfilConsumo: null,
    pontuacao: null,
    ofertaRecomendada: null,
    servicoInteresse: ['outro'],
    temperatura: 'morno',
    cpf: "",
    endereco: "",
    observacao: "",
    jaClienteRjnet: false,
    consentimentoColetado: true,
    consentimentoEm: new Date().toISOString(),
    versaoTermo: 'simulador-v1',
    ...dados,
  };

  localStorage.setItem(LEADS_KEY, JSON.stringify([...atuais, novo]));
  return novo;
}

// Update guardado por `pontuacao == null` — mesmo princípio de "1 chance
// só" da guarda atômica no servidor (WHERE pontuacao is null); aqui não há
// corrida de concorrência real (mesma aba), mas mantém os dois caminhos
// consistentes.
export function concluirLeadSimuladorQuizLocal(leadId, patch) {
  let atuais = [];
  try { atuais = JSON.parse(localStorage.getItem(LEADS_KEY)) || []; } catch { return; }
  const atualizados = atuais.map((l) => (l.id === leadId && l.pontuacao == null ? { ...l, ...patch } : l));
  localStorage.setItem(LEADS_KEY, JSON.stringify(atualizados));
}
