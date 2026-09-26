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
} from "@/lib/ai/anthropic";
import { REGRAS, contextoChat } from "@/lib/ai/prompt";
import {
  TOOL_PRODUTO,
  TOOL_REGISTRAR,
  zConsultaProduto,
  zRegistro,
  type Acao,
} from "@/lib/ai/schema";
import { normAcoes } from "@/lib/ai/normalize";
import {
  descreverProduto,
  produtoPorCodigo,
  produtosPorNome,
  type Produto,
} from "@/lib/ai/openfoodfacts";
import {
  conciliarComTaco,
  indexarTaco,
  listaParaPrompt,
  palavrasDeBusca,
  type LinhaTaco,
} from "@/lib/ai/taco";
import { alvos, hojeISO, horaAgora, por100, tendencia } from "@/lib/calc";
import { perfilParaCalc } from "@/lib/data";
import { TIPO_LABEL } from "@/lib/format";

/**
 * Analisa o que a pessoa descreveu e DEVOLVE os itens — não grava nada.
 *
 * É a diferença em relação ao chat que existia antes: lá a IA escrevia direto
 * no diário e a pessoa descobria o estrago depois. Aqui ela vê o que veio, com
 * os macros e a procedência de cada linha, e decide se entra.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_IMAGENS = 4;
const MAX_BYTES_IMAGEM = 4 * 1024 * 1024;
const MAX_BUSCAS = 2;

const zBody = z.object({
  texto: z.string().trim().max(2000),
  imagens: z.array(z.string()).max(MAX_IMAGENS).optional(),
  refeicao: z.string().trim().max(30),
});

/** Uma linha pronta para o painel mostrar e para a ação gravar. */
export type ItemAnalisado = {
  nome: string;
  qtd: number;
  unidade: "g" | "ml";
  kcal: number;
  prot: number;
  carb: number;
  gord: number;
  fonte: string;
  fonte_detalhe: string | null;
  k100: number;
  p100: number;
  c100: number;
  g100: number;
};

export type RespostaAnalise = {
  resposta: string;
  itens: ItemAnalisado[];
  total: { kcal: number; prot: number; carb: number; gord: number };
  problemas: string[];
};

const erro = (e: { code: string; message: string; status: number }) =>
  NextResponse.json({ code: e.code, message: e.message }, { status: e.status });

function preparaImagem(bruta: string): { media_type: string; data: string } | null {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.*)$/s.exec(bruta);
  const data = m ? m[2] : bruta;
  const media_type = m ? m[1] : "image/jpeg";
  if (!data || data.length * 0.75 > MAX_BYTES_IMAGEM) return null;
  return { media_type, data };
}

function contarBuscas(msg: Anthropic.Message): number {
  const uso = msg.usage as { server_tool_use?: { web_search_requests?: number } };
  return uso.server_tool_use?.web_search_requests ?? 0;
}

function consultasDeBusca(msg: Anthropic.Message): string[] {
  return msg.content
    .filter((b) => b.type === "server_tool_use" && b.name === "web_search")
    .map((b) => {
      const entrada = (b as { input?: { query?: unknown } }).input;
      return typeof entrada?.query === "string" ? entrada.query : "";
    })
    .filter(Boolean);
}

type ConsultaProduto = { busca: string; achados: string[] };

async function atenderConsulta(
  pedido: Anthropic.ToolUseBlock,
  registro: ConsultaProduto[],
): Promise<Anthropic.ToolResultBlockParam> {
  const args = zConsultaProduto.safeParse(pedido.input);
  const codigo = args.success ? (args.data.codigo_barras ?? "") : "";
  const nome = args.success ? (args.data.nome ?? "") : "";

  const achados = codigo
    ? [await produtoPorCodigo(codigo)].filter((p): p is Produto => p !== null)
    : await produtosPorNome(nome);

  registro.push({
    busca: codigo ? `código ${codigo}` : nome,
    achados: achados.map((p) => descreverProduto(p)),
  });

  const conteudo = achados.length
    ? [
        `${achados.length} produto(s) no Open Food Facts. Valores por 100 ${achados[0].unidade}:`,
        ...achados.map(
          (p) =>
            `- ${descreverProduto(p)}: ${p.kcal} kcal, ${p.prot} P, ${p.carb} C, ${p.gord} G` +
            (p.alcool ? `, ${p.alcool} g de álcool` : "") +
            ` por 100 ${p.unidade}.`,
        ),
        'Use estes números, escale para a quantidade consumida, marque "fonte": "web" e ' +
          'copie a descrição do produto para "fonte_detalhe".',
      ].join("\n")
    : "Nada encontrado no Open Food Facts. Tente web_search, ou peça a marca e uma foto do rótulo. Não estime de cabeça.";

  return { type: "tool_result", tool_use_id: pedido.id, content: conteudo };
}

