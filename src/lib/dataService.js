// Ponto de entrada mantido para compatibilidade — reexporta os módulos separados.
// Camada de dados: db.js | Autenticação: auth.js | Mapeadores: mappers.js
export { fetchAll, rankingEvento, db, subscribeChanges } from './db';
export { auth } from './auth';
