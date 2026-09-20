import { NextResponse } from "next/server";
import { z } from "zod";
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
import { REGRAS, contextoChat } from "@/lib/ai/prompt";
import { TOOL_REGISTRAR, zRegistro, type Acao } from "@/lib/ai/schema";
import { normAcoes } from "@/lib/ai/normalize";
import {
  conciliarComTaco,
  indexarTaco,
  listaParaPrompt,
  palavrasDeBusca,
  type LinhaTaco,
} from "@/lib/ai/taco";
import { alvos, hojeISO, horaAgora, por100, tendencia } from "@/lib/calc";
import { perfilParaCalc } from "@/lib/data";
import { colunaAusente, semColuna } from "@/lib/supabase/compat";
import { TIPO_LABEL } from "@/lib/format";
import type { MealComItens } from "@/lib/types/db";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_IMAGENS = 4;
const MAX_BYTES_IMAGEM = 4 * 1024 * 1024;
/** Cada busca é cobrada à parte: teto por mensagem. */
const MAX_BUSCAS = 4;

/** Quantas buscas o servidor executou — entra no painel de custo. */
function contarBuscas(msg: Anthropic.Message): number {
  const uso = msg.usage as { server_tool_use?: { web_search_requests?: number } };
  return uso.server_tool_use?.web_search_requests ?? 0;
}

const zBody = z.object({
  texto: z.string().trim().max(2000),
  imagens: z.array(z.string()).max(MAX_IMAGENS).optional(),
});

export type Card =
  | { tipo: "refeicao"; refeicao: MealComItens }
  | { tipo: "treino"; nome: string; min: number | null; kcal: number | null }
  | { tipo: "peso"; peso: number; gordura: number | null; massa_muscular: number | null }
  | { tipo: "dia"; passos: number | null; sono: number | null; atividade: string | null }
  | { tipo: "alimento"; nome: string; porcao: number; kcal: number };

const erro = (e: { code: string; message: string; status: number }) =>
  NextResponse.json({ code: e.code, message: e.message }, { status: e.status });

/** Tira o prefixo de data URL e devolve o tipo da imagem. */
function preparaImagem(bruta: string): { media_type: string; data: string } | null {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.*)$/s.exec(bruta);
  const data = m ? m[2] : bruta;
  const media_type = m ? m[1] : "image/jpeg";
  if (!data || data.length * 0.75 > MAX_BYTES_IMAGEM) return null;
  return { media_type, data };
}

