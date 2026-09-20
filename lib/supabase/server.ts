import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/db";

/**
 * Client de servidor (Server Components, Server Actions, Route Handlers).
 * A sessão vem do cookie, então a RLS já filtra tudo por auth.uid().
 */
export async function supabaseServer() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !chave) {
    throw new Error("Supabase não configurado: veja /configurar ou o COMECE-AQUI.md");
  }

  return createServerClient<Database>(url, chave, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component não pode escrever cookie; o middleware renova a sessão.
        }
      },
    },
  });
}

/** Usuário da sessão, ou null. */
export async function usuarioAtual() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user;
}
