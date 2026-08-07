export const MOCK_MATERIAIS = [
  { id: "m1", nome: "Wind Banner 2m", quantidade: 6, descricao: "Banner vertical 2 metros" },
  { id: "m2", nome: "Wind Banner 5m", quantidade: 4, descricao: "Banner vertical 5 metros" },
  { id: "m3", nome: "Tenda Inflável", quantidade: 2 },
  { id: "m4", nome: "Balão Inflável", quantidade: 3 },
  { id: "m5", nome: "Placa Hotspot", quantidade: 10 },
  { id: "m6", nome: "Rádio Wi-Fi", quantidade: 8 },
  { id: "m7", nome: "Banner Gradil", quantidade: 12 },
  { id: "m8", nome: "Banner Poste", quantidade: 15 },
  { id: "m9", nome: 'Banner "Como Acessar"', quantidade: 8 },
  { id: "m10", nome: 'Banner "Evento Conectado RJNET"', quantidade: 6 },
];

export const MOCK_VENDEDORES = [
  { id: "v1", nome: "Carlos Silva",   ativo: true },
  { id: "v2", nome: "Ana Oliveira",   ativo: true },
  { id: "v3", nome: "Marcos Lima",    ativo: true },
  { id: "v4", nome: "Juliana Costa",  ativo: true },
  { id: "v5", nome: "Thiago",         ativo: true },
  { id: "v6", nome: "Ramon",          ativo: true },
];

export const MOCK_EVENTOS = [
  {
    id: "e1", nome: "Festa do Pescador - Angra",
    local: "Praia do Anil, Angra dos Reis",
    dataInicio: "2025-06-07", dataFim: "2025-06-08",
    status: "ativo", tipo: "presenca_comercial",
    observacoes: "Evento com grande público esperado. Levar estrutura completa.",
    materiais: [
      { materialId: "m1", quantidade: 3, estadoSaida: "ok", retornado: false },
      { materialId: "m5", quantidade: 4, estadoSaida: "ok", retornado: false },
      { materialId: "m7", quantidade: 6, estadoSaida: "ok", retornado: false },
      { materialId: "m10", quantidade: 2, estadoSaida: "ok", retornado: false },
    ],
    criadoEm: "2025-05-28T10:00:00Z",
  },
  {
    id: "e2", nome: "Feira de Tecnologia RJ",
    local: "Centro de Convenções, Rio de Janeiro",
    dataInicio: "2025-06-14", dataFim: "2025-06-15",
    status: "planejado", tipo: "ativacao_especial",
    materiais: [], criadoEm: "2025-06-01T09:00:00Z",
  },
];

export const MOCK_LEADS = [
  {
    id: "l1", eventoId: "e1", vendedorNome: "Carlos Silva",
    nome: "João Pereira", telefone: "(24) 99876-5432",
    endereco: "Rua das Flores, 45 - Angra dos Reis",
    servicoInteresse: ["internet_residencial"],
    temperatura: "quente",
    observacao: "Muito interesse, mora em área com cobertura",
    criadoEm: "2025-06-07T14:30:00Z",
  },
];
