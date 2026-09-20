"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarNotaDia } from "@/app/actions";
import type { DayNoteRow, NivelAtividade } from "@/lib/types/db";

const ATIVIDADES: { valor: NivelAtividade; rotulo: string }[] = [
  { valor: "sentado", rotulo: "Sentado" },
  { valor: "leve", rotulo: "Leve" },
  { valor: "ativo", rotulo: "Ativo" },
];

/** Nota do dia: passos, sono e nível de atividade (SPEC §3.4). */
export function NotaDoDia({ dia, nota }: { dia: string; nota: DayNoteRow | null }) {
  const router = useRouter();
  const [passos, setPassos] = useState(nota?.passos ? String(nota.passos) : "");
  const [sono, setSono] = useState(nota?.sono_h ? String(nota.sono_h) : "");
  const [atividade, setAtividade] = useState<NivelAtividade | null>(nota?.atividade ?? null);
  const [salvo, setSalvo] = useState(false);
  const [salvando, startTransition] = useTransition();

  function salvar() {
    startTransition(async () => {
      const r = await salvarNotaDia({
        dia,
        passos: passos ? Math.round(Number(passos.replace(/\D/g, ""))) : null,
        sono_h: sono ? Number(sono.replace(",", ".")) : null,
        atividade,
        obs: nota?.obs ?? null,
      });
      if (r.ok) {
        setSalvo(true);
        router.refresh();
        setTimeout(() => setSalvo(false), 2000);
      }
    });
  }

  return (
    <section className="rounded-card bg-card border border-line shadow-card p-4">
      <h2 className="text-sm font-semibold">Nota do dia</h2>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="nd-passos" className="block text-[11px] text-muted mb-1">
            Passos
          </label>
          <input
            id="nd-passos"
            inputMode="numeric"
            value={passos}
            onChange={(e) => setPassos(e.target.value)}
            className="num w-full rounded-btn border border-line bg-bg px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="nd-sono" className="block text-[11px] text-muted mb-1">
            Sono (h)
          </label>
          <input
            id="nd-sono"
            inputMode="decimal"
            value={sono}
            onChange={(e) => setSono(e.target.value)}
            className="num w-full rounded-btn border border-line bg-bg px-3 py-2"
          />
        </div>
      </div>

      <div className="mt-3">
        <p className="text-[11px] text-muted mb-1.5">Nível de atividade</p>
        <div className="flex gap-1.5">
          {ATIVIDADES.map((a) => (
            <button
              key={a.valor}
              type="button"
              onClick={() => setAtividade(atividade === a.valor ? null : a.valor)}
              aria-pressed={atividade === a.valor}
              className="flex-1 rounded-btn border px-2 py-1.5 text-xs"
              style={{
                borderColor: atividade === a.valor ? "var(--accent)" : "var(--line)",
                color: atividade === a.valor ? "var(--accent)" : "var(--ink)",
              }}
            >
              {a.rotulo}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className="mt-3 w-full rounded-btn border border-line px-4 py-2 text-sm disabled:opacity-60"
      >
        {salvando ? "Salvando…" : salvo ? "Salvo" : "Salvar nota"}
      </button>
    </section>
  );
}
