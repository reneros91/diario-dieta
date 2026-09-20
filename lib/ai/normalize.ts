import { kcalDeMacros } from "@/lib/calc";
import { refeicaoPorHora } from "@/lib/format";

/**
 * Normalização defensiva das ações que a IA devolve (`normAcoes` do protótipo).
 *
 * O schema da tool já restringe bastante, mas modelo é modelo: vem número como
 * string ("120 g"), vem `tipo` faltando, vem item zerado, vem kcal que não fecha
 * com os macros. Aqui a bagunça vira algo que o zod aceita — ou some.
 */

const numero = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;

  // "120g" → 120 · "1,5 kg" → 1,5 · "1.500 kcal" → 1500 · "1.5" → 1.5
  const so = v.replace(/[^\d.,-]/g, "");
  const temVirgula = so.includes(",");
  const limpo = temVirgula
    ? so.replace(/\./g, "").replace(",", ".") // ponto é separador de milhar
    : so.replace(/\.(?=\d{3}\b)/g, ""); // "1.500" é milhar, "1.5" é decimal

  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
};

const texto = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t.slice(0, 120) : null;
};

type Refeicao = "cafe" | "almoco" | "lanche" | "jantar" | "ceia";

const SINONIMOS: Record<string, Refeicao> = {
  cafe: "cafe",
  "cafe da manha": "cafe",
  manha: "cafe",
  almoco: "almoco",
  lanche: "lanche",
  "lanche da tarde": "lanche",
  tarde: "lanche",
  jantar: "jantar",
  janta: "jantar",
  noite: "jantar",
  ceia: "ceia",
};

function normRefeicao(v: unknown, hora: number): Refeicao {
  const t = texto(v)
    ?.normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if (t && SINONIMOS[t]) return SINONIMOS[t];
  return refeicaoPorHora(hora);
}

const ATIVIDADES = ["sentado", "leve", "ativo"] as const;

/**
 * Só aceita kcal que fecham com 4P + 4C + 9G dentro de 5% (SPEC §6.5 e §11);
 * fora disso, vale o que os macros dizem — eles é que somam no cartão.
 */
const TOLERANCIA_KCAL = 0.05;

function ajustaKcal(kcal: number | null, prot: number, carb: number, gord: number): number {
  const derivada = kcalDeMacros(prot, carb, gord);
  if (kcal === null || kcal <= 0) return Math.round(derivada);
  if (derivada <= 0) return Math.round(kcal);
  const desvio = Math.abs(kcal - derivada) / derivada;
  return Math.round(desvio > TOLERANCIA_KCAL ? derivada : kcal);
}

type Bruta = Record<string, unknown>;

/**
 * @param acoes  o que veio no `input` da tool
 * @param hora   hora local (0–23), para escolher a refeição quando a IA não diz
 */
