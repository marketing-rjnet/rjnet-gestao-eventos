// Cache TTL em memória — evita refetches desnecessários para dados de curta
// duração (ex: placar do evento). Descartado ao recarregar a página.

const store = new Map();

export const cache = {
  get(key) {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) { store.delete(key); return undefined; }
    return entry.value;
  },

  set(key, value, ttlMs = 30_000) {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
  },

  invalidate(key) {
    store.delete(key);
  },

  // Remove todas as entradas cujo prefixo bate
  invalidatePrefix(prefix) {
    for (const k of store.keys()) {
      if (k.startsWith(prefix)) store.delete(k);
    }
  },

  invalidateAll() {
    store.clear();
  },
};
