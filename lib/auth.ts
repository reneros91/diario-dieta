/**
 * Regras e mensagens de autenticação por e-mail e senha.
 *
 * O Supabase responde em inglês e com texto voltado a quem programa. Aqui isso
 * vira frase curta em português, sem culpar a pessoa e sem jargão.
 */

export const SENHA_MINIMA = 8;

export type ProblemaSenha = "curta" | "diferente" | null;

export function validarSenha(senha: string, confirmacao: string): ProblemaSenha {
  if (senha.length < SENHA_MINIMA) return "curta";
  if (senha !== confirmacao) return "diferente";
  return null;
}

export const TEXTO_PROBLEMA: Record<Exclude<ProblemaSenha, null>, string> = {
  curta: `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`,
  diferente: "As duas senhas não são iguais.",
};

/** Traduz o erro do Supabase para algo que dê para agir. */
export function mensagemErro(erro: { message?: string; code?: string } | null): string {
  const bruto = (erro?.message ?? "").toLowerCase();
  const code = erro?.code ?? "";

  if (code === "invalid_credentials" || bruto.includes("invalid login credentials")) {
    return "E-mail ou senha não conferem.";
  }
  if (code === "user_already_exists" || bruto.includes("already registered")) {
    return "Esse e-mail já tem conta. Entre em vez de cadastrar.";
  }
  if (code === "weak_password" || bruto.includes("password should be at least")) {
    return `Senha fraca demais. Use pelo menos ${SENHA_MINIMA} caracteres.`;
  }
  if (code === "email_not_confirmed" || bruto.includes("email not confirmed")) {
    return "Esta conta ainda pede confirmação por e-mail. Desligue a confirmação no painel do Supabase.";
  }
  if (code === "over_request_rate_limit" || bruto.includes("rate limit")) {
    return "Muitas tentativas seguidas. Espere um minuto.";
  }
  if (code === "validation_failed" || bruto.includes("unable to validate email")) {
    return "Esse e-mail não parece válido.";
  }
  if (bruto.includes("fetch") || bruto.includes("network")) {
    return "Sem conexão com o servidor.";
  }

  return "Não deu certo. Tente de novo.";
}
