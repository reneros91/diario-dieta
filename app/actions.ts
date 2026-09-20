"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { hojeISO, horaAgora } from "@/lib/calc";
import type { FavoritoItem, TipoRefeicao, Unidade } from "@/lib/types/db";

/* ------------------------------------------------------------------ */
/* Schemas                                                             */
/* ------------------------------------------------------------------ */

const zUnidade = z.enum(["g", "ml", "porcao"]);
const zTipo = z.enum(["cafe", "almoco", "lanche", "jantar", "ceia"]);
const zDia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dia inválido");

const zItem = z.object({
  nome: z.string().trim().min(1).max(120),
  qtd: z.number().positive().max(100000),
  unidade: zUnidade,
  k100: z.number().min(0).max(1000),
  p100: z.number().min(0).max(100),
  c100: z.number().min(0).max(100),
  g100: z.number().min(0).max(100),
});

export type ItemEntrada = z.infer<typeof zItem>;

const zRefeicao = z.object({
  dia: zDia,
  tipo: zTipo,
  nome: z.string().trim().min(1).max(120),
  hora: z.string().optional(),
  origem: z.enum(["ia", "taco", "receita", "alimento", "favorito", "manual"]).default("manual"),
  itens: z.array(zItem).min(1).max(40),
});

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string };

const falha = (erro: string): Resultado<never> => ({ ok: false, erro });

async function sessao() {
  const user = await usuarioAtual();
  if (!user) throw new Error("sem sessão");
  return { sb: await supabaseServer(), userId: user.id };
}

