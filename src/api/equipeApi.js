import { auth } from '../lib/dataService';
import { sanitizeText } from '../lib/security';

const toSlug = (nome) =>
  nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, ".").replace(/[^a-z0-9.]/g, "");

export function createEquipeApi({ recarregar }) {
  return {
    criarUsuario: async ({ nome, email, senha, papel }) => {
      const nomeSanitizado = sanitizeText(nome, 80);
      const emailFinal = email.trim() || `${toSlug(nomeSanitizado)}@vendedor.rjnet.com.br`;
      await auth.criarUsuario({ nome: nomeSanitizado, email: emailFinal, senha, papel });
      await recarregar();
    },
    atualizarPerfil: async (userId, patch) => {
      const campos = {
        ...patch,
        ...(patch.nome !== undefined ? { nome: sanitizeText(patch.nome, 80) } : {}),
      };
      await auth.atualizarPerfil(userId, campos);
      await recarregar();
    },
    excluirUsuario: async (userId) => {
      await auth.excluirUsuario(userId);
      await recarregar();
    },
  };
}
