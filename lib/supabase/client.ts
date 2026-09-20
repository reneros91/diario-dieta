"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/db";

/** Client do navegador: só a anon key, nunca a service role. */
export function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // O middleware já desvia para /configurar antes disso; a mensagem clara é
  // para quem chegar aqui por outro caminho.
  if (!url || !chave) {
    throw new Error("Supabase não configurado: veja /configurar ou o COMECE-AQUI.md");
  }

  return createBrowserClient<Database>(url, chave);
}
