import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { TipoChamadaIA } from "@/lib/types/db";

/** Chave e modelo só existem no servidor (SPEC §2 e §9). */
export const MODELO = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

let cliente: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY ausente");
  cliente ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return cliente;
}

/* ------------------------------------------------------------------ */
/* Custo                                                               */
/* ------------------------------------------------------------------ */

/** USD por milhão de tokens. Atualizar quando a tabela da Anthropic mudar. */
const PRECO: Record<string, { entrada: number; saida: number; cacheLeitura: number; cacheEscrita: number }> = {
  "claude-sonnet-5": { entrada: 2, saida: 10, cacheLeitura: 0.2, cacheEscrita: 2.5 },
  "claude-opus-5": { entrada: 5, saida: 25, cacheLeitura: 0.5, cacheEscrita: 6.25 },
  "claude-haiku-4-5": { entrada: 1, saida: 5, cacheLeitura: 0.1, cacheEscrita: 1.25 },
};

export type Uso = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

/** USD por busca na web (server tool da Anthropic). */
export const CUSTO_BUSCA_WEB = 0.01;

export function custoUSD(modelo: string, uso: Uso, buscas = 0): number {
  const p = PRECO[modelo] ?? PRECO["claude-sonnet-5"];
  const leitura = uso.cache_read_input_tokens ?? 0;
  const escrita = uso.cache_creation_input_tokens ?? 0;
  const total =
    (uso.input_tokens * p.entrada +
      uso.output_tokens * p.saida +
      leitura * p.cacheLeitura +
      escrita * p.cacheEscrita) /
    1_000_000;
  return Number((total + buscas * CUSTO_BUSCA_WEB).toFixed(6));
}

/* ------------------------------------------------------------------ */
/* Limite diário, cache e log                                          */
/* ------------------------------------------------------------------ */

export type ErroIA = { code: string; message: string; status: number };

export const ERROS = {
  semSessao: { code: "sem_sessao", message: "Entre de novo.", status: 401 },
  limiteDiario: {
    code: "limite_diario",
    message: "Limite diário de IA atingido. O resto do app continua funcionando.",
    status: 429,
  },
  muitasChamadas: {
    code: "rate_limit",
    message: "Muitas chamadas seguidas. Espere alguns segundos.",
    status: 429,
  },
  entradaInvalida: { code: "entrada_invalida", message: "Não entendi o que veio.", status: 400 },
  semChave: { code: "sem_chave", message: "IA não configurada neste ambiente.", status: 503 },
  modelo: {
    code: "erro_modelo",
    message: "A IA não respondeu direito. Tente de novo.",
    status: 502,
  },
} satisfies Record<string, ErroIA>;

/** Quantas chamadas o usuário já fez hoje (fuso do servidor em UTC). */
export async function chamadasHoje(userId: string): Promise<number> {
  const admin = supabaseAdmin();
  const inicio = new Date();
  inicio.setUTCHours(0, 0, 0, 0);

  const { count } = await admin
    .from("ai_calls")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", inicio.toISOString());

  return count ?? 0;
}

export function hashEntrada(partes: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(partes)).digest("hex").slice(0, 32);
}

/** Cache de 5 minutos para entradas idênticas (SPEC §6). */
export async function respostaCacheada<T>(
  userId: string,
  hash: string,
  tipo: TipoChamadaIA,
): Promise<T | null> {
  const admin = supabaseAdmin();
  const limite = new Date(Date.now() - 5 * 60_000).toISOString();

  const { data } = await admin
    .from("ai_calls")
    .select("resposta")
    .eq("user_id", userId)
    .eq("entrada_hash", hash)
    .eq("tipo", tipo)
    .gte("created_at", limite)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.resposta as T) ?? null;
}

export async function registrarChamada(args: {
  userId: string;
  tipo: TipoChamadaIA;
  modelo: string;
  uso: Uso;
  imagens: number;
  /** Buscas na web feitas pela IA; custam à parte do token. */
  buscas?: number;
  ms: number;
  hash: string;
  resposta: unknown;
}) {
  const admin = supabaseAdmin();
  await admin.from("ai_calls").insert({
    user_id: args.userId,
    tipo: args.tipo,
    modelo: args.modelo,
    tokens_in: args.uso.input_tokens,
    tokens_out: args.uso.output_tokens,
    tokens_cache_read: args.uso.cache_read_input_tokens ?? 0,
    tokens_cache_write: args.uso.cache_creation_input_tokens ?? 0,
    imagens: args.imagens,
    buscas: args.buscas ?? 0,
    ms: args.ms,
    custo_usd_est: custoUSD(args.modelo, args.uso, args.buscas ?? 0),
    entrada_hash: args.hash,
    resposta: args.resposta as never,
  });
}

/* ------------------------------------------------------------------ */
/* Rate limit por IP                                                   */
/* ------------------------------------------------------------------ */

const janelas = new Map<string, number[]>();

/**
 * Limite simples por IP, em memória (SPEC §9).
 * Serverless recicla processo, então isto segura rajada, não ataque — o limite
 * diário por usuário em `ai_calls` é que controla o custo de verdade.
 */
export function rateLimitIP(ip: string, max = 12, janelaMs = 60_000): boolean {
  const agora = Date.now();
  const marcas = (janelas.get(ip) ?? []).filter((t) => agora - t < janelaMs);
  marcas.push(agora);
  janelas.set(ip, marcas);

  if (janelas.size > 500) {
    for (const [k, v] of janelas) if (!v.some((t) => agora - t < janelaMs)) janelas.delete(k);
  }

  return marcas.length <= max;
}

export function ipDaRequisicao(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "desconhecido"
  );
}
