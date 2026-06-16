import { useState } from 'react';

export function usePersisted(key, fallback, { session = false } = {}) {
  const storage = session ? sessionStorage : localStorage;
  const [state, setState] = useState(() => {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  });
  const set = (v) => {
    setState((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      try {
        if (next === null || next === undefined) {
          storage.removeItem(key);
        } else {
          storage.setItem(key, JSON.stringify(next));
        }
      } catch (err) {
        console.error("[rjnet] Falha ao salvar dados localmente:", err);
        alert("⚠️ Não foi possível salvar os dados. O armazenamento local pode estar cheio. Contate o suporte.");
      }
      return next;
    });
  };
  return [state, set];
}
