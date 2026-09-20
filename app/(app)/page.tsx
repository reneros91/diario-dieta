import { Conversa } from "@/components/Conversa";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PaginaConversa() {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  return <Conversa historico={(data ?? []).slice().reverse()} />;
}
