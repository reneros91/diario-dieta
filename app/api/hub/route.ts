import { NextResponse } from "next/server";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { somaMacros } from "@/lib/calc";

/** Listas do hub ＋: receitas (minhas e da casa), alimentos e favoritos. */
export async function GET() {
  const user = await usuarioAtual();
  if (!user) {
    return NextResponse.json({ code: "sem_sessao", message: "Entre de novo." }, { status: 401 });
  }

  const sb = await supabaseServer();

  const [receitas, alimentos, favoritos] = await Promise.all([
    sb.from("recipes").select("*, recipe_items(*)").order("nome"),
    sb.from("foods").select("*").order("nome"),
    sb.from("favorites").select("*").order("nome"),
  ]);

  return NextResponse.json({
    receitas: (receitas.data ?? []).map((r) => {
      const total = somaMacros(
        r.recipe_items.map((i) => ({
          qtd: Number(i.qtd_pronto),
          k100: Number(i.k100),
          p100: Number(i.p100),
          c100: Number(i.c100),
          g100: Number(i.g100),
        })),
      );
      const porcoes = Number(r.porcoes) || 1;
      return {
        id: r.id,
        nome: r.nome,
        porcoes,
        peso_pronto_g: r.peso_pronto_g ? Number(r.peso_pronto_g) : null,
        publica: r.publica,
        minha: r.user_id === user.id,
        porPorcao: {
          kcal: Math.round(total.kcal / porcoes),
          prot: Math.round(total.prot / porcoes),
          carb: Math.round(total.carb / porcoes),
          gord: Math.round(total.gord / porcoes),
        },
      };
    }),
    alimentos: (alimentos.data ?? []).map((f) => ({
      id: f.id,
      nome: f.nome,
      unidade: f.unidade,
      porcao: f.porcao_rotulo ? Number(f.porcao_rotulo) : 100,
      k100: Number(f.k100),
      p100: Number(f.p100),
      c100: Number(f.c100),
      g100: Number(f.g100),
    })),
    favoritos: (favoritos.data ?? []).map((f) => {
      const total = somaMacros(f.itens.map((i) => ({ ...i, qtd: Number(i.qtd) })));
      return {
        id: f.id,
        nome: f.nome,
        linhas: f.itens.length,
        kcal: Math.round(total.kcal),
      };
    }),
  });
}
