/** Formatação pt-BR. Números curtos, sem enfeite. */

const nf = (min: number, max: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: min, maximumFractionDigits: max });

export const kcal = (n: number) => nf(0, 0).format(Math.round(n));
export const g = (n: number) => `${nf(0, 0).format(Math.round(n))} g`;
export const g1 = (n: number) => `${nf(0, 1).format(n)} g`;
export const kg = (n: number) => `${nf(1, 1).format(n)} kg`;
export const kg2 = (n: number) => `${nf(2, 2).format(n)} kg`;
export const pct = (n: number) => `${nf(0, 1).format(n)}%`;
export const num = (n: number, casas = 1) => nf(0, casas).format(n);

/** Sempre com sinal: −350 kcal, +1,2 kg. */
export const comSinal = (n: number, casas = 0) =>
  `${n > 0 ? "+" : n < 0 ? "−" : ""}${nf(casas, casas).format(Math.abs(n))}`;

export const TIPO_LABEL: Record<string, string> = {
  cafe: "Café",
  almoco: "Almoço",
  lanche: "Lanche",
  jantar: "Jantar",
  ceia: "Ceia",
};

export const TIPO_EMOJI: Record<string, string> = {
  cafe: "☕",
  almoco: "🍛",
  lanche: "🥪",
  jantar: "🍽️",
  ceia: "🌙",
};

export const ORDEM_TIPO = ["cafe", "almoco", "lanche", "jantar", "ceia"] as const;

/** Sugere a refeição pela hora — usado quando a IA não diz qual é. */
export function refeicaoPorHora(hora: number): (typeof ORDEM_TIPO)[number] {
  if (hora < 10) return "cafe";
  if (hora < 15) return "almoco";
  if (hora < 18) return "lanche";
  if (hora < 22) return "jantar";
  return "ceia";
}

export const UNIDADE_LABEL: Record<string, string> = {
  g: "g",
  ml: "ml",
  porcao: "porção",
};
