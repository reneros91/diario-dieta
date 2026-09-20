import { NextResponse } from "next/server";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { usuarioAtual, supabaseServer } from "@/lib/supabase/server";
import {
  ERROS,
  MODELO,
  anthropic,
  chamadasHoje,
  hashEntrada,
  ipDaRequisicao,
  rateLimitIP,
  registrarChamada,
  respostaCacheada,
} from "@/lib/ai/anthropic";
import { REGRAS_RECEITA } from "@/lib/ai/prompt";
import { TOOL_RECEITA, zReceitaIA } from "@/lib/ai/schema";
import { normItensReceita } from "@/lib/ai/normalize";
import { por100 } from "@/lib/calc";

export const runtime = "nodejs";
export const maxDuration = 60;

const zBody = z.object({
  nome: z.string().trim().min(1).max(120),
  ingredientes: z.string().trim().min(3).max(3000),
  porcoes: z.number().positive().max(100),
  peso_pronto: z.number().positive().max(100000).nullable().optional(),
});

/** Item pronto para a tela de conferência e para `salvarReceita`. */
export type ItemReceitaCalculado = {
  nome: string;
  qtd_pronto: number;
  unidade: "g";
  k100: number;
  p100: number;
  c100: number;
  g100: number;
};

const erro = (e: { code: string; message: string; status: number }) =>
  NextResponse.json({ code: e.code, message: e.message }, { status: e.status });

export async function POST(request: Request) {
  const user = await usuarioAtual();
  if (!user) return erro(ERROS.semSessao);
  if (!process.env.ANTHROPIC_API_KEY) return erro(ERROS.semChave);
  if (!rateLimitIP(ipDaRequisicao(request))) return erro(ERROS.muitasChamadas);

  const corpo = zBody.safeParse(await request.json().catch(() => null));
  if (!corpo.success) return erro(ERROS.entradaInvalida);
  const { nome, ingredientes, porcoes, peso_pronto } = corpo.data;

  const sb = await supabaseServer();
  const { data: perfil } = await sb
    .from("profiles")
    .select("ai_diario_limite")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!perfil) return erro(ERROS.semSessao);

  const usadas = await chamadasHoje(user.id);
  if (usadas >= perfil.ai_diario_limite) return erro(ERROS.limiteDiario);

  const hash = hashEntrada(["receita", nome, ingredientes, porcoes, peso_pronto ?? null]);
  const cacheado = await respostaCacheada<{ itens: ItemReceitaCalculado[]; resposta: string }>(
    user.id,
    hash,
    "receita",
  );
  if (cacheado) return NextResponse.json({ ...cacheado, doCache: true });

  const pedido = [
    `RECEITA: ${nome}`,
    `RENDE: ${porcoes} porções`,
    peso_pronto ? `PESO TOTAL PRONTO: ${peso_pronto} g` : "PESO TOTAL PRONTO: não informado",
    "INGREDIENTES CRUS (um por linha):",
    ingredientes,
  ].join("\n");

  const inicio = Date.now();
  let msg: Anthropic.Message;

  try {
    msg = await anthropic().messages.create({
      model: MODELO,
      max_tokens: 2000,
      thinking: { type: "disabled" },
      system: [{ type: "text", text: REGRAS_RECEITA, cache_control: { type: "ephemeral" } }],
      tools: [TOOL_RECEITA],
      tool_choice: { type: "tool", name: "receita" },
      messages: [{ role: "user", content: pedido }],
    });
  } catch {
    return erro(ERROS.modelo);
  }

  const ms = Date.now() - inicio;
  const bloco = msg.content.find((b) => b.type === "tool_use");
  if (!bloco || bloco.type !== "tool_use") return erro(ERROS.modelo);

  const bruto = bloco.input as Record<string, unknown>;
  const parsed = zReceitaIA.safeParse({
    resposta: typeof bruto.resposta === "string" ? bruto.resposta : "",
    peso_pronto_total:
      typeof bruto.peso_pronto_total === "number" ? bruto.peso_pronto_total : null,
    itens: normItensReceita(bruto.itens),
  });
  if (!parsed.success) return erro(ERROS.modelo);

  // A IA devolve totais do ingrediente; guardamos por 100 g do pronto.
  const itens: ItemReceitaCalculado[] = parsed.data.itens.map((it) => ({
    nome: it.nome,
    qtd_pronto: Math.round(it.peso_pronto),
    unidade: "g" as const,
    ...por100(it.peso_pronto, {
      kcal: it.kcal,
      prot: it.prot,
      carb: it.carb,
      gord: it.gord,
    }),
  }));

  const resposta = {
    resposta: parsed.data.resposta,
    itens,
    peso_pronto_total:
      peso_pronto ??
      parsed.data.peso_pronto_total ??
      itens.reduce((s, i) => s + i.qtd_pronto, 0),
  };

  await registrarChamada({
    userId: user.id,
    tipo: "receita",
    modelo: MODELO,
    uso: msg.usage,
    imagens: 0,
    ms,
    hash,
    resposta,
  });

  return NextResponse.json(resposta);
}
