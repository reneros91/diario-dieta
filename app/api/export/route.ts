import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { hojeISO, macrosItem } from "@/lib/calc";

export const runtime = "nodejs";

/** Exportar todos os dados da conta em JSON ou CSV (LGPD, SPEC §9). */
export async function GET(request: NextRequest) {
  const user = await usuarioAtual();
  if (!user) {
    return NextResponse.json({ code: "sem_sessao", message: "Entre de novo." }, { status: 401 });
  }

  const formato = request.nextUrl.searchParams.get("formato") === "csv" ? "csv" : "json";
  const sb = await supabaseServer();

  const [perfil, refeicoes, treinos, notas, pesagens, receitas, alimentos, favoritos] =
    await Promise.all([
      sb.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
      sb.from("meals").select("*, meal_items(*)").order("dia"),
      sb.from("workouts").select("*").order("dia"),
      sb.from("day_notes").select("*").order("dia"),
      sb.from("weighins").select("*").order("dia"),
      sb.from("recipes").select("*, recipe_items(*)").eq("user_id", user.id).order("nome"),
      sb.from("foods").select("*").order("nome"),
      sb.from("favorites").select("*").order("nome"),
    ]);

  const carimbo = hojeISO();

  if (formato === "csv") {
    // Uma linha por ingrediente: é o formato que entra em planilha.
    const linhas: string[][] = [
      ["dia", "refeicao", "nome_refeicao", "hora", "item", "qtd", "unidade", "kcal", "prot", "carb", "gord"],
    ];

    for (const m of refeicoes.data ?? []) {
      for (const i of [...m.meal_items].sort((a, b) => a.ordem - b.ordem)) {
        const mac = macrosItem({
          qtd: Number(i.qtd),
          k100: Number(i.k100),
          p100: Number(i.p100),
          c100: Number(i.c100),
          g100: Number(i.g100),
        });
        linhas.push([
          m.dia,
          m.tipo,
          m.nome,
          m.hora ?? "",
          i.nome,
          String(Number(i.qtd)),
          i.unidade,
          mac.kcal.toFixed(0),
          mac.prot.toFixed(1),
          mac.carb.toFixed(1),
          mac.gord.toFixed(1),
        ]);
      }
    }

    const csv = linhas.map((l) => l.map(escapaCSV).join(",")).join("\r\n");

    return new NextResponse(`﻿${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="balanco-${carimbo}.csv"`,
      },
    });
  }

  const dados = {
    exportado_em: new Date().toISOString(),
    perfil: perfil.data,
    refeicoes: refeicoes.data,
    treinos: treinos.data,
    notas_do_dia: notas.data,
    pesagens: pesagens.data,
    receitas: receitas.data,
    alimentos: alimentos.data,
    favoritos: favoritos.data,
  };

  return new NextResponse(JSON.stringify(dados, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="balanco-${carimbo}.json"`,
    },
  });
}

function escapaCSV(valor: string): string {
  return /[",\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}
