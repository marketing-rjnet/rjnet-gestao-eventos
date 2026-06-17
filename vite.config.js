import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// PA-01/LGPD: Impede build de produção com credenciais legadas no bundle público.
// VITE_MARKETING_PASS é modo dev/demo apenas — nunca deve existir em produção (Vercel/CI).
function lgpdCredentialGuard() {
  return {
    name: 'lgpd-credential-guard',
    buildStart() {
      const isProduction = process.env.NODE_ENV === 'production';
      const hasLegacyPass = Boolean(process.env.VITE_MARKETING_PASS);
      if (isProduction && hasLegacyPass) {
        throw new Error(
          '\n[PA-01/LGPD] ❌ BUILD ABORTADO — RISCO CRÍTICO DE SEGURANÇA\n' +
          'VITE_MARKETING_PASS está definida em um build de produção.\n' +
          'Isso incorpora a senha em texto claro no bundle JavaScript público.\n\n' +
          'Solução: remova VITE_MARKETING_PASS das variáveis de ambiente de produção\n' +
          'e configure VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY para usar Supabase Auth.\n'
        );
      }
      if (!isProduction && hasLegacyPass) {
        console.warn(
          '[PA-01/LGPD] ⚠️  VITE_MARKETING_PASS definida — modo legado ATIVO.\n' +
          '   Use APENAS em desenvolvimento local. NUNCA defina esta variável em Vercel ou CI.'
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), lgpdCredentialGuard()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
