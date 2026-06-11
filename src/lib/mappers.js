/* Conversão entre o formato do app (camelCase) e as colunas do banco (snake_case) */

export const materialFromDb = (r) => ({
  id: r.id, nome: r.nome, quantidade: r.quantidade, descricao: r.descricao ?? undefined,
});
export const materialToDb = (m) => ({
  id: m.id, nome: m.nome, quantidade: m.quantidade, descricao: m.descricao ?? null,
});

export const vendedorFromDb = (r) => ({ id: r.id, nome: r.nome, ativo: r.ativo });
export const vendedorToDb = (v) => ({ id: v.id, nome: v.nome, ativo: v.ativo });

export const eventoFromDb = (r) => ({
  id: r.id, nome: r.nome, local: r.local ?? "",
  dataInicio: r.data_inicio, dataFim: r.data_fim,
  status: r.status, tipo: r.tipo,
  observacoes: r.observacoes ?? undefined,
  materiais: r.materiais ?? [],
  criadoEm: r.criado_em,
});
export const eventoToDb = (e) => ({
  id: e.id, nome: e.nome, local: e.local ?? null,
  data_inicio: e.dataInicio || null, data_fim: e.dataFim || null,
  status: e.status, tipo: e.tipo ?? null,
  observacoes: e.observacoes ?? null,
  materiais: e.materiais ?? [],
  criado_em: e.criadoEm || new Date().toISOString(),
});

export const leadFromDb = (r) => ({
  id: r.id, eventoId: r.evento_id, vendedorNome: r.vendedor_nome ?? "",
  vendedorId: r.vendedor_id ?? null,
  nome: r.nome, telefone: r.telefone ?? "", cpf: r.cpf ?? "",
  endereco: r.endereco ?? "", servicoInteresse: r.servico_interesse,
  temperatura: r.temperatura, observacao: r.observacao ?? "",
  jaClienteRjnet: r.ja_cliente_rjnet ?? false,
  criadoEm: r.criado_em,
});
export const leadToDb = (l) => ({
  id: l.id, evento_id: l.eventoId, vendedor_nome: l.vendedorNome ?? null,
  vendedor_id: l.vendedorId ?? null,
  nome: l.nome, telefone: l.telefone || null, cpf: l.cpf || null,
  endereco: l.endereco || null, servico_interesse: l.servicoInteresse ?? null,
  temperatura: l.temperatura ?? 'morno', observacao: l.observacao || null,
  ja_cliente_rjnet: l.jaClienteRjnet ?? false,
  criado_em: l.criadoEm || new Date().toISOString(),
});

export const perfilFromDb = (r) => ({
  id: r.id, email: r.email ?? "", nome: r.nome,
  papel: r.papel, ativo: r.ativo,
});