export function normAcoes(acoes: unknown, hora: number): unknown[] {
  if (!Array.isArray(acoes)) return [];

  const saida: unknown[] = [];

  for (const cru of acoes) {
    if (!cru || typeof cru !== "object") continue;
    const a = cru as Bruta;

    // Sem `tipo`, deduz pelo formato: com itens é refeição; com peso é pesagem.
    let tipo = texto(a.tipo)?.toLowerCase() ?? null;
    if (!tipo) {
      if (Array.isArray(a.itens)) tipo = "refeicao";
      else if (a.peso !== undefined) tipo = "peso";
      else if (a.min !== undefined || a.minutos !== undefined) tipo = "treino";
      else if (a.passos !== undefined || a.sono !== undefined) tipo = "dia";
      else continue;
    }

    switch (tipo) {
      case "refeicao": {
        const itens = normItens(a.itens);
        if (!itens.length) break;
        saida.push({
          tipo: "refeicao",
          refeicao: normRefeicao(a.refeicao ?? a.tipo_refeicao, hora),
          nome: texto(a.nome) ?? "Refeição",
          itens,
        });
        break;
      }

      case "treino": {
        const nome = texto(a.nome);
        if (!nome) break;
        saida.push({
          tipo: "treino",
          nome,
          min: numero(a.min ?? a.minutos),
          kcal: numero(a.kcal ?? a.kcal_estimadas),
        });
        break;
      }

      case "peso": {
        const peso = numero(a.peso);
        if (peso === null || peso < 30 || peso > 400) break;
        saida.push({
          tipo: "peso",
          peso,
          gordura: faixa(numero(a.gordura ?? a.gordura_pct), 2, 70),
          massa_muscular: faixa(numero(a.massa_muscular), 10, 200),
        });
        break;
      }

      case "dia": {
        const passos = numero(a.passos);
        const sono = numero(a.sono ?? a.sono_h);
        const at = texto(a.atividade)?.toLowerCase();
        const atividade = ATIVIDADES.find((x) => x === at) ?? null;
        if (passos === null && sono === null && atividade === null) break;
        saida.push({
          tipo: "dia",
          passos: passos === null ? null : Math.round(faixa(passos, 0, 200000) ?? 0),
          sono: faixa(sono, 0, 24),
          atividade,
        });
        break;
      }

      case "alimento": {
        const nome = texto(a.nome);
        const porcao = numero(a.porcao ?? a.quantidade);
        if (!nome || porcao === null || porcao <= 0) break;
        const prot = Math.max(0, numero(a.prot) ?? 0);
        const carb = Math.max(0, numero(a.carb) ?? 0);
        const gord = Math.max(0, numero(a.gord) ?? 0);
        saida.push({
          tipo: "alimento",
          nome,
          porcao,
          unidade: texto(a.unidade) === "ml" ? "ml" : "g",
          kcal: ajustaKcal(numero(a.kcal), prot, carb, gord),
          prot,
          carb,
          gord,
        });
        break;
      }

      default:
        break;
    }
  }

  return saida;
}

function faixa(v: number | null, min: number, max: number): number | null {
  if (v === null) return null;
  if (v < min || v > max) return null;
  return v;
}

function normItens(cru: unknown): unknown[] {
  if (!Array.isArray(cru)) return [];

  const itens: unknown[] = [];
  for (const bruto of cru.slice(0, 20)) {
    if (!bruto || typeof bruto !== "object") continue;
    const i = bruto as Bruta;

    const nome = texto(i.nome ?? i.alimento);
    const quantidade = numero(i.quantidade ?? i.qtd ?? i.gramas);
    if (!nome || quantidade === null || quantidade <= 0) continue;

    const prot = Math.max(0, numero(i.prot ?? i.proteina) ?? 0);
    const carb = Math.max(0, numero(i.carb ?? i.carboidrato) ?? 0);
    const gord = Math.max(0, numero(i.gord ?? i.gordura) ?? 0);
    const kcal = ajustaKcal(numero(i.kcal ?? i.calorias), prot, carb, gord);

    // Linha sem nenhum número útil não vira registro.
    if (kcal <= 0 && prot === 0 && carb === 0 && gord === 0) continue;

    itens.push({
      nome,
      quantidade,
      unidade: texto(i.unidade) === "ml" ? "ml" : "g",
      kcal,
      prot: Number(prot.toFixed(2)),
      carb: Number(carb.toFixed(2)),
      gord: Number(gord.toFixed(2)),
    });
  }

  return itens;
}

/** Normaliza o retorno da tool de receita. */
export function normItensReceita(cru: unknown): unknown[] {
  if (!Array.isArray(cru)) return [];

  const itens: unknown[] = [];
  for (const bruto of cru.slice(0, 30)) {
    if (!bruto || typeof bruto !== "object") continue;
    const i = bruto as Bruta;

    const nome = texto(i.nome);
    const peso = numero(i.peso_pronto ?? i.peso ?? i.qtd_pronto);
    if (!nome || peso === null || peso <= 0) continue;

    const prot = Math.max(0, numero(i.prot) ?? 0);
    const carb = Math.max(0, numero(i.carb) ?? 0);
    const gord = Math.max(0, numero(i.gord) ?? 0);

    itens.push({
      nome,
      peso_pronto: peso,
      kcal: ajustaKcal(numero(i.kcal), prot, carb, gord),
      prot: Number(prot.toFixed(2)),
      carb: Number(carb.toFixed(2)),
      gord: Number(gord.toFixed(2)),
    });
  }

  return itens;
}
