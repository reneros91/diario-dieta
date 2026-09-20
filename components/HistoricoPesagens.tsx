"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { apagarPesagem } from "@/app/actions";
import { num } from "@/lib/format";
import { rotuloCurto } from "@/lib/grafico";
import type { WeighinRow } from "@/lib/types/db";

export function HistoricoPesagens({ pesagens }: { pesagens: WeighinRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  if (pesagens.length === 0) return null;

  return (
    <section className="rounded-card bg-card border border-line shadow-card p-4">
      <h2 className="text-sm font-semibold">Histórico</h2>
      <ul className="mt-2 divide-y divide-line">
        {pesagens.map((p) => (
          <li key={p.id} className="py-2 flex items-center gap-3">
            <span className="num text-[11px] text-muted w-12 shrink-0">{rotuloCurto(p.dia)}</span>
            <span className="num text-sm flex-1">
              {num(Number(p.peso), 1)} kg
              {p.gordura_pct !== null ? ` · ${num(Number(p.gordura_pct))}%` : ""}
              {p.massa_muscular !== null ? ` · ${num(Number(p.massa_muscular))} kg músculo` : ""}
            </span>
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  await apagarPesagem(p.id);
                  router.refresh();
                })
              }
              aria-label={`Apagar pesagem de ${p.dia}`}
              className="text-muted px-1"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
