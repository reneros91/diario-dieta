import Link from "next/link";
import { CartaoRefeicao } from "@/components/CartaoRefeicao";
import { BotaoAdicionarNoDia } from "@/components/BotaoAdicionarNoDia";
import { NotaDoDia } from "@/components/NotaDoDia";
import { LinhaMacros } from "@/components/BarraMacro";
import {
  getNotaDia,
  getPerfilEAlvos,
  getRefeicoes,
  getTotaisDia,
  getTreinos,
} from "@/lib/data";
import { hojeISO, rotuloDia, somaDias } from "@/lib/calc";
import { ORDEM_TIPO, comSinal, kcal } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PaginaDiario({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>;
}) {
  const { dia: diaParam } = await searchParams;
  const hoje = hojeISO();
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(diaParam ?? "") ? diaParam! : hoje;

  const [{ alvo }, totais, refeicoes, treinos, nota] = await Promise.all([
    getPerfilEAlvos(),
    getTotaisDia(dia),
    getRefeicoes(dia),
    getTreinos(dia),
    getNotaDia(dia),
  ]);

  const consumido = totais ?? { kcal: 0, prot: 0, carb: 0, gord: 0 };
  const saldo = alvo.meta - consumido.kcal;
  const acima = saldo < 0;

  const porTipo = ORDEM_TIPO.map((t) => refeicoes.filter((r) => r.tipo === t)).flat();

  return (
    <div className="space-y-4">
      <nav className="flex items-center justify-between" aria-label="Navegar por dia">
        <Link
          href={`/diario?dia=${somaDias(dia, -1)}`}
          className="rounded-btn border border-line px-3 py-1.5 text-sm"
          aria-label="Dia anterior"
        >
          ‹
        </Link>
        <h1 className="display text-lg font-semibold">{rotuloDia(dia, hoje)}</h1>
        <Link
          href={`/diario?dia=${somaDias(dia, 1)}`}
          aria-disabled={dia >= hoje}
          tabIndex={dia >= hoje ? -1 : undefined}
          className="rounded-btn border border-line px-3 py-1.5 text-sm"
          style={dia >= hoje ? { opacity: 0.35, pointerEvents: "none" } : undefined}
          aria-label="Próximo dia"
        >
          ›
        </Link>
      </nav>

      <section className="rounded-card bg-card border border-line shadow-card p-4">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="display num text-3xl font-semibold leading-none">
              {kcal(consumido.kcal)}
            </p>
            <p className="text-[11px] text-muted mt-1">kcal consumidas</p>
          </div>
          <div className="text-right">
            <p
              className="num text-lg font-semibold"
              style={{ color: acima ? "var(--over)" : "var(--accent)" }}
            >
              {comSinal(saldo)}
            </p>
            <p className="text-[11px] text-muted">
              {acima ? "acima da meta" : "de saldo"} · meta {kcal(alvo.meta)}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <LinhaMacros
            prot={consumido.prot}
            carb={consumido.carb}
            gord={consumido.gord}
            alvo={alvo}
          />
        </div>
      </section>

      <BotaoAdicionarNoDia dia={dia} />

      {porTipo.length === 0 && (
        <p className="text-sm text-muted">Nenhuma refeição neste dia.</p>
      )}

      {porTipo.map((r) => (
        <CartaoRefeicao key={r.id} refeicao={r} />
      ))}

      {treinos.length > 0 && (
        <section className="rounded-card bg-card border border-line shadow-card p-4">
          <h2 className="text-sm font-semibold">Treinos</h2>
          <p className="text-[11px] text-muted">Não abatem da meta.</p>
          <ul className="mt-2 divide-y divide-line">
            {treinos.map((t) => (
              <li key={t.id} className="py-2 flex items-baseline justify-between gap-3">
                <span className="text-sm truncate">{t.nome}</span>
                <span className="num text-[11px] text-muted shrink-0">
                  {t.minutos ? `${t.minutos} min` : ""}
                  {t.kcal_estimadas ? ` · ${kcal(t.kcal_estimadas)} kcal` : ""}
                  {t.fonte === "watch" ? " · relógio" : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <NotaDoDia dia={dia} nota={nota} />
    </div>
  );
}
