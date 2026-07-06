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
