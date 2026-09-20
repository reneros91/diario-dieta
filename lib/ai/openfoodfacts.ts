import { gramasDeAlcool, kcalDeMacros } from "@/lib/calc";

/**
 * Open Food Facts: catálogo aberto de produto industrializado, com cerca de
 * 36 mil itens brasileiros.
 *
 * Existe porque busca livre na web erra feio em refrigerante e cerveja — a IA
 * cai em site de dieta com número inventado. Aqui o número vem do rótulo que o
 * fabricante (ou alguém com o produto na mão) cadastrou, e vem identificado.
 *
 * Duas portas, com confiança diferente:
 * - CÓDIGO DE BARRAS: aponta para um produto só. É a porta boa.
 * - NOME: devolve o que casar, e casa mal. O mesmo "leite integral Italac"
 *   volta como 59 kcal/100 ml (certo) e como 492 kcal/100 g (entrada errada de
 *   usuário). Por isso nome devolve VÁRIOS candidatos, filtrados, para a IA
 *   escolher e dizer qual usou — nunca um veredito silencioso.
 */

const BASE_CODIGO = "https://world.openfoodfacts.org/api/v2/product";
const BASE_BUSCA = "https://br.openfoodfacts.org/cgi/search.pl";

/** O serviço pede um User-Agent que o identifique. Sem e-mail de ninguém. */
const AGENTE = "NutriDia/1.0 (https://diario-dieta-two.vercel.app)";

const CAMPOS = [
  "code",
  "product_name",
  "brands",
  "quantity",
  "serving_size",
  "completeness",
  "nutriments",
].join(",");

const TIMEOUT_MS = 6000;

export type Produto = {
  codigo: string;
  nome: string;
  marca: string | null;
  /** Rótulo da embalagem: "350 ml", "1 kg". Ajuda a IA a estimar a porção. */
  embalagem: string | null;
  /** Tudo por 100 g ou 100 ml, como o Open Food Facts publica. */
  kcal: number;
  prot: number;
  carb: number;
  gord: number;
  /** Gramas de álcool puro por 100 ml, convertidas do teor (% vol). */
  alcool: number;
  unidade: "g" | "ml";
};

type Nutrimentos = Record<string, unknown>;

const numero = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Embalagem em litro ou ml, ou teor alcoólico, denunciam líquido. */
function ehLiquido(bruto: Record<string, unknown>, teorAlcool: number): boolean {
  if (teorAlcool > 0) return true;
  const rotulo = `${bruto.quantity ?? ""} ${bruto.serving_size ?? ""}`.toLowerCase();
  return /\d\s*(ml|l|lt|litro)/.test(rotulo);
}

/**
 * Converte a resposta crua em `Produto`, ou devolve null quando os números não
 * param em pé.
 *
 * As regras de sanidade são grosseiras de propósito: elas barram lixo evidente
 * (caloria impossível, macro acima de 100 g em 100 g, caloria que briga com os
 * próprios macros), não julgam se o produto é o certo. Isso quem decide é a IA
 * com o nome na mão, e depois você, olhando a linha do diário.
 */
export function normalizarProduto(bruto: unknown): Produto | null {
  if (!bruto || typeof bruto !== "object") return null;
  const p = bruto as Record<string, unknown>;

  const nome = typeof p.product_name === "string" ? p.product_name.trim() : "";
  if (!nome) return null;

  const n = (p.nutriments ?? {}) as Nutrimentos;
  const kcal = numero(n["energy-kcal_100g"]);
  if (kcal === null || kcal <= 0 || kcal > 900) return null;

  const prot = Math.max(0, numero(n.proteins_100g) ?? 0);
  const carb = Math.max(0, numero(n.carbohydrates_100g) ?? 0);
  const gord = Math.max(0, numero(n.fat_100g) ?? 0);
  if (prot > 100 || carb > 100 || gord > 100) return null;
  if (prot + carb + gord > 100) return null;

  // `alcohol_100g` no Open Food Facts é teor em % de volume, não gramas.
  const teor = Math.max(0, Math.min(100, numero(n.alcohol_100g) ?? 0));
  const liquido = ehLiquido(p, teor);
  const alcool = teor > 0 ? gramasDeAlcool(100, teor) : 0;

  const derivada = kcalDeMacros(prot, carb, gord, alcool);
  if (derivada > 0) {
    // Caloria muito abaixo do que os próprios macros implicam é entrada quebrada.
    // Acima só passa em líquido, onde a sobra pode ser álcool não declarado.
    if (derivada > kcal * 1.25) return null;
    if (kcal > derivada * 1.25 && !liquido) return null;
  }

  const marca =
    typeof p.brands === "string" && p.brands.trim()
      ? p.brands.split(",")[0].trim().slice(0, 60)
      : null;

  return {
    codigo: typeof p.code === "string" ? p.code : "",
    nome: nome.slice(0, 120),
    marca,
    embalagem: typeof p.quantity === "string" && p.quantity.trim() ? p.quantity.trim().slice(0, 40) : null,
    kcal: Math.round(kcal * 10) / 10,
    prot: Math.round(prot * 10) / 10,
    carb: Math.round(carb * 10) / 10,
    gord: Math.round(gord * 10) / 10,
    alcool,
    unidade: liquido ? "ml" : "g",
  };
}