export async function POST(request: Request) {
  const user = await usuarioAtual();
  if (!user) return erro(ERROS.semSessao);
  if (!process.env.ANTHROPIC_API_KEY) return erro(ERROS.semChave);
  if (!rateLimitIP(ipDaRequisicao(request))) return erro(ERROS.muitasChamadas);

  const corpo = zBody.safeParse(await request.json().catch(() => null));
  if (!corpo.success) return erro(ERROS.entradaInvalida);

  const texto = corpo.data.texto;
  const imagensBrutas = corpo.data.imagens ?? [];
  if (!texto && imagensBrutas.length === 0) return erro(ERROS.entradaInvalida);

  const imagens = imagensBrutas.map(preparaImagem);
  if (imagens.some((i) => i === null)) {
    return erro({
      code: "imagem_grande",
      message: "Foto acima de 4 MB. Tire de novo com menos resolução.",
      status: 413,
    });
  }

  const sb = await supabaseServer();
  const dia = hojeISO();
  const hora = Number(horaAgora().slice(0, 2));

  /* 1. Limite diário ------------------------------------------------ */
  const { data: perfilRow } = await sb
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!perfilRow) return erro(ERROS.semSessao);

  const usadas = await chamadasHoje(user.id);
  if (usadas >= perfilRow.ai_diario_limite) return erro(ERROS.limiteDiario);

  /* 2. Cache de 5 min ----------------------------------------------- */
  const hash = hashEntrada([texto, imagens.map((i) => i!.data.slice(0, 256)), dia]);
  const cacheado = await respostaCacheada<{ resposta: string }>(user.id, hash, "chat");
  if (cacheado && imagensBrutas.length === 0) {
    return NextResponse.json({ resposta: cacheado.resposta, cards: [], doCache: true });
  }

  /* 3. Contexto ------------------------------------------------------ */
  const perfil = perfilParaCalc(perfilRow);
  const alvo = alvos(perfil);

  // Alimentos reais que combinam com o texto: sem isso a IA inventa de memória.
  const palavras = palavrasDeBusca(texto);
  const { data: candidatos } = palavras.length
    ? await sb
        .from("taco")
        .select("nome, kcal, prot, carb, gord, unidade")
        .or(palavras.map((p) => `nome.ilike.%${p}%`).join(","))
        .limit(40)
    : { data: [] as LinhaTaco[] };

  const tabela = indexarTaco((candidatos ?? []) as LinhaTaco[]);

  const [totais, refeicoesHoje, treinosHoje, pesagens, historico] = await Promise.all([
    sb.from("day_totals").select("*").eq("dia", dia).maybeSingle(),
    sb.from("meals").select("tipo, nome, meal_items(qtd, k100)").eq("dia", dia),
    sb.from("workouts").select("nome, minutos").eq("dia", dia),
    sb.from("weighins").select("dia, peso, gordura_pct").order("dia", { ascending: false }).limit(30),
    sb
      .from("messages")
      .select("role, texto")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const consumido = totais.data ?? { kcal: 0, prot: 0, carb: 0, gord: 0 };

  const t = tendencia(
    (pesagens.data ?? []).map((p) => ({ dia: p.dia, peso: Number(p.peso) })),
    28,
    dia,
  );

  const ultima = pesagens.data?.[0];

  const contexto = contextoChat({
    nome: perfilRow.nome,
    sexo: perfilRow.sexo,
    idade: perfilRow.idade,
    peso: Number(perfilRow.peso_kg),
    altura: Number(perfilRow.altura_cm),
    gordura: perfilRow.gordura_pct === null ? null : Number(perfilRow.gordura_pct),
    tmb: alvo.tmb,
    formulaTmb: alvo.formulaTmb === "katch" ? "Katch-McArdle" : "Mifflin-St Jeor",
    get: alvo.get,
    meta: alvo.meta,
    alvoProt: alvo.prot,
    alvoCarb: alvo.carb,
    alvoGord: alvo.gord,
    consumido,
    refeicoesHoje: (refeicoesHoje.data ?? []).map((r) => {
      const k = r.meal_items.reduce((s, i) => s + (Number(i.qtd) * Number(i.k100)) / 100, 0);
      return `${TIPO_LABEL[r.tipo]} ${r.nome} ${Math.round(k)} kcal`;
    }),
    treinosHoje: (treinosHoje.data ?? []).map((w) => `${w.nome} ${w.minutos ?? "?"} min`),
    ultimaPesagem: ultima
      ? `${ultima.dia}: ${Number(ultima.peso)} kg${
          ultima.gordura_pct ? `, ${Number(ultima.gordura_pct)}% de gordura` : ""
        }`
      : null,
    tendencia: t ? `${t.kgSemana.toFixed(2)} kg/semana nas últimas ${t.janelaDias} dias` : null,
    dataHora: `${dia} ${horaAgora()}`,
    alimentos: listaParaPrompt((candidatos ?? []) as LinhaTaco[]),
  });

  /* 4. Chamada ------------------------------------------------------- */
  const anteriores = (historico.data ?? [])
    .slice()
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.texto || "(sem texto)" }));

  const conteudo: Anthropic.ContentBlockParam[] = [
    ...imagens.map(
      (i): Anthropic.ContentBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: i!.media_type as "image/jpeg", data: i!.data },
      }),
    ),
    { type: "text", text: texto || "Registre o que está na foto." },
  ];

  const inicio = Date.now();

  // Busca na web: é o que permite consultar industrializado que não está na
  // tabela. Com ela, a tool NÃO pode ser forçada — forçar faz o modelo chamar
  // "registrar" na primeira fala, sem chance de pesquisar antes.
  const ferramentasComBusca = [
    TOOL_REGISTRAR,
    { type: "web_search_20260209", name: "web_search", max_uses: MAX_BUSCAS },
  ];

  const mensagens: Anthropic.MessageParam[] = [
    ...anteriores,
    { role: "user", content: conteudo },
  ];

  const base = {
    model: MODELO,
    system: [
      { type: "text" as const, text: REGRAS, cache_control: { type: "ephemeral" as const } },
      { type: "text" as const, text: contexto },
    ],
    thinking: { type: "disabled" as const },
  };

  let msg: Anthropic.Message;
  let buscas = 0;

  try {
    msg = await anthropic().messages.create({
      ...base,
      max_tokens: 2400,
      tools: ferramentasComBusca as Anthropic.ToolUnion[],
      tool_choice: { type: "auto" },
      messages: mensagens,
    });

    // O servidor pausa turnos longos de busca; retomar é empurrar de volta.
    let voltas = 0;
    while (msg.stop_reason === "pause_turn" && voltas < 3) {
      mensagens.push({ role: "assistant", content: msg.content });
      msg = await anthropic().messages.create({
        ...base,
        max_tokens: 2400,
        tools: ferramentasComBusca as Anthropic.ToolUnion[],
        tool_choice: { type: "auto" },
        messages: mensagens,
      });
      voltas += 1;
    }

    buscas = contarBuscas(msg);

    // Sem busca disponível o modelo pode terminar sem registrar nada: aí vale
    // a via antiga, com a ferramenta forçada.
    if (!msg.content.some((b) => b.type === "tool_use" && b.name === "registrar")) {
      mensagens.push({ role: "assistant", content: msg.content });
      mensagens.push({
        role: "user",
        content: "Registre agora com a ferramenta, usando o que você já apurou.",
      });
      msg = await anthropic().messages.create({
        ...base,
        max_tokens: 1600,
        tools: [TOOL_REGISTRAR],
        tool_choice: { type: "tool", name: "registrar" },
        messages: mensagens,
      });
    }
  } catch {
    // Modelo sem suporte a busca, ou busca indisponível: cai na via direta.
    try {
      msg = await anthropic().messages.create({
        ...base,
        max_tokens: 1600,
        tools: [TOOL_REGISTRAR],
        tool_choice: { type: "tool", name: "registrar" },
        messages: [...anteriores, { role: "user", content: conteudo }],
      });
    } catch {
      return erro(ERROS.modelo);
    }
  }

  const ms = Date.now() - inicio;
  const bloco = msg.content.find((b) => b.type === "tool_use");
  if (!bloco || bloco.type !== "tool_use") return erro(ERROS.modelo);

  const bruto = bloco.input as Record<string, unknown>;
  const parsed = zRegistro.safeParse({
    resposta: typeof bruto.resposta === "string" ? bruto.resposta : "",
    acoes: normAcoes(bruto.acoes, hora),
  });

  if (!parsed.success) return erro(ERROS.modelo);
  const { resposta, acoes } = parsed.data;

  /* 5. Persistência --------------------------------------------------- */
  const cards: Card[] = [];
  const problemas: string[] = [];

  for (const acao of acoes) {
    const card = await aplicar(acao, {
      sb,
      userId: user.id,
      dia,
      hora: horaAgora(),
      problemas,
      tabela,
    });
    if (card) cards.push(card);
  }

  // A IA entendeu e não veio nenhuma ação: registrar nada calado seria pior.
  if (acoes.length === 0 && texto.length > 0) {
    problemas.push("A IA respondeu mas não devolveu nada para registrar.");
  }

  await sb.from("messages").insert([
    { user_id: user.id, role: "user", texto, fotos: imagensBrutas.length, cards: null },
    {
      user_id: user.id,
      role: "assistant",
      texto: resposta,
      fotos: 0,
      cards: cards as never,
    },
  ]);

  await registrarChamada({
    userId: user.id,
    tipo: "chat",
    modelo: MODELO,
    uso: msg.usage,
    imagens: imagensBrutas.length,
    buscas,
    ms,
    hash,
    resposta: { resposta },
  });

  // A IA não cita totais; quem cita é o app, com o número que foi gravado.
  const totalGravado = cards
    .filter((c): c is Extract<Card, { tipo: "refeicao" }> => c.tipo === "refeicao")
    .flatMap((c) => c.refeicao.meal_items)
    .reduce(
      (a, i) => ({
        kcal: a.kcal + (Number(i.qtd) * Number(i.k100)) / 100,
        prot: a.prot + (Number(i.qtd) * Number(i.p100)) / 100,
        carb: a.carb + (Number(i.qtd) * Number(i.c100)) / 100,
        gord: a.gord + (Number(i.qtd) * Number(i.g100)) / 100,
      }),
      { kcal: 0, prot: 0, carb: 0, gord: 0 },
    );

  const resumo =
    totalGravado.kcal > 0
      ? `Registrei ${Math.round(totalGravado.kcal)} kcal · ${Math.round(totalGravado.prot)} P · ` +
        `${Math.round(totalGravado.carb)} C · ${Math.round(totalGravado.gord)} G.`
      : null;

  return NextResponse.json({
    resposta,
    resumo,
    cards,
    problemas,
    restantes: perfilRow.ai_diario_limite - usadas - 1,
  });
}

