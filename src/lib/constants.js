// Constantes globais — centralize aqui para evitar magic numbers espalhados.

// Negócio — metas em 3 níveis
export const META_BRONZE = 20;
export const META_PRATA  = 40;
export const META_OURO   = 60;
export const META_DIARIA = META_OURO;

// Validação
export const SENHA_MIN_LENGTH = 8;
export const MAX_NOME = 120;
export const MAX_ENDERECO = 200;
export const MAX_OBSERVACAO = 500;
export const MAX_LOCAL = 150;
export const MAX_DESCRICAO = 255;

// Tempo
// QW-005: aumentado de 400ms para 1500ms para reduzir fetchAll consecutivos
// durante bursts de inserção. Tradeoff: dashboard atualiza com até 1.5s de atraso.
export const REALTIME_DEBOUNCE_MS = 1500;
export const TOAST_DURATION_MS = 5000;
export const RANKING_DEBOUNCE_MS = 3000;
export const RANKING_POLL_MS = 60_000;

// Enums de domínio
export const SYNC_STATUS = { IDLE: 'idle', SYNCING: 'syncing', ERROR: 'error' };
export const STATUS_EVENTO = { PLANEJADO: 'planejado', ATIVO: 'ativo', ENCERRADO: 'encerrado' };
export const NIVEL_ESTOQUE = { CRIT: 'crit', WARN: 'warn', OK: 'ok' };

// Limites de UI
export const UPCOMING_EVENTS_LIMIT = 3;
export const AVATARS_SHOWN = 4;
export const RECENT_EVENTS_SHOWN = 5;
export const CHART_CUTOUT = '62%';

// Form Builder: catálogo FIXO de campos que um formulário pode escolher —
// nunca um tipo de campo novo em runtime. `key` bate com o campo do Lead
// (leadFromDb/leadToDb em dataService.js); `tipo` decide o input/validador
// usado tanto no formulário público quanto na Edge Function.
export const CAMPOS_FORMULARIO = [
  { key: 'nome', label: 'Nome completo', tipo: 'texto' },
  { key: 'telefone', label: 'Telefone (WhatsApp)', tipo: 'telefone' },
  { key: 'endereco', label: 'Endereço', tipo: 'texto' },
  { key: 'bairro', label: 'Bairro', tipo: 'texto' },
  { key: 'cpf', label: 'CPF', tipo: 'cpf' },
  { key: 'servicoInteresse', label: 'Serviço de interesse', tipo: 'servico' },
];