/**
 * Candidato mais completo primeiro.
 *
 * `completeness` é o quanto da ficha o Open Food Facts considera preenchida.
 * Não diz que o número está certo — o registro errado do leite Italac é bem
 * preenchido — mas ficha vazia erra mais, e marca declarada erra menos.
 */
function ordenarPorConfianca(a: Produto & { completeness: number }, b: Produto & { completeness: number }) {
  if (Boolean(b.marca) !== Boolean(a.marca)) return b.marca ? 1 : -1;
  return b.completeness - a.completeness;
}

const semCompletude = (c: Produto & { completeness: number }): Produto => ({
  codigo: c.codigo,
  nome: c.nome,
  marca: c.marca,
  embalagem: c.embalagem,
  kcal: c.kcal,
  prot: c.prot,
  carb: c.carb,
  gord: c.gord,
  alcool: c.alcool,
  unidade: c.unidade,
});

async function buscar(url: string): Promise<unknown | null> {
  // 503 acontece: o serviço é mantido por uma associação sem fins lucrativos.
  // Uma segunda tentativa resolve a maioria; a terceira seria teimosia dentro
  // do limite de 60 s da função.
  for (const tentativa of [0, 1]) {
    if (tentativa > 0) await new Promise((r) => setTimeout(r, 1200));
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": AGENTE, Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (r.status >= 500 || r.status === 429) continue;
      if (!r.ok) return null;
      return await r.json();
    } catch {
      // Timeout ou rede: a próxima volta tenta de novo, depois desiste.
    }
  }
  return null;
}

/** Produto por código de barras. É o caminho confiável. */
export async function produtoPorCodigo(codigo: string): Promise<Produto | null> {
  const limpo = codigo.replace(/\D/g, "");
  if (limpo.length < 8 || limpo.length > 14) return null;

  const dados = (await buscar(
    `${BASE_CODIGO}/${limpo}.json?fields=${CAMPOS}`,
  )) as { status?: number; product?: unknown } | null;

  if (!dados || dados.status !== 1) return null;
  return normalizarProduto(dados.product);
}

/** Candidatos por nome, do mais completo para o menos. Pode vir vazio. */
export async function produtosPorNome(termo: string, limite = 3): Promise<Produto[]> {
  const busca = termo.trim().slice(0, 80);
  if (busca.length < 3) return [];

  const url =
    `${BASE_BUSCA}?search_terms=${encodeURIComponent(busca)}` +
    `&search_simple=1&action=process&json=1&page_size=12&fields=${CAMPOS}`;

  const dados = (await buscar(url)) as { products?: unknown[] } | null;
  if (!dados || !Array.isArray(dados.products)) return [];

  const vistos = new Set<string>();
  const candidatos: (Produto & { completeness: number })[] = [];

  for (const bruto of dados.products) {
    const p = normalizarProduto(bruto);
    if (!p) continue;

    const chave = `${p.nome.toLowerCase()}|${p.marca?.toLowerCase() ?? ""}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);

    const c = (bruto as { completeness?: unknown }).completeness;
    candidatos.push({ ...p, completeness: numero(c) ?? 0 });
  }

  // `completeness` serviu para ordenar; não vai adiante.
  return candidatos.sort(ordenarPorConfianca).slice(0, limite).map(semCompletude);
}

/** Como o produto entra no `fonte_detalhe` da linha do diário. */
export function descreverProduto(p: Produto): string {
  const partes = [p.marca, p.nome, p.embalagem].filter(Boolean);
  return `Open Food Facts · ${partes.join(" ")}`.slice(0, 200);
}
