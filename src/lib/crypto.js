// PA-05/LGPD: Criptografia da fila offline no localStorage (S-02)
// Usa Web Crypto API nativa do browser — sem dependências externas.
//
// Estratégia:
//   - Chave derivada do userId via PBKDF2 (salt fixo por app + userId como material)
//   - Algoritmo: AES-GCM 256 bits (autenticado — detecta adulteração)
//   - A chave NÃO é persistida: existe apenas em memória durante a sessão
//   - Logout → chave descartada → fila inacessível até próximo login do mesmo usuário
//
// Limitação aceita: a chave é derivada deterministicamente do userId (sem senha),
// portanto não protege contra quem conhece o userId. A proteção é contra acesso
// físico ao dispositivo por terceiro sem conhecimento do userId.

const ALGO = 'AES-GCM';
const KEY_LENGTH = 256;
const ITERATIONS = 100_000;
const SALT = new TextEncoder().encode('rjnet-lgpd-queue-v1'); // salt público fixo por versão

// Cache da chave em memória — descartado ao recarregar a página ou fazer logout
const keyCache = new Map();

async function deriveKey(userId) {
  if (keyCache.has(userId)) return keyCache.get(userId);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(userId),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGO, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );

  keyCache.set(userId, key);
  return key;
}

// Criptografa um objeto JavaScript para string base64 (IV + ciphertext).
export async function encryptQueue(data, userId) {
  const key = await deriveKey(userId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const cipher = await crypto.subtle.encrypt({ name: ALGO, iv }, key, encoded);

  // Persiste como: base64(iv) + '.' + base64(ciphertext)
  const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  return toB64(iv) + '.' + toB64(cipher);
}

// Descriptografa string base64 de volta para objeto JavaScript.
// Retorna null se a chave não bater (usuário diferente ou dados corrompidos).
export async function decryptQueue(encrypted, userId) {
  try {
    const [ivB64, cipherB64] = encrypted.split('.');
    if (!ivB64 || !cipherB64) return null;

    const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    const iv = fromB64(ivB64);
    const cipher = fromB64(cipherB64);

    const key = await deriveKey(userId);
    const plain = await crypto.subtle.decrypt({ name: ALGO, iv }, key, cipher);
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    // Chave errada, dados corrompidos ou formato legado — retorna null (fila ignorada)
    return null;
  }
}

// Descarta a chave em memória ao fazer logout (dados da fila ficam inacessíveis).
export function clearCryptoKey(userId) {
  keyCache.delete(userId);
}

// Verifica se o ambiente suporta Web Crypto API (todos os browsers modernos suportam).
export const cryptoSupported = typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
