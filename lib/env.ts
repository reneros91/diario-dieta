/**
 * Quais peças do ambiente já estão configuradas.
 *
 * O app nasce antes das contas existirem: sem Supabase não há login nem banco,
 * e sem a chave da Anthropic não há IA. Em vez de estourar um erro técnico na
 * cara de quem abriu, cada tela pergunta aqui e explica o que falta.
 */

export function supabaseConfigurado(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && chave && url.startsWith("http"));
}

/** Só faz sentido no servidor: a chave da IA nunca chega ao navegador. */
export function iaConfigurada(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function faltaNoAmbiente(): string[] {
  const falta: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) falta.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) falta.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) falta.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!process.env.ANTHROPIC_API_KEY) falta.push("ANTHROPIC_API_KEY");
  return falta;
}