export async function POST(request: Request) {
  const user = await usuarioAtual();
  if (!user) return erro(ERROS.semSessao);
  if (!process.env.ANTHROPIC_API_KEY) return erro(ERROS.semChave);
  if (!rateLimitIP(ipDaRequisicao(request))) return erro(ERROS.muitasChamadas);

  const corpo = zBody.safeParse(await request.json().catch(() => null));
  if (!corpo.success) return erro(ERROS.entradaInvalida);

  const { texto, refeicao } = corpo.data;
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

  const { data: perfilRow } = await sb
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!perfilRow) return erro(ERROS.semSessao);

  const usadas = await chamadasHoje(user.id);
  if (usadas >= perfilRow.ai_diario_limite) return erro(ERROS.limiteDiario);

  /* Contexto --------------------------------------------------------- */
  const perfil = perfilParaCalc(perfilRow);
  const alvo = alvos(perfil);

  const palavras = palavrasDeBusca(texto);
  const { data: candidatos } = palavras.length
    ? await sb
        .from("taco")
        .select("nome, kcal, prot, carb, gord, unidade")
        .or(palavras.map((p) => `nome.ilike.%${p}%`).join(","))
        .limit(40)
    : { data: [] as LinhaTaco[] };

  const tabela = indexarTaco((candidatos ?? []) as LinhaTaco[]);

  const [totais, pesagens] = await Promise.all([
    sb.from("day_totals").select("*").eq("dia", dia).maybeSingle(),
    sb.from("weighins").select("dia, peso, gordura_pct").order("dia", { ascending: false }).limit(30),
  ]);

  const consumido = totais.data ?? { kcal: 0, prot: 0, carb: 0, gord: 0 };
  const t = tendencia(
    (pesagens.data ?? []).map((p) => ({ dia: p.dia, peso: Number(p.peso) })),
    28,
    dia,
  );
  const ultima = pesagens.data?.[0];

  const contexto =
    contextoChat({
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
      refeicoesHoje: [],
      treinosHoje: [],
      ultimaPesagem: ultima
        ? `${ultima.dia}: ${Number(ultima.peso)} kg${
            ultima.gordura_pct ? `, ${Number(ultima.gordura_pct)}% de gordura` : ""
          }`
        : null,
      tendencia: t ? `${t.kgSemana.toFixed(2)} kg/semana nas últimas ${t.janelaDias} dias` : null,
      dataHora: `${dia} ${horaAgora()}`,
      alimentos: listaParaPrompt((candidatos ?? []) as LinhaTaco[]),
    }) +
    `\nA PESSOA ESTÁ REGISTRANDO: ${TIPO_LABEL[refeicao] ?? refeicao}. ` +
    "Devolva UMA ação do tipo refeicao com os itens. Nada de treino, peso ou nota do dia.";

  /* Chamada ---------------------------------------------------------- */
  const inicio = Date.now();
  const consultasProduto: ConsultaProduto[] = [];
  let falhaBusca: string | null = null;
  let buscas = 0;

  const ferramentas = [
    TOOL_REGISTRAR,
    TOOL_PRODUTO,
    { type: "web_search_20260209", name: "web_search", max_uses: MAX_BUSCAS },
  ];

  const conteudo: Anthropic.ContentBlockParam[] = [
    ...imagens.map(
      (i): Anthropic.ContentBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: i!.media_type as "image/jpeg", data: i!.data },
      }),
    ),
    { type: "text", text: texto || "Descreva o que está na foto." },
  ];

  const mensagens: Anthropic.MessageParam[] = [{ role: "user", content: conteudo }];

  const base = {
    model: MODELO,
    system: [
      { type: "text" as const, text: REGRAS, cache_control: { type: "ephemeral" as const } },
      { type: "text" as const, text: contexto },
    ],
    thinking: { type: "disabled" as const },
  };

  let msg: Anthropic.Message;

  try {
    msg = await anthropic().messages.create({
      ...base,
      max_tokens: 2400,
      tools: ferramentas as Anthropic.ToolUnion[],
      tool_choice: { type: "auto" },
      messages: mensagens,
    });

    let voltas = 0;
    while (voltas < 2) {
      const pedidos = msg.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === TOOL_PRODUTO.name,
      );
      if (msg.stop_reason !== "pause_turn" && pedidos.length === 0) break;

      buscas += contarBuscas(msg);
      mensagens.push({ role: "assistant", content: msg.content });

      if (pedidos.length > 0) {
        const respostas = await Promise.all(pedidos.map((p) => atenderConsulta(p, consultasProduto)));
        mensagens.push({ role: "user", content: respostas });
      }

      msg = await anthropic().messages.create({
        ...base,
        max_tokens: 2400,
        tools: ferramentas as Anthropic.ToolUnion[],
        tool_choice: { type: "auto" },
        messages: mensagens,
      });
      voltas += 1;
    }

    buscas += contarBuscas(msg);

    if (!msg.content.some((b) => b.type === "tool_use" && b.name === "registrar")) {
      mensagens.push({ role: "assistant", content: msg.content });
      mensagens.push({
        role: "user",
        content: "Liste agora com a ferramenta, usando o que você já apurou.",
      });
      msg = await anthropic().messages.create({
        ...base,
        max_tokens: 1600,
        tools: [TOOL_REGISTRAR],
        tool_choice: { type: "tool", name: "registrar" },
        messages: mensagens,
      });
    }
  } catch (e) {
    falhaBusca = e instanceof Error ? e.message.slice(0, 300) : "erro desconhecido";
    try {
      msg = await anthropic().messages.create({
        ...base,
        max_tokens: 1600,
        tools: [TOOL_REGISTRAR],
        tool_choice: { type: "tool", name: "registrar" },
        messages: [{ role: "user", content: conteudo }],
      });
    } catch {
      return erro(ERROS.modelo);
    }
  }

  const ms = Date.now() - inicio;
  const bloco = msg.content.find((b) => b.type === "tool_use" && b.name === "registrar");
  if (!bloco || bloco.type !== "tool_use") return erro(ERROS.modelo);

  const bruto = bloco.input as Record<string, unknown>;
  const parsed = zRegistro.safeParse({
    resposta: typeof bruto.resposta === "string" ? bruto.resposta : "",
    acoes: normAcoes(bruto.acoes, hora),
  });
  if (!parsed.success) return erro(ERROS.modelo);

  const { resposta, acoes } = parsed.data;
  const problemas: string[] = [];

  // Só interessa comida: peso, treino e nota têm tela própria.
  const brutos = (acoes as Acao[])
    .filter((a): a is Extract<Acao, { tipo: "refeicao" }> => a.tipo === "refeicao")
    .flatMap((a) => a.itens);

  if (acoes.length > brutos.length && brutos.length === 0) {
    problemas.push("A IA entendeu outra coisa que não comida. Descreva o alimento e a quantidade.");
  }

  const itens: ItemAnalisado[] = conciliarComTaco(brutos, tabela).map((it) => {
    const p = por100(it.quantidade, { kcal: it.kcal, prot: it.prot, carb: it.carb, gord: it.gord });
    return {
      nome: it.nome,
      qtd: it.quantidade,
      unidade: it.unidade,
      kcal: it.kcal,
      prot: it.prot,
      carb: it.carb,
      gord: it.gord,
      fonte: it.fonte,
      fonte_detalhe: it.fonte_detalhe ?? null,
      ...p,
    };
  });

  if (itens.length === 0 && problemas.length === 0) {
    problemas.push("Não consegui identificar nenhum alimento. Tente descrever com a quantidade.");
  }

  const total = itens.reduce(
    (a, i) => ({
      kcal: a.kcal + i.kcal,
      prot: a.prot + i.prot,
      carb: a.carb + i.carb,
      gord: a.gord + i.gord,
    }),
    { kcal: 0, prot: 0, carb: 0, gord: 0 },
  );

  await registrarChamada({
    userId: user.id,
    tipo: "chat",
    modelo: MODELO,
    uso: msg.usage,
    imagens: imagensBrutas.length,
    buscas,
    ms,
    hash: hashEntrada([texto, imagens.map((i) => i!.data.slice(0, 256)), dia, refeicao]),
    resposta: {
      resposta,
      pergunta: texto.slice(0, 300),
      refeicao,
      buscas,
      consultas: consultasDeBusca(msg),
      produtos: consultasProduto,
      falhaBusca,
      candidatosTaco: (candidatos ?? []).map((c) => c.nome),
      itensDaIA: brutos.map((i) => ({
        nome: i.nome,
        qtd: i.quantidade,
        unidade: i.unidade,
        kcal: i.kcal,
        alcool: i.alcool,
        fonte: i.fonte,
        fonte_detalhe: i.fonte_detalhe,
      })),
      itensGravados: itens.map((i) => ({
        nome: i.nome,
        qtd: i.qtd,
        unidade: i.unidade,
        kcal: i.kcal,
        fonte: i.fonte,
        fonte_detalhe: i.fonte_detalhe,
      })),
      problemas,
    },
  });

  const payload: RespostaAnalise = { resposta, itens, total, problemas };
  return NextResponse.json(payload);
}
