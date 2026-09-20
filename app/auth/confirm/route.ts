import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Quem clica no link do e-mail (em vez de digitar o código) cai aqui. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const destino = searchParams.get("next") ?? "/";

  if (!token_hash || !type) {
    return NextResponse.redirect(`${origin}/login?erro=link`);
  }

  const sb = await supabaseServer();
  const { error } = await sb.auth.verifyOtp({ type, token_hash });

  if (error) return NextResponse.redirect(`${origin}/login?erro=link`);
  return NextResponse.redirect(`${origin}${destino}`);
}
