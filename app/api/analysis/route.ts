import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
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
import { REGRAS_ANALISE } from "@/lib/ai/prompt";
import {
  alvos,
  hojeISO,
  resumoPeriodo,
  somaDias,
  tendencia,
  variacaoPrevistaKg,
} from "@/lib/calc";
import { perfilParaCalc } from "@/lib/data";

export const runtime = "nodejs";
export const maxDuration = 60;

const DIAS = 14;

const erro = (e: { code: string; message: string; status: number }) =>
  NextResponse.json({ code: e.code, message: e.message }, { status: e.status });

/** Parecer dos últimos 14 dias (SPEC §6). */
export async function POST(request: Request) {
  const user = await usuarioAtual();
  if (!user) return erro(ERROS.semSessao);
  if (!process.env.ANTHROPIC_API_KEY) return erro(ERROS.semChave);
  if (!rateLimitIP(ipDaRequisicao(request))) return erro(ERROS.muitasChamadas);

  const sb = await supabaseServer();
  const ate = hojeISO();
  const de = somaDias(ate, -(DIAS - 1));

  const { data: perfilRow } = await sb
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!perfilRow) return erro(ERROS.semSessao);

  const usadas = await chamadasHoje(user.id);
  if (usadas >= perfilRow.ai_diario_limite) return erro(ERROS.limiteDiario);

  const [totais, pesagens, treinos] = await Promise.all([
    sb.from("day_totals").select("*").gte("dia", de).lte("dia", ate).order("dia"),
    sb.from("weighins").select("*").gte("dia", somaDias(ate, -35)).order("dia"),
    sb.from("workouts").select("dia").gte("dia", de).lte("dia", ate),
  ]);

  const perfil = perfilParaCalc(perfilRow);
  const alvo = alvos(perfil);
  const dias = (totais.data ?? []).map((d) => ({
    dia: d.dia,
    kcal: Number(d.kcal),
    prot: Number(d.prot),
    carb: Number(d.carb),
    gord: Number(d.gord),
  }));

  const resumo = resumoPeriodo(dias, alvo.meta, perfil.peso_kg);
  const serie = (pesagens.data ?? []).map((p) => ({ dia: p.dia, peso: Number(p.peso) }));
  const t = tendencia(serie, 28, ate);

  const noPeriodo = serie.filter((p) => p.dia >= de);
  const variacaoReal =
    noPeriodo.length >= 2 ? noPeriodo[noPeriodo.length - 1].peso - noPeriodo[0].peso : null;

  const hash = hashEntrada(["analise", de, ate, resumo, variacaoReal, t?.kgSemana ?? null]);
  const cacheado = await respostaCacheada<{ texto: string }>(user.id, hash, "analise");
  if (cacheado) return NextResponse.json({ ...cacheado, doCache: true });

  if (resumo.diasComRegistro < 3) {
    return NextResponse.json({
      texto: "Menos de 3 dias com registro nos últimos 14. Registre mais alguns dias antes.",
      semDados: true,
    });
  }

  const pedido = [
    `PERÍODO: ${de} a ${ate} (${DIAS} dias).`,
    `PESSOA: ${perfilRow.sexo === "m" ? "homem" : "mulher"}, ${perfilRow.idade} anos, ${perfil.peso_kg} kg.`,
    `META: ${alvo.meta} kcal/dia (GET ${alvo.get}, TMB ${alvo.tmb}). Alvo de proteína ${alvo.prot} g.`,
    `DIAS COM REGISTRO: ${resumo.diasComRegistro} de ${DIAS}.`,
    `MÉDIA: ${resumo.kcalMedia} kcal/dia, ${resumo.prot} g P (${resumo.protGkg} g/kg), ${resumo.carb} g C, ${resumo.gord} g G.`,
    `DÉFICIT ACUMULADO: ${resumo.deficitAcumulado} kcal (${resumo.gorduraEquivalenteKg} kg de gordura em teoria).`,
    `PREVISTO PELO DÉFICIT: ${variacaoPrevistaKg(resumo.deficitAcumulado)} kg.`,
    variacaoReal === null
      ? "VARIAÇÃO REAL NA BALANÇA: menos de 2 pesagens no período."
      : `VARIAÇÃO REAL NA BALANÇA: ${variacaoReal.toFixed(2)} kg.`,
    t ? `TENDÊNCIA (regressão 28 dias): ${t.kgSemana.toFixed(2)} kg/semana.` : "TENDÊNCIA: sem dados.",
    `TREINOS REGISTRADOS: ${treinos.data?.length ?? 0}.`,
  ].join("\n");

  const inicio = Date.now();
  let msg: Anthropic.Message;

  try {
    msg = await anthropic().messages.create({
      model: MODELO,
      max_tokens: 600,
      thinking: { type: "disabled" },
      system: [{ type: "text", text: REGRAS_ANALISE, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: pedido }],
    });
  } catch {
    return erro(ERROS.modelo);
  }

  const texto = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join(" ")
    .trim();

  if (!texto) return erro(ERROS.modelo);

  await registrarChamada({
    userId: user.id,
    tipo: "analise",
    modelo: MODELO,
    uso: msg.usage,
    imagens: 0,
    ms: Date.now() - inicio,
    hash,
    resposta: { texto },
  });

  return NextResponse.json({ texto });
}
