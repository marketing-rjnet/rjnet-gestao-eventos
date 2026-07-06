// Google Apps Script — encaminha respostas do Google Forms para a mesma
// Edge Function que já recebe o formulário público próprio do sistema
// (captar-lead-qrcode). Não faz parte do build do app — este arquivo só
// existe como referência para copiar/colar no editor de Apps Script do
// Google Forms.
//
// COMO INSTALAR
// 1. Crie o Google Form com as perguntas:
//      - Nome completo (resposta curta, obrigatória)
//      - Telefone (WhatsApp) (resposta curta, obrigatória)
//      - Serviço de interesse (caixas de seleção ou múltipla escolha,
//        obrigatória) — use os mesmos rótulos do MAPA_SERVICO abaixo
//      - Autorizo o uso dos meus dados para contato comercial (caixa de
//        seleção, obrigatória) — texto do consentimento LGPD
//      - Código de referência (resposta curta, NÃO obrigatória) — este é
//        o campo que recebe o qrCodeId pré-preenchido pela URL do QR.
//        O Google Forms não tem campo oculto de verdade: esta pergunta
//        fica visível, só que já vem preenchida quando a pessoa chega
//        pelo link do QR — avise no texto da pergunta que não precisa mexer.
// 2. Formulário → os 3 pontos (⋮) → "Obter link pré-preenchido" → responda
//    "Código de referência" com um valor de teste → "Obter link" → copie a
//    URL gerada. Nela, o parâmetro "entry.XXXXXXXXX=teste" identifica o
//    campo — use esse "entry.XXXXXXXXX" como GOOGLE_FORM_ENTRY_QRCODE em
//    src/features/qrcode/QrCodeGeradorTab.jsx. A URL sem o "?entry...=teste"
//    é o GOOGLE_FORM_BASE_URL.
// 3. No Google Forms: Extensões → Apps Script. Apague o conteúdo padrão e
//    cole este arquivo inteiro.
// 4. Preencha EDGE_FUNCTION_URL e SUPABASE_ANON_KEY abaixo (a anon key é
//    pública por design — a mesma usada no frontend do app).
// 5. Ajuste TITULOS se você usou textos diferentes para as perguntas.
// 6. Acionadores (ícone de relógio, barra lateral) → Adicionar acionador →
//    Função: aoReceberResposta | Evento: Ao enviar formulário → Salvar.
//    Na primeira vez o Google pede autorização — aceite (é o próprio script
//    pedindo permissão para ler as respostas do seu Form).
// 7. Envie uma resposta de teste e confira se o lead chegou na fila de
//    distribuição (aba Relatórios → "Leads via QR Code" no sistema).

const EDGE_FUNCTION_URL = ''; // ex: 'https://SEU-PROJETO.supabase.co/functions/v1/captar-lead-qrcode'
const SUPABASE_ANON_KEY = ''; // mesma anon key pública usada em VITE_SUPABASE_ANON_KEY

// Títulos exatamente como aparecem no Google Form — ajuste se renomear as perguntas.
const TITULOS = {
  nome: 'Nome completo',
  telefone: 'Telefone (WhatsApp)',
  servico: 'Serviço de interesse',
  consentimento: 'Autorizo o uso dos meus dados para contato comercial',
  qrCodeId: 'Código de referência',
};

// Rótulos exibidos no Form → chaves que o sistema espera (mesmas de
// SERVICO_LABEL em src/utils/format.js). Mantenha em sincronia se um
// serviço novo for adicionado dos dois lados.
const MAPA_SERVICO = {
  'Internet Residencial': 'internet_residencial',
  'Internet Empresarial': 'internet_empresarial',
  'RJNET Móvel': 'rjnet_movel',
  'Streamings': 'streamings',
  'Outro': 'outro',
};

function aoReceberResposta(e) {
  const respostas = {};
  e.response.getItemResponses().forEach((r) => {
    respostas[r.getItem().getTitle()] = r.getResponse();
  });

  const servicoResposta = respostas[TITULOS.servico];
  const servicoInteresse = (Array.isArray(servicoResposta) ? servicoResposta : [servicoResposta])
    .map((label) => MAPA_SERVICO[label])
    .filter(Boolean);

  const payload = {
    nome: respostas[TITULOS.nome] || '',
    telefone: respostas[TITULOS.telefone] || '',
    servicoInteresse,
    consentimentoColetado: Boolean(respostas[TITULOS.consentimento]),
    qrCodeId: respostas[TITULOS.qrCodeId] || '',
    qrCodeLabel: '',
  };

  const resposta = UrlFetchApp.fetch(EDGE_FUNCTION_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  // Aparece em Execuções (barra lateral do Apps Script) se algo falhar —
  // útil pra depurar sem precisar abrir o Supabase.
  if (resposta.getResponseCode() >= 400) {
    console.error('Falha ao enviar lead do Google Forms: ' + resposta.getContentText());
  }
}