type Ctx = {
  sb: Awaited<ReturnType<typeof supabaseServer>>;
  userId: string;
  dia: string;
  hora: string;
  /** Falhas de gravação, para a conversa contar em vez de engolir. */
  problemas: string[];
  /** Alimentos da tabela que casaram com o texto, por nome normalizado. */
  tabela: Map<string, LinhaTaco>;
};

/** Grava uma ação e devolve o cartão que a conversa vai mostrar. */
async function aplicar(acao: Acao, ctx: Ctx): Promise<Card | null> {
  const { sb, userId, dia, hora, problemas } = ctx;

  switch (acao.tipo) {
    case "refeicao": {
      const { data: meal, error: erroMeal } = await sb
        .from("meals")
        .insert({
          user_id: userId,
          dia,
          tipo: acao.refeicao,
          nome: acao.nome,
          hora,
          origem: "ia",
        })
        .select("*")
        .single();

      if (erroMeal || !meal) {
        problemas.push(`Não gravei "${acao.nome}": ${erroMeal?.message ?? "banco não devolveu a refeição"}`);
        return null;
      }

      // O valor que vale é o do banco quando o nome bate com a tabela.
      const conciliados = conciliarComTaco(acao.itens, ctx.tabela);

      const itens = conciliados.map((it, i) => {
        const p = por100(it.quantidade, {
          kcal: it.kcal,
          prot: it.prot,
          carb: it.carb,
          gord: it.gord,
        });
        return {
          meal_id: meal.id,
          nome: it.nome,
          qtd: it.quantidade,
          unidade: it.unidade,
          fonte: it.fonte,
          fonte_detalhe: it.fonte_detalhe ?? null,
          ...p,
          ordem: i,
        };
      });

      let { data: gravados, error: erroItens } = await sb
        .from("meal_items")
        .insert(itens)
        .select("*");

      // Banco ainda sem a migration 0004: grava sem a procedência.
      // Banco sem a 0006 primeiro, sem a 0004 depois.
      if (colunaAusente(erroItens, "fonte_detalhe")) {
        ({ data: gravados, error: erroItens } = await sb
          .from("meal_items")
          .insert(semColuna(itens, "fonte_detalhe"))
          .select("*"));
      }

      if (colunaAusente(erroItens, "fonte")) {
        ({ data: gravados, error: erroItens } = await sb
          .from("meal_items")
          .insert(semColuna(semColuna(itens, "fonte_detalhe"), "fonte"))
          .select("*"));
      }

      if (erroItens || !gravados?.length) {
        // Refeição sem linha nenhuma não é registro: desfaz.
        await sb.from("meals").delete().eq("id", meal.id);
        problemas.push(
          `Não gravei os itens de "${acao.nome}": ${erroItens?.message ?? "banco não devolveu as linhas"}`,
        );
        return null;
      }

      return { tipo: "refeicao", refeicao: { ...meal, meal_items: gravados } };
    }

    case "treino": {
      const { error } = await sb.from("workouts").insert({
        user_id: userId,
        dia,
        nome: acao.nome,
        minutos: acao.min === null ? null : Math.round(acao.min),
        kcal_estimadas: acao.kcal === null ? null : Math.round(acao.kcal),
        fonte: "manual",
      });
      if (error) {
        problemas.push(`Não gravei o treino "${acao.nome}": ${error.message}`);
        return null;
      }
      return { tipo: "treino", nome: acao.nome, min: acao.min, kcal: acao.kcal };
    }

    case "peso": {
      const { error } = await sb.from("weighins").upsert(
        {
          user_id: userId,
          dia,
          peso: acao.peso,
          gordura_pct: acao.gordura,
          massa_muscular: acao.massa_muscular,
          agua_pct: null,
          visceral: null,
          idade_metabolica: null,
          fonte: "ia",
        },
        { onConflict: "user_id,dia" },
      );
      if (error) {
        problemas.push(`Não gravei a pesagem: ${error.message}`);
        return null;
      }

      await sb
        .from("profiles")
        .update({
          peso_kg: acao.peso,
          ...(acao.gordura !== null ? { gordura_pct: acao.gordura } : {}),
        })
        .eq("user_id", userId);

      return {
        tipo: "peso",
        peso: acao.peso,
        gordura: acao.gordura,
        massa_muscular: acao.massa_muscular,
      };
    }

    case "dia": {
      const { error } = await sb.from("day_notes").upsert(
        {
          user_id: userId,
          dia,
          passos: acao.passos,
          sono_h: acao.sono,
          atividade: acao.atividade,
        },
        { onConflict: "user_id,dia" },
      );
      if (error) {
        problemas.push(`Não gravei a nota do dia: ${error.message}`);
        return null;
      }
      return {
        tipo: "dia",
        passos: acao.passos,
        sono: acao.sono,
        atividade: acao.atividade,
      };
    }

    case "alimento": {
      const p = por100(acao.porcao, {
        kcal: acao.kcal,
        prot: acao.prot,
        carb: acao.carb,
        gord: acao.gord,
      });
      const { error } = await sb.from("foods").insert({
        user_id: userId,
        nome: acao.nome,
        unidade: acao.unidade,
        porcao_rotulo: acao.porcao,
        ...p,
      });
      if (error) {
        problemas.push(`Não gravei o alimento "${acao.nome}": ${error.message}`);
        return null;
      }
      return { tipo: "alimento", nome: acao.nome, porcao: acao.porcao, kcal: acao.kcal };
    }
  }
}
