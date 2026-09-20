"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarPesagem } from "@/app/actions";
import type { WeighinRow } from "@/lib/types/db";

const CAMPOS = [
  { chave: "peso", rotulo: "Peso (kg)", obrigatorio: true },
  { chave: "gordura_pct", rotulo: "Gordura (%)", obrigatorio: false },
  { chave: "massa_muscular", rotulo: "Músculo (kg)", obrigatorio: false },
  { chave: "agua_pct", rotulo: "Água (%)", obrigatorio: false },
  { chave: "visceral", rotulo: "Visceral", obrigatorio: false },
  { chave: "idade_metabolica", rotulo: "Idade metab.", obrigatorio: false },
] as const;

type Chave = (typeof CAMPOS)[number]["chave"];

/** Registrar pesagem (SPEC §3.6). Os campos opcionais são os que a balança dá. */
export function FormPesagem({ hoje, ultima }: { hoje: string; ultima: WeighinRow | null }) {
  const router = useRouter();
  const [dia, setDia] = useState(hoje);
  const [valores, setValores] = useState<Record<Chave, string>>({
    peso: ultima ? String(Number(ultima.peso)) : "",
    gordura_pct: "",
    massa_muscular: "",
    agua_pct: "",
    visceral: "",
    idade_metabolica: "",
  });
  const [extras, setExtras] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [salvando, startTransition] = useTransition();

  const n = (v: string) => (v.trim() ? Number(v.replace(",", ".")) : null);

  function salvar() {
    const peso = n(valores.peso);
    if (peso === null) {
      setErro("Falta o peso.");
      return;
    }
    setErro(null);

    startTransition(async () => {
      const r = await salvarPesagem({
        dia,
        peso,
        gordura_pct: n(valores.gordura_pct),
        massa_muscular: n(valores.massa_muscular),
        agua_pct: n(valores.agua_pct),
        visceral: n(valores.visceral),
        idade_metabolica: n(valores.idade_metabolica) === null ? null : Math.round(n(valores.idade_metabolica)!),
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setSalvo(true);
      router.refresh();
      setTimeout(() => setSalvo(false), 2000);
    });
  }

  const visiveis = extras ? CAMPOS : CAMPOS.slice(0, 2);

  return (
    <section className="rounded-card bg-card border border-line shadow-card p-4">
      <h2 className="text-sm font-semibold">Nova pesagem</h2>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label htmlFor="pes-dia" className="block text-[11px] text-muted mb-1">
            Dia
          </label>
          <input
            id="pes-dia"
            type="date"
            value={dia}
            max={hoje}
            onChange={(e) => setDia(e.target.value)}
            className="num w-full rounded-btn border border-line bg-bg px-3 py-2"
          />
        </div>

        {visiveis.map((c) => (
          <div key={c.chave}>
            <label htmlFor={`pes-${c.chave}`} className="block text-[11px] text-muted mb-1">
              {c.rotulo}
            </label>
            <input
              id={`pes-${c.chave}`}
              inputMode="decimal"
              value={valores[c.chave]}
              onChange={(e) => setValores({ ...valores, [c.chave]: e.target.value })}
              className="num w-full rounded-btn border border-line bg-bg px-3 py-2"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setExtras((v) => !v)}
        className="mt-2 text-[11px] text-muted"
      >
        {extras ? "Menos campos" : "Mais campos da balança"}
      </button>

      {erro && (
        <p role="alert" className="mt-2 text-sm" style={{ color: "var(--over)" }}>
          {erro}
        </p>
      )}

      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className="mt-3 w-full rounded-btn bg-accent px-4 py-2.5 font-semibold text-white disabled:opacity-60"
      >
        {salvando ? "Salvando…" : salvo ? "Salvo" : "Salvar pesagem"}
      </button>
    </section>
  );
}
