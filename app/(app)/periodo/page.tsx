import Link from "next/link";
import { GraficoBarras } from "@/components/GraficoBarras";
import { getPerfilEAlvos, getPesagens, getTotaisPeriodo } from "@/lib/data";
import { hojeISO, resumoPeriodo, somaDias, variacaoPrevistaKg } from "@/lib/calc";
import { porSemana } from "@/lib/grafico";
import { comSinal, g, kcal, num } from "@/lib/format";

export const dynamic = "force-dynamic";

const JANELAS = [7, 30, 90] as const;

export default async function PaginaPeriodo({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string; de?: string; ate?: string }>;
}) {
  const sp = await searchParams;
  const hoje = hojeISO();

  const custom = /^\d{4}-\d{2}-\d{2}$/.test(sp.de ?? "") && /^\d{4}-\d{2}-\d{2}$/.test(sp.ate ?? "");
  const janela = JANELAS.includes(Number(sp.dias) as 7) ? Number(sp.dias) : 7;
  const ate = custom ? sp.ate! : hoje;
  const de = custom ? sp.de! : somaDias(hoje, -(janela - 1));

  const [{ perfil, alvo }, totais, pesagens] = await Promise.all([
    getPerfilEAlvos(),
    getTotaisPeriodo(de, ate),
    getPesagens(),
  ]);

  // Cada dia do intervalo existe no gráfico; sem registro fica vazio.
  const mapa = new Map(totais.map((t) => [t.dia, t]));
  const dias: { dia: string; kcal: number; prot: number; carb: number; gord: number }[] = [];
  for (let d = de; d <= ate; d = somaDias(d, 1)) {
    const t = mapa.get(d);
    dias.push({
      dia: d,
      kcal: Number(t?.kcal ?? 0),
      prot: Number(t?.prot ?? 0),
      carb: Number(t?.carb ?? 0),
      gord: Number(t?.gord ?? 0),
    });
  }

  const resumo = resumoPeriodo(dias, alvo.meta, Number(perfil.peso_kg));
  const previsto = variacaoPrevistaKg(resumo.deficitAcumulado);

  const noPeriodo = pesagens.filter((p) => p.dia >= de && p.dia <= ate);
  const real =
    noPeriodo.length >= 2
      ? Number(noPeriodo[noPeriodo.length - 1].peso) - Number(noPeriodo[0].peso)
      : null;

  const agregarPorSemana = dias.length > 45;
  const barras = agregarPorSemana ? porSemana(dias) : dias.map((d) => ({ dia: d.dia, kcal: d.kcal }));

  return (
    <div className="space-y-4">
      <h1 className="display text-lg font-semibold">Período</h1>

      <nav className="flex gap-1.5" aria-label="Janela do período">
        {JANELAS.map((j) => (
          <Link
            key={j}
            href={`/periodo?dias=${j}`}
            aria-current={!custom && j === janela ? "page" : undefined}
            className="num flex-1 rounded-btn border px-3 py-2 text-center text-sm"
            style={{
              borderColor: !custom && j === janela ? "var(--accent)" : "var(--line)",
              color: !custom && j === janela ? "var(--accent)" : "var(--ink)",
            }}
          >
            {j} dias
          </Link>
        ))}
      </nav>

      <form action="/periodo" className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="de" className="block text-[11px] text-muted mb-1">
            De
          </label>
          <input
            id="de"
            name="de"
            type="date"
            defaultValue={de}
            max={hoje}
            className="num w-full rounded-btn border border-line bg-card px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="ate" className="block text-[11px] text-muted mb-1">
            Até
          </label>
          <input
            id="ate"
            name="ate"
            type="date"
            defaultValue={ate}
            max={hoje}
            className="num w-full rounded-btn border border-line bg-card px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className="rounded-btn border border-line bg-card px-3 py-2 text-sm">
          Ver
        </button>
      </form>

      <section className="rounded-card bg-card border border-line shadow-card p-4">
        <p className="text-[11px] text-muted">
          Déficit acumulado · {resumo.diasComRegistro} de {dias.length} dias com registro
        </p>
        <p
          className="display num text-3xl font-semibold leading-none mt-1"
          style={{ color: resumo.deficitAcumulado >= 0 ? "var(--accent)" : "var(--over)" }}
        >
          {comSinal(resumo.deficitAcumulado)} kcal
        </p>
        <p className="num text-sm text-muted mt-1">
          {num(Math.abs(resumo.gorduraEquivalenteKg), 2)} kg de gordura em teoria (7.700 kcal/kg)
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-[11px] text-muted">Média por dia</dt>
            <dd className="num font-medium">{kcal(resumo.kcalMedia)} kcal</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted">Déficit médio</dt>
            <dd className="num font-medium">
              {comSinal(resumo.deficitMedio)} / {comSinal(alvo.deficit)} planejado
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-card bg-card border border-line shadow-card p-4">
        <GraficoBarras
          titulo={agregarPorSemana ? "kcal por dia (média semanal)" : "kcal por dia"}
          barras={barras}
          meta={alvo.meta}
          unidadeRotulo={agregarPorSemana ? "semana" : "dia"}
        />
      </section>

      <section className="rounded-card bg-card border border-line shadow-card p-4">
        <h2 className="text-sm font-semibold">Macros médios</h2>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-[11px] text-muted text-left">
              <th className="font-normal py-1">Macro</th>
              <th className="font-normal py-1 text-right">Média</th>
              <th className="font-normal py-1 text-right">% kcal</th>
              <th className="font-normal py-1 text-right">Alvo</th>
            </tr>
          </thead>
          <tbody className="num">
            <tr className="border-t border-line">
              <td className="py-1.5" style={{ color: "var(--prot)" }}>
                Proteína
              </td>
              <td className="py-1.5 text-right">{g(resumo.prot)}</td>
              <td className="py-1.5 text-right">{resumo.pctProt}%</td>
              <td className="py-1.5 text-right text-muted">{g(alvo.prot)}</td>
            </tr>
            <tr className="border-t border-line">
              <td className="py-1.5" style={{ color: "var(--carb)" }}>
                Carbo
              </td>
              <td className="py-1.5 text-right">{g(resumo.carb)}</td>
              <td className="py-1.5 text-right">{resumo.pctCarb}%</td>
              <td className="py-1.5 text-right text-muted">{g(alvo.carb)}</td>
            </tr>
            <tr className="border-t border-line">
              <td className="py-1.5" style={{ color: "var(--gord)" }}>
                Gordura
              </td>
              <td className="py-1.5 text-right">{g(resumo.gord)}</td>
              <td className="py-1.5 text-right">{resumo.pctGord}%</td>
              <td className="py-1.5 text-right text-muted">{g(alvo.gord)}</td>
            </tr>
          </tbody>
        </table>
        <p className="num text-[11px] text-muted mt-2">
          Proteína por kg: {num(resumo.protGkg, 2)} g/kg
        </p>
      </section>

      <section className="rounded-card bg-card border border-line shadow-card p-4">
        <h2 className="text-sm font-semibold">Balança no período</h2>
        {real === null ? (
          <p className="mt-1 text-sm text-muted">
            Duas pesagens ou mais no intervalo para comparar com o déficit.
          </p>
        ) : (
          <>
            <div className="mt-2 grid grid-cols-2 gap-3 num">
              <div>
                <p className="text-[11px] text-muted">Real</p>
                <p className="display text-xl font-semibold">{comSinal(real, 2)} kg</p>
              </div>
              <div>
                <p className="text-[11px] text-muted">Previsto pelo déficit</p>
                <p className="display text-xl font-semibold">{comSinal(previsto, 2)} kg</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-muted leading-relaxed">
              Diferença entre real e previsto costuma vir de subregistro do que foi comido,
              retenção hídrica ou GET superestimado. Uma semana não decide nada; a reta de 28
              dias decide.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
