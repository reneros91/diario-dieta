"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usarMetaSugerida } from "@/app/actions";
import { comSinal, kcal, num } from "@/lib/format";
import type { SugestaoMeta, Tendencia } from "@/lib/calc";

/** Tendência por regressão e sugestão de meta (SPEC §3.6). */
export function CartaoTendencia({
  tendencia,
  sugestao,
  metaAtual,
  tmb,
}: {
  tendencia: Tendencia | null;
  sugestao: SugestaoMeta | null;
  metaAtual: number;
  tmb: number;
}) {
  const router = useRouter();
  const [aplicada, setAplicada] = useState(false);
  const [aplicando, startTransition] = useTransition();

  if (!tendencia) {
    return (
      <section className="rounded-card bg-card border border-line shadow-card p-4">
        <h2 className="text-sm font-semibold">Tendência</h2>
        <p className="mt-1 text-sm text-muted">
          Três pesagens em pelo menos 7 dias e a reta aparece.
        </p>
      </section>
    );
  }

  const perdendo = tendencia.kgSemana < 0;

  return (
    <section className="rounded-card bg-card border border-line shadow-card p-4">
      <h2 className="text-sm font-semibold">Tendência</h2>

      <p className="display num text-3xl font-semibold leading-none mt-2">
        {comSinal(tendencia.kgSemana, 2)} kg
      </p>
      <p className="text-[11px] text-muted mt-1">
        por semana · {tendencia.pesagens} pesagens em {tendencia.janelaDias} dias ·{" "}
        {perdendo ? "perdendo" : "ganhando"}
      </p>

      {sugestao ? (
        <div className="mt-3 rounded-btn bg-bg p-3">
          <p className="num text-sm">
            Planejado {comSinal(sugestao.planejado, 2)} kg/semana, real{" "}
            {comSinal(sugestao.real, 2)}. Gap de {num(Math.abs(sugestao.gap), 2)} kg/semana.
          </p>
          <p className="num text-sm mt-1.5">
            Sugestão: {comSinal(sugestao.ajusteKcal)} kcal/dia → meta{" "}
            <strong>{kcal(sugestao.novaMeta)} kcal</strong> (hoje {kcal(metaAtual)}).
          </p>
          {sugestao.cortadoPelaTmb && (
            <p className="text-[11px] mt-1.5" style={{ color: "var(--over)" }}>
              Cortado no piso da TMB ({kcal(tmb)} kcal).
            </p>
          )}

          <button
            type="button"
            disabled={aplicando || aplicada}
            onClick={() =>
              startTransition(async () => {
                const r = await usarMetaSugerida(sugestao.novaMeta);
                if (r.ok) {
                  setAplicada(true);
                  router.refresh();
                }
              })
            }
            className="mt-3 w-full rounded-btn btn-acento px-4 py-2 text-sm font-semibold"
          >
            {aplicada ? "Meta aplicada" : aplicando ? "Aplicando…" : "Usar esta meta"}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">O ritmo real bate com o planejado. Nada a mudar.</p>
      )}
    </section>
  );
}
