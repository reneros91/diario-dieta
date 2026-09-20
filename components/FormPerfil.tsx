"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarPerfil } from "@/app/actions";
import {
  FATORES,
  FATOR_LABEL,
  alvos,
  deficitSugerido,
  kgSemanaDeDeficit,
  type PerfilCalc,
} from "@/lib/calc";
import { g, kcal, kg, num } from "@/lib/format";
import type { ProfileRow } from "@/lib/types/db";

type Campos = {
  nome: string;
  sexo: "m" | "f";
  idade: string;
  altura_cm: string;
  peso_kg: string;
  gordura_pct: string;
  fator: number;
  kg_sem: string;
  deficit_kcal: string;
  meta_manual: string;
  prot_gkg: string;
  gord_pct: string;
};

const n = (v: string) => Number(v.replace(",", ".")) || 0;
const nOuNull = (v: string) => (v.trim() === "" ? null : n(v));

/** Perfil: dados, meta e alvos derivados (SPEC §3.7). */
export function FormPerfil({ perfil }: { perfil: ProfileRow }) {
  const router = useRouter();
  const [f, setF] = useState<Campos>({
    nome: perfil.nome ?? "",
    sexo: perfil.sexo,
    idade: String(perfil.idade),
    altura_cm: String(Number(perfil.altura_cm)),
    peso_kg: String(Number(perfil.peso_kg)),
    gordura_pct: perfil.gordura_pct === null ? "" : String(Number(perfil.gordura_pct)),
    fator: Number(perfil.fator),
    kg_sem: String(Number(perfil.kg_sem)),
    deficit_kcal: perfil.deficit_kcal === null ? "" : String(perfil.deficit_kcal),
    meta_manual: perfil.meta_manual === null ? "" : String(perfil.meta_manual),
    prot_gkg: String(Number(perfil.prot_gkg)),
    gord_pct: String(perfil.gord_pct),
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [salvando, startTransition] = useTransition();

  const calc: PerfilCalc = useMemo(
    () => ({
      sexo: f.sexo,
      idade: n(f.idade),
      altura_cm: n(f.altura_cm),
      peso_kg: n(f.peso_kg),
      gordura_pct: nOuNull(f.gordura_pct),
      fator: f.fator,
      kg_sem: n(f.kg_sem),
      deficit_kcal: nOuNull(f.deficit_kcal),
      meta_manual: nOuNull(f.meta_manual),
      prot_gkg: n(f.prot_gkg),
      gord_pct: n(f.gord_pct),
    }),
    [f],
  );

  const a = useMemo(() => alvos(calc), [calc]);
  const sugerido = Math.round(deficitSugerido(n(f.kg_sem)));

  function salvar() {
    startTransition(async () => {
      const r = await salvarPerfil({
        nome: f.nome.trim() || null,
        sexo: f.sexo,
        idade: Math.round(n(f.idade)),
        altura_cm: n(f.altura_cm),
        peso_kg: n(f.peso_kg),
        gordura_pct: nOuNull(f.gordura_pct),
        fator: f.fator,
        kg_sem: n(f.kg_sem),
        deficit_kcal: nOuNull(f.deficit_kcal) === null ? null : Math.round(n(f.deficit_kcal)),
        meta_manual: nOuNull(f.meta_manual) === null ? null : Math.round(n(f.meta_manual)),
        prot_gkg: n(f.prot_gkg),
        gord_pct: Math.round(n(f.gord_pct)),
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      setSalvo(true);
      router.refresh();
      setTimeout(() => setSalvo(false), 2000);
    });
  }

  const campo = (chave: keyof Campos, rotulo: string, dica?: string) => (
    <div>
      <label htmlFor={`pf-${chave}`} className="block text-[11px] text-muted mb-1">
        {rotulo}
      </label>
      <input
        id={`pf-${chave}`}
        inputMode={chave === "nome" ? undefined : "decimal"}
        value={f[chave] as string}
        onChange={(e) => setF({ ...f, [chave]: e.target.value })}
        placeholder={dica}
        className="num w-full rounded-btn border border-line bg-bg px-3 py-2"
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <section className="rounded-card bg-card border border-line shadow-card p-4">
        <h2 className="text-sm font-semibold">Dados</h2>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="col-span-2">{campo("nome", "Nome")}</div>

          <div>
            <p className="text-[11px] text-muted mb-1">Sexo</p>
            <div className="flex gap-1.5">
              {(["m", "f"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setF({ ...f, sexo: s })}
                  aria-pressed={f.sexo === s}
                  className="flex-1 rounded-btn border px-2 py-2 text-sm"
                  style={{
                    borderColor: f.sexo === s ? "var(--accent)" : "var(--line)",
                    color: f.sexo === s ? "var(--accent)" : "var(--ink)",
                  }}
                >
                  {s === "m" ? "Homem" : "Mulher"}
                </button>
              ))}
            </div>
          </div>

          {campo("idade", "Idade")}
          {campo("altura_cm", "Altura (cm)")}
          {campo("peso_kg", "Peso (kg)")}
          <div className="col-span-2">
            {campo("gordura_pct", "Gordura (%)", "em branco usa Mifflin")}
          </div>
        </div>

        <div className="mt-3">
          <label htmlFor="pf-fator" className="block text-[11px] text-muted mb-1">
            Fator de atividade
          </label>
          <select
            id="pf-fator"
            value={f.fator}
            onChange={(e) => setF({ ...f, fator: Number(e.target.value) })}
            className="w-full rounded-btn border border-line bg-bg px-3 py-2 text-sm"
          >
            {FATORES.map((v) => (
              <option key={v} value={v}>
                {num(v, 3).replace(/,?0+$/, "")} — {FATOR_LABEL[String(v)]}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-card bg-card border border-line shadow-card p-4">
        <h2 className="text-sm font-semibold">Meta</h2>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {campo("kg_sem", "Ritmo (kg/semana)")}
          <div>
            <label htmlFor="pf-deficit_kcal" className="block text-[11px] text-muted mb-1">
              Déficit (kcal/dia)
            </label>
            <input
              id="pf-deficit_kcal"
              inputMode="decimal"
              value={f.deficit_kcal}
              onChange={(e) => setF({ ...f, deficit_kcal: e.target.value })}
              placeholder={String(sugerido)}
              className="num w-full rounded-btn border border-line bg-bg px-3 py-2"
            />
          </div>
        </div>

        <p className="text-[11px] text-muted mt-1.5 num">
          {n(f.kg_sem)} kg/semana sugere {sugerido} kcal/dia
          {f.deficit_kcal.trim() !== "" &&
            ` · ${num(kgSemanaDeDeficit(n(f.deficit_kcal)), 2)} kg/semana com o déficit digitado`}
        </p>

        <div className="mt-3 grid grid-cols-3 gap-3">
          {campo("meta_manual", "Meta fixa", "opcional")}
          {campo("prot_gkg", "Proteína g/kg")}
          {campo("gord_pct", "Gordura % kcal")}
        </div>
      </section>

      <section className="rounded-card bg-card border border-line shadow-card p-4">
        <h2 className="text-sm font-semibold">O que sai disso</h2>

        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm num">
          <div>
            <dt className="text-[11px] text-muted">Massa livre de gordura</dt>
            <dd className="font-medium">{a.mlg === null ? "—" : kg(a.mlg)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted">
              TMB ({a.formulaTmb === "katch" ? "Katch-McArdle" : "Mifflin-St Jeor"})
            </dt>
            <dd className="font-medium">{kcal(a.tmb)} kcal</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted">GET</dt>
            <dd className="font-medium">{kcal(a.get)} kcal</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted">Meta</dt>
            <dd className="font-medium" style={{ color: "var(--accent)" }}>
              {kcal(a.meta)} kcal
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted" style={{ color: "var(--prot)" }}>
              Proteína
            </dt>
            <dd className="font-medium">{g(a.prot)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted" style={{ color: "var(--carb)" }}>
              Carbo
            </dt>
            <dd className="font-medium">{g(a.carb)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted" style={{ color: "var(--gord)" }}>
              Gordura
            </dt>
            <dd className="font-medium">{g(a.gord)}</dd>
          </div>
        </dl>

        {a.noPisoTmb && (
          <p
            className="mt-3 rounded-btn border px-3 py-2 text-sm"
            style={{ borderColor: "var(--over)", color: "var(--over)" }}
          >
            A meta bateu no piso da TMB ({kcal(a.tmb)} kcal). Corte mais que isso e o resultado é
            perda de massa magra, não de gordura.
          </p>
        )}
      </section>

      {erro && (
        <p role="alert" className="text-sm" style={{ color: "var(--over)" }}>
          {erro}
        </p>
      )}

      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className="w-full rounded-btn btn-acento px-4 py-3 font-semibold"
      >
        {salvando ? "Salvando…" : salvo ? "Salvo" : "Salvar perfil"}
      </button>
    </div>
  );
}
