import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/db";

/**
 * Service role: ignora RLS. Só para o que não tem sessão de usuário —
 * hoje, a ingestão do Atalho do iOS (autenticada por token) e o log de custo.
 * Nunca importar isto de um componente de cliente.
 */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");

  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
