import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const zBody = z.object({
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  passos: z.number().int().min(0).max(200000).nullable().optional(),
  sono_h: z.number().min(0).max(24).nullable().optional(),
  treinos: z
    .array(
      z.object({
        nome: z.string().trim().min(1).max(80),
        minutos: z.number().min(0).max(1440).nullable().optional(),
        kcal: z.number().min(0).max(10000).nullable().optional(),
      }),
    )
    .max(20)
    .optional(),
});

/**
 * Ingestão do Atalho do iOS (SPEC §7).
 *
 * Autentica por `Authorization: Bearer <ingest_token>` — não tem cookie de
 * sessão, então usa service role e resolve o dono pelo token. As kcal do
 * relógio entram como informação: não abatem da meta.
 */
export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

  if (token.length < 16) {
    return NextResponse.json({ code: "sem_token", message: "Token ausente." }, { status: 401 });
  }

  const corpo = zBody.safeParse(await request.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json(
      { code: "entrada_invalida", message: "Corpo fora do formato." },
      { status: 400 },
    );
  }

  const admin = supabaseAdmin();
  const { data: perfil } = await admin
    .from("profiles")
    .select("user_id")
    .eq("ingest_token", token)
    .maybeSingle();

  if (!perfil) {
    return NextResponse.json({ code: "token_invalido", message: "Token não confere." }, { status: 401 });
  }

  const { dia, passos, sono_h, treinos } = corpo.data;

  // Só mexe no que o Atalho mandou: campo ausente não apaga o que já estava lá.
  if (passos !== undefined || sono_h !== undefined) {
    await admin.from("day_notes").upsert(
      {
        user_id: perfil.user_id,
        dia,
        ...(passos !== undefined ? { passos } : {}),
        ...(sono_h !== undefined ? { sono_h } : {}),
      },
      { onConflict: "user_id,dia" },
    );
  }

  let gravados = 0;
  if (treinos?.length) {
    // O Atalho pode rodar de novo no mesmo dia: troca o bloco do relógio inteiro
    // em vez de somar duplicata. Os treinos digitados à mão ficam onde estão.
    await admin
      .from("workouts")
      .delete()
      .eq("user_id", perfil.user_id)
      .eq("dia", dia)
      .eq("fonte", "watch");

    const { data } = await admin
      .from("workouts")
      .insert(
        treinos.map((t) => ({
          user_id: perfil.user_id,
          dia,
          nome: t.nome,
          minutos: t.minutos === null || t.minutos === undefined ? null : Math.round(t.minutos),
          kcal_estimadas: t.kcal === null || t.kcal === undefined ? null : Math.round(t.kcal),
          fonte: "watch" as const,
        })),
      )
      .select("id");

    gravados = data?.length ?? 0;
  }

  return NextResponse.json({ ok: true, dia, treinos: gravados });
}
