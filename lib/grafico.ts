/** Helpers de gráfico compartilhados entre cliente e servidor. */

export const num = (n: number, casas = 1) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(n);

/** "3/2" — rótulo de eixo curto o bastante para caber. */
export function rotuloCurto(diaISO: string): string {
  const [, m, d] = diaISO.split("-");
  return `${Number(d)}/${Number(m)}`;
}

/** Agrupa dias em semanas ISO para o período de 90 dias (SPEC §3.5). */
export function porSemana<T extends { dia: string; kcal: number }>(
  dias: T[],
): { dia: string; kcal: number; diasComRegistro: number }[] {
  const semanas = new Map<string, { kcal: number; n: number; primeiro: string }>();

  for (const d of dias) {
    const data = new Date(`${d.dia}T12:00:00Z`);
    const diaSemana = (data.getUTCDay() + 6) % 7; // segunda = 0
    data.setUTCDate(data.getUTCDate() - diaSemana);
    const chave = data.toISOString().slice(0, 10);

    const atual = semanas.get(chave) ?? { kcal: 0, n: 0, primeiro: chave };
    if (d.kcal > 0) {
      atual.kcal += d.kcal;
      atual.n += 1;
    }
    semanas.set(chave, atual);
  }

  return [...semanas.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chave, v]) => ({
      dia: chave,
      kcal: v.n ? Math.round(v.kcal / v.n) : 0,
      diasComRegistro: v.n,
    }));
}
