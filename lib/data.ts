import "server-only";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { alvos, hojeISO, somaDias, tendencia, type Alvos, type PerfilCalc } from "@/lib/calc";
import type {
  DayNoteRow,
  DayTotalRow,
  MealComItens,
  ProfileRow,
  WeighinRow,
  WorkoutRow,
} from "@/lib/types/db";

/** Perfil da pessoa logada. O trigger do banco cria um na primeira entrada. */
export async function getPerfil(): Promise<ProfileRow> {
  const sb = await supabaseServer();
  const user = await usuarioAtual();
  if (!user) throw new Error("sem sessão");

  const { data } = await sb.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (data) return data;

  // Rede de segurança: conta criada antes do trigger existir.
  const { data: criado, error } = await sb
    .from("profiles")
    .insert({ user_id: user.id, nome: user.email?.split("@")[0] ?? null })
    .select("*")
    .single();
  if (error) throw error;
  return criado;
}

export function perfilParaCalc(p: ProfileRow): PerfilCalc {
  return {
    sexo: p.sexo,
    idade: p.idade,
    altura_cm: Number(p.altura_cm),
    peso_kg: Number(p.peso_kg),
    gordura_pct: p.gordura_pct === null ? null : Number(p.gordura_pct),
    fator: Number(p.fator),
    kg_sem: Number(p.kg_sem),
    deficit_kcal: p.deficit_kcal === null ? null : Number(p.deficit_kcal),
    meta_manual: p.meta_manual === null ? null : Number(p.meta_manual),
    prot_gkg: Number(p.prot_gkg),
    gord_pct: Number(p.gord_pct),
  };
}

export async function getPerfilEAlvos(): Promise<{ perfil: ProfileRow; alvo: Alvos }> {
  const perfil = await getPerfil();
  return { perfil, alvo: alvos(perfilParaCalc(perfil)) };
}

export async function getTotaisDia(dia: string): Promise<DayTotalRow | null> {
  const sb = await supabaseServer();
  const { data } = await sb.from("day_totals").select("*").eq("dia", dia).maybeSingle();
  return data ?? null;
}

export async function getTotaisPeriodo(de: string, ate: string): Promise<DayTotalRow[]> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("day_totals")
    .select("*")
    .gte("dia", de)
    .lte("dia", ate)
    .order("dia");
  return data ?? [];
}

export async function getRefeicoes(dia: string): Promise<MealComItens[]> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("meals")
    .select("*, meal_items(*)")
    .eq("dia", dia)
    .order("created_at");
  const refeicoes = (data ?? []) as MealComItens[];
  for (const r of refeicoes) r.meal_items.sort((a, b) => a.ordem - b.ordem);
  return refeicoes;
}

export async function getTreinos(dia: string): Promise<WorkoutRow[]> {
  const sb = await supabaseServer();
  const { data } = await sb.from("workouts").select("*").eq("dia", dia).order("created_at");
  return data ?? [];
}

export async function getNotaDia(dia: string): Promise<DayNoteRow | null> {
  const sb = await supabaseServer();
  const { data } = await sb.from("day_notes").select("*").eq("dia", dia).maybeSingle();
  return data ?? null;
}

export async function getPesagens(limite = 120): Promise<WeighinRow[]> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("weighins")
    .select("*")
    .order("dia", { ascending: false })
    .limit(limite);
  return (data ?? []).slice().reverse();
}

export async function getUltimaPesagem(): Promise<WeighinRow | null> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("weighins")
    .select("*")
    .order("dia", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** Tendência dos últimos 28 dias, ou null quando ainda não dá para afirmar nada. */
export async function getTendencia(janelaDias = 28) {
  const pesagens = await getPesagens();
  return tendencia(
    pesagens.map((p) => ({ dia: p.dia, peso: Number(p.peso) })),
    janelaDias,
    hojeISO(),
  );
}

/** Contexto do topo fixo: consumido hoje vs alvo. */
export async function getTopoHoje() {
  const dia = hojeISO();
  const [{ perfil, alvo }, totais] = await Promise.all([getPerfilEAlvos(), getTotaisDia(dia)]);
  return {
    dia,
    perfil,
    alvo,
    consumido: totais ?? { user_id: perfil.user_id, dia, kcal: 0, prot: 0, carb: 0, gord: 0 },
  };
}

export const diaAnterior = (dia: string) => somaDias(dia, -1);
export const diaSeguinte = (dia: string) => somaDias(dia, 1);
