import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types/db";
import { supabaseConfigurado } from "@/lib/env";

/** Rotas que funcionam deslogado. */
const PUBLICAS = ["/login", "/auth", "/api/ingest", "/manifest.webmanifest", "/sw.js"];

/** Renova a sessão a cada navegação e manda quem não tem sessão para /login. */
export async function atualizarSessao(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Sem Supabase não há sessão para renovar: manda todo mundo para a tela que
  // explica o que falta, em vez de estourar erro de chave ausente.
  if (!supabaseConfigurado()) {
    if (pathname === "/configurar") return NextResponse.next({ request });
    const url = request.nextUrl.clone();
    url.pathname = "/configurar";
    url.search = "";
    return NextResponse.rewrite(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const publica = PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Configurado e logado, a tela de configuração não tem mais motivo de existir.
  if (pathname === "/configurar") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!user && !publica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("de", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