/** Telas que dependem de comida registrada. */
function revalidarDia() {
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ */
/* Refeições                                                           */
/* ------------------------------------------------------------------ */

export async function criarRefeicao(entrada: unknown): Promise<Resultado<{ id: string }>> {
  const parsed = zRefeicao.safeParse(entrada);
  if (!parsed.success) return falha("Dados da refeição inválidos.");
  const { dia, tipo, nome, hora, origem, itens } = parsed.data;

  const { sb, userId } = await sessao();

  const { data: meal, error } = await sb
    .from("meals")
    .insert({
      user_id: userId,
      dia,
      tipo,
      nome,
      hora: hora ?? horaAgora(),
      origem,
    })
    .select("id")
    .single();

  if (error || !meal) return falha("Não deu para salvar a refeição.");

  const { error: erroItens } = await sb.from("meal_items").insert(
    itens.map((it, i) => ({
      meal_id: meal.id,
      nome: it.nome,
      qtd: it.qtd,
      unidade: it.unidade,
      k100: it.k100,
      p100: it.p100,
      c100: it.c100,
      g100: it.g100,
      ordem: i,
    })),
  );

  if (erroItens) {
    // Sem itens o cartão não existe: desfaz para não deixar refeição vazia.
    await sb.from("meals").delete().eq("id", meal.id);
    return falha("Não deu para salvar os itens.");
  }

  revalidarDia();
  return { ok: true, dados: { id: meal.id } };
}

/** Editar a quantidade recalcula tudo no cliente; aqui só grava o número. */
export async function atualizarQtdItem(id: string, qtd: number): Promise<Resultado> {
  if (!Number.isFinite(qtd) || qtd <= 0) return falha("Quantidade inválida.");
  const { sb } = await sessao();
  const { error } = await sb.from("meal_items").update({ qtd }).eq("id", id);
  if (error) return falha("Não deu para atualizar a linha.");
  revalidarDia();
  return { ok: true, dados: undefined };
}

/** Apaga a linha e, se foi a última, o cartão inteiro (SPEC §3.3). */
export async function removerItem(id: string): Promise<Resultado<{ refeicaoApagada: boolean }>> {
  const { sb } = await sessao();

  const { data: item } = await sb.from("meal_items").select("meal_id").eq("id", id).maybeSingle();
  if (!item) return falha("Linha não encontrada.");

  const { error } = await sb.from("meal_items").delete().eq("id", id);
  if (error) return falha("Não deu para excluir a linha.");

  const { count } = await sb
    .from("meal_items")
    .select("id", { count: "exact", head: true })
    .eq("meal_id", item.meal_id);

  let refeicaoApagada = false;
  if (!count) {
    await sb.from("meals").delete().eq("id", item.meal_id);
    refeicaoApagada = true;
  }

  revalidarDia();
  return { ok: true, dados: { refeicaoApagada } };
}

export async function apagarRefeicao(id: string): Promise<Resultado> {
  const { sb } = await sessao();
  const { error } = await sb.from("meals").delete().eq("id", id);
  if (error) return falha("Não deu para apagar a refeição.");
  revalidarDia();
  return { ok: true, dados: undefined };
}

export async function mudarTipoRefeicao(id: string, tipo: TipoRefeicao): Promise<Resultado> {
  const { sb } = await sessao();
  const { error } = await sb.from("meals").update({ tipo }).eq("id", id);
  if (error) return falha("Não deu para mudar a refeição.");
  revalidarDia();
  return { ok: true, dados: undefined };
}

/** ★ guarda o cartão inteiro como favorito reutilizável. */
export async function favoritarRefeicao(id: string): Promise<Resultado<{ nome: string }>> {
  const { sb, userId } = await sessao();

  const { data: meal } = await sb
    .from("meals")
    .select("nome, meal_items(nome, qtd, unidade, k100, p100, c100, g100, ordem)")
    .eq("id", id)
    .maybeSingle();

  if (!meal) return falha("Refeição não encontrada.");

  const itens: FavoritoItem[] = [...meal.meal_items]
    .sort((a, b) => a.ordem - b.ordem)
    .map(({ nome, qtd, unidade, k100, p100, c100, g100 }) => ({
      nome,
      qtd: Number(qtd),
      unidade: unidade as Unidade,
      k100: Number(k100),
      p100: Number(p100),
      c100: Number(c100),
      g100: Number(g100),
    }));

  const { error } = await sb
    .from("favorites")
    .insert({ user_id: userId, nome: meal.nome, itens });

  if (error) return falha("Não deu para favoritar.");
  revalidatePath("/diario");
  return { ok: true, dados: { nome: meal.nome } };
}

export async function apagarFavorito(id: string): Promise<Resultado> {
  const { sb } = await sessao();
  const { error } = await sb.from("favorites").delete().eq("id", id);
  if (error) return falha("Não deu para apagar o favorito.");
  revalidarDia();
  return { ok: true, dados: undefined };
}

/* ------------------------------------------------------------------ */
/* Treinos e nota do dia                                               */
/* ------------------------------------------------------------------ */

const zTreino = z.object({
  dia: zDia,
  nome: z.string().trim().min(1).max(80),
  minutos: z.number().int().min(0).max(1440).nullable(),
  kcal_estimadas: z.number().int().min(0).max(10000).nullable(),
});

export async function salvarTreino(entrada: unknown): Promise<Resultado> {
  const parsed = zTreino.safeParse(entrada);
  if (!parsed.success) return falha("Dados do treino inválidos.");
  const { sb, userId } = await sessao();

  const { error } = await sb.from("workouts").insert({
    user_id: userId,
    ...parsed.data,
    fonte: "manual",
  });
  if (error) return falha("Não deu para salvar o treino.");
  revalidarDia();
  return { ok: true, dados: undefined };
}

export async function apagarTreino(id: string): Promise<Resultado> {
  const { sb } = await sessao();
  const { error } = await sb.from("workouts").delete().eq("id", id);
  if (error) return falha("Não deu para apagar o treino.");
  revalidarDia();
  return { ok: true, dados: undefined };
}

const zNota = z.object({
  dia: zDia,
  passos: z.number().int().min(0).max(200000).nullable(),
  sono_h: z.number().min(0).max(24).nullable(),
  atividade: z.enum(["sentado", "leve", "ativo"]).nullable(),
  obs: z.string().max(500).nullable(),
});

export async function salvarNotaDia(entrada: unknown): Promise<Resultado> {
  const parsed = zNota.safeParse(entrada);
  if (!parsed.success) return falha("Dados do dia inválidos.");
  const { sb, userId } = await sessao();

  const { error } = await sb
    .from("day_notes")
    .upsert({ user_id: userId, ...parsed.data }, { onConflict: "user_id,dia" });
  if (error) return falha("Não deu para salvar a nota do dia.");
  revalidarDia();
  return { ok: true, dados: undefined };
}

/* ------------------------------------------------------------------ */
/* Pesagens                                                            */
/* ------------------------------------------------------------------ */

const zPesagem = z.object({
  dia: zDia,
  peso: z.number().min(30).max(400),
  gordura_pct: z.number().min(2).max(70).nullable(),
  massa_muscular: z.number().min(10).max(200).nullable(),
  agua_pct: z.number().min(20).max(80).nullable(),
  visceral: z.number().min(0).max(60).nullable(),
  idade_metabolica: z.number().int().min(10).max(120).nullable(),
});

export async function salvarPesagem(entrada: unknown): Promise<Resultado> {
  const parsed = zPesagem.safeParse(entrada);
  if (!parsed.success) return falha("Dados da pesagem inválidos.");
  const { sb, userId } = await sessao();

  const { error } = await sb
    .from("weighins")
    .upsert({ user_id: userId, ...parsed.data, fonte: "manual" }, { onConflict: "user_id,dia" });
  if (error) return falha("Não deu para salvar a pesagem.");

  // A pesagem do dia é o peso atual do perfil: TMB e alvos seguem o corpo.
  const hoje = hojeISO();
  if (parsed.data.dia === hoje) {
    await sb
      .from("profiles")
      .update({
        peso_kg: parsed.data.peso,
        ...(parsed.data.gordura_pct !== null ? { gordura_pct: parsed.data.gordura_pct } : {}),
      })
      .eq("user_id", userId);
  }

  revalidarDia();
  return { ok: true, dados: undefined };
}

export async function apagarPesagem(id: string): Promise<Resultado> {
  const { sb } = await sessao();
  const { error } = await sb.from("weighins").delete().eq("id", id);
  if (error) return falha("Não deu para apagar a pesagem.");
  revalidarDia();
  return { ok: true, dados: undefined };
}

/* ------------------------------------------------------------------ */
/* Perfil                                                              */
/* ------------------------------------------------------------------ */

const zPerfil = z.object({
  nome: z.string().trim().max(60).nullable(),
  sexo: z.enum(["m", "f"]),
  idade: z.number().int().min(10).max(110),
  altura_cm: z.number().min(100).max(250),
  peso_kg: z.number().min(30).max(400),
  gordura_pct: z.number().min(2).max(70).nullable(),
  fator: z.union([
    z.literal(1.2),
    z.literal(1.375),
    z.literal(1.55),
    z.literal(1.725),
    z.literal(1.9),
  ]),
  kg_sem: z.number().min(-1).max(2),
  deficit_kcal: z.number().int().min(-1500).max(1500).nullable(),
  meta_manual: z.number().int().min(800).max(6000).nullable(),
  prot_gkg: z.number().min(0.5).max(4),
  gord_pct: z.number().int().min(10).max(60),
});

export async function salvarPerfil(entrada: unknown): Promise<Resultado> {
  const parsed = zPerfil.safeParse(entrada);
  if (!parsed.success) return falha("Confira os campos do perfil.");
  const { sb, userId } = await sessao();

  const { error } = await sb.from("profiles").update(parsed.data).eq("user_id", userId);
  if (error) return falha("Não deu para salvar o perfil.");
  revalidatePath("/", "layout");
  return { ok: true, dados: undefined };
}

/** Usa a meta sugerida pela tendência (botão "usar" em Corpo). */
export async function usarMetaSugerida(meta: number): Promise<Resultado> {
  if (!Number.isFinite(meta) || meta < 800 || meta > 6000) return falha("Meta fora da faixa.");
  const { sb, userId } = await sessao();
  const { error } = await sb
    .from("profiles")
    .update({ meta_manual: Math.round(meta) })
    .eq("user_id", userId);
  if (error) return falha("Não deu para aplicar a meta.");
  revalidatePath("/", "layout");
  return { ok: true, dados: undefined };
}

/** Gera um token novo para o Atalho do iOS e invalida o anterior. */
export async function girarTokenIngest(): Promise<Resultado<{ token: string }>> {
  const { sb, userId } = await sessao();
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().slice(0, 8);

  const { error } = await sb
    .from("profiles")
    .update({ ingest_token: token })
    .eq("user_id", userId);
  if (error) return falha("Não deu para gerar o token.");
  revalidatePath("/perfil");
  return { ok: true, dados: { token } };
}

/* ------------------------------------------------------------------ */
/* Alimentos, favoritos e receitas                                     */
/* ------------------------------------------------------------------ */

const zAlimento = z.object({
  nome: z.string().trim().min(1).max(120),
  unidade: zUnidade,
  porcao_rotulo: z.number().positive().max(10000).nullable(),
  k100: z.number().min(0).max(1000),
  p100: z.number().min(0).max(100),
  c100: z.number().min(0).max(100),
  g100: z.number().min(0).max(100),
});

export async function salvarAlimento(entrada: unknown): Promise<Resultado> {
  const parsed = zAlimento.safeParse(entrada);
  if (!parsed.success) return falha("Confira os campos do alimento.");
  const { sb, userId } = await sessao();
  const { error } = await sb.from("foods").insert({ user_id: userId, ...parsed.data });
  if (error) return falha("Não deu para salvar o alimento.");
  revalidatePath("/", "layout");
  return { ok: true, dados: undefined };
}

export async function apagarAlimento(id: string): Promise<Resultado> {
  const { sb } = await sessao();
  const { error } = await sb.from("foods").delete().eq("id", id);
  if (error) return falha("Não deu para apagar o alimento.");
  revalidatePath("/", "layout");
  return { ok: true, dados: undefined };
}

const zReceita = z.object({
  nome: z.string().trim().min(1).max(120),
  porcoes: z.number().positive().max(100),
  peso_pronto_g: z.number().positive().max(100000).nullable(),
  obs: z.string().max(500).nullable(),
  publica: z.boolean(),
  itens: z
    .array(
      z.object({
        nome: z.string().trim().min(1).max(120),
        qtd_pronto: z.number().positive().max(100000),
        unidade: zUnidade,
        k100: z.number().min(0).max(1000),
        p100: z.number().min(0).max(100),
        c100: z.number().min(0).max(100),
        g100: z.number().min(0).max(100),
      }),
    )
    .min(1)
    .max(40),
});

export async function salvarReceita(entrada: unknown): Promise<Resultado<{ id: string }>> {
  const parsed = zReceita.safeParse(entrada);
  if (!parsed.success) return falha("Confira os campos da receita.");
  const { itens, ...receita } = parsed.data;
  const { sb, userId } = await sessao();

  const { data, error } = await sb
    .from("recipes")
    .insert({ user_id: userId, ...receita })
    .select("id")
    .single();
  if (error || !data) return falha("Não deu para salvar a receita.");

  const { error: erroItens } = await sb
    .from("recipe_items")
    .insert(itens.map((it, i) => ({ recipe_id: data.id, ...it, ordem: i })));
  if (erroItens) {
    await sb.from("recipes").delete().eq("id", data.id);
    return falha("Não deu para salvar os ingredientes.");
  }

  revalidatePath("/", "layout");
  return { ok: true, dados: { id: data.id } };
}

export async function apagarReceita(id: string): Promise<Resultado> {
  const { sb } = await sessao();
  const { error } = await sb.from("recipes").delete().eq("id", id);
  if (error) return falha("Não deu para apagar a receita.");
  revalidatePath("/", "layout");
  return { ok: true, dados: undefined };
}

export async function alternarReceitaPublica(id: string, publica: boolean): Promise<Resultado> {
  const { sb } = await sessao();
  const { error } = await sb.from("recipes").update({ publica }).eq("id", id);
  if (error) return falha("Não deu para mudar a visibilidade.");
  revalidatePath("/", "layout");
  return { ok: true, dados: undefined };
}

/**
 * Adiciona uma receita ao dia. `porcoes` aceita 1,5; quando a receita tem peso
 * pronto, `gramas` manda e converte para fração de porção.
 */
export async function adicionarReceitaAoDia(args: {
  receitaId: string;
  dia: string;
  tipo: TipoRefeicao;
  porcoes?: number;
  gramas?: number;
}): Promise<Resultado<{ id: string }>> {
  const { sb } = await sessao();

  const { data: receita } = await sb
    .from("recipes")
    .select("*, recipe_items(*)")
    .eq("id", args.receitaId)
    .maybeSingle();

  if (!receita) return falha("Receita não encontrada.");

  const porcoesTotais = Number(receita.porcoes) || 1;
  let fracao: number;

  if (args.gramas && receita.peso_pronto_g) {
    fracao = args.gramas / Number(receita.peso_pronto_g);
  } else {
    fracao = (args.porcoes ?? 1) / porcoesTotais;
  }

  if (!Number.isFinite(fracao) || fracao <= 0) return falha("Quantidade inválida.");

  const itens = [...receita.recipe_items]
    .sort((a, b) => a.ordem - b.ordem)
    .map((it) => ({
      nome: it.nome,
      qtd: Number((Number(it.qtd_pronto) * fracao).toFixed(2)),
      unidade: it.unidade as Unidade,
      k100: Number(it.k100),
      p100: Number(it.p100),
      c100: Number(it.c100),
      g100: Number(it.g100),
    }))
    .filter((it) => it.qtd > 0);

  if (!itens.length) return falha("Receita sem ingredientes.");

  return criarRefeicao({
    dia: args.dia,
    tipo: args.tipo,
    nome: receita.nome,
    origem: "receita",
    itens,
  });
}

export async function adicionarFavoritoAoDia(args: {
  favoritoId: string;
  dia: string;
  tipo: TipoRefeicao;
}): Promise<Resultado<{ id: string }>> {
  const { sb } = await sessao();
  const { data: fav } = await sb
    .from("favorites")
    .select("*")
    .eq("id", args.favoritoId)
    .maybeSingle();
  if (!fav) return falha("Favorito não encontrado.");

  return criarRefeicao({
    dia: args.dia,
    tipo: args.tipo,
    nome: fav.nome,
    origem: "favorito",
    itens: fav.itens,
  });
}

/* ------------------------------------------------------------------ */
/* Conta                                                               */
/* ------------------------------------------------------------------ */

/** Apaga tudo da conta (LGPD, SPEC §9). Sem volta. */
export async function apagarConta(): Promise<Resultado> {
  const { sb, userId } = await sessao();

  // O cascade de auth.users só roda com service role; aqui limpamos as tabelas
  // do app com a própria sessão (a RLS garante que é só o que é dela).
  const tabelas = [
    "meals",
    "workouts",
    "day_notes",
    "weighins",
    "recipes",
    "foods",
    "favorites",
    "messages",
  ] as const;

  for (const t of tabelas) {
    const { error } = await sb.from(t).delete().eq("user_id", userId);
    if (error) return falha(`Não deu para apagar ${t}.`);
  }

  await sb.from("profiles").delete().eq("user_id", userId);
  await sb.auth.signOut();

  revalidatePath("/", "layout");
  return { ok: true, dados: undefined };
}
