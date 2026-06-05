// =============================================================
// CONFIGURAÇÃO SUPABASE — ative quando tiver os dados reais
// =============================================================
// 1. Instale: npm install @supabase/supabase-js
// 2. Descomente o bloco abaixo e preencha as variáveis
// 3. Substitua as funções em data/dataService.js
// =============================================================

// import { createClient } from '@supabase/supabase-js'
//
// const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co'
// const SUPABASE_ANON_KEY = 'sua-chave-anonima-aqui'
//
// export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
//
// // Exemplos de queries prontas para usar:
// //
// // Listar colaboradores:
// // const { data } = await supabase.from('colaboradores').select('*')
// //
// // Listar materiais do estoque:
// // const { data } = await supabase.from('estoque').select('*')
// //
// // Listar eventos:
// // const { data } = await supabase.from('eventos').select('*, materiais(*), leads(*)')
// //
// // Adicionar lead:
// // const { data } = await supabase.from('leads').insert({ nome, servico, evento_id, vendedor_id })
// //
// // Atualizar quantidade no estoque:
// // const { data } = await supabase.from('estoque').update({ quantidade_disponivel: X }).eq('id', id)
