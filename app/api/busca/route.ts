import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";

export type ResultadoBusca = {
  id: string;
  nome: string;
  fonte: "taco" | "alimento";
  unidade: "g" | "ml" | "porcao";
  /** Porção padrão sugerida na tela de quantidade. */
  porcao: number;
  k100: number;
  p100: number;
  c100: number;
  g100: number;
};

/** Busca por similaridade na TACO e em "meus alimentos" (SPEC §3.8). */
export async function GET(request: NextRequest) {
  const user = await usuarioAtual();
  if (!user) {
    return NextResponse.json({ code: "sem_sessao", message: "Entre de novo." }, { status: 401 });
  }

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ resultados: [] });

  const sb = await supabaseServer();
  const padrao = `%${q}%`;

  const [taco, alimentos] = await Promise.all([
    sb.from("taco").select("*").ilike("nome", padrao).order("nome").limit(30),
    sb.from("foods").select("*").ilike("nome", padrao).order("nome").limit(20),
  ]);

  const resultados: ResultadoBusca[] = [
    ...(alimentos.data ?? []).map((f) => ({
      id: `alimento:${f.id}`,
      nome: f.nome,
      fonte: "alimento" as const,
      unidade: f.unidade,
      porcao: f.porcao_rotulo ? Number(f.porcao_rotulo) : 100,
      k100: Number(f.k100),
      p100: Number(f.p100),
      c100: Number(f.c100),
      g100: Number(f.g100),
    })),
    ...(taco.data ?? []).map((t) => ({
      id: `taco:${t.id}`,
      nome: t.nome,
      fonte: "taco" as const,
      unidade: t.unidade,
      porcao: 100,
      k100: Number(t.kcal),
      p100: Number(t.prot),
      c100: Number(t.carb),
      g100: Number(t.gord),
    })),
  ];

  return NextResponse.json({ resultados });
}
