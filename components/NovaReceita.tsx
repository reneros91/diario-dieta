"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarReceita } from "@/app/actions";
import { somaMacros } from "@/lib/calc";
import { kcal, num } from "@/lib/format";
import type { ItemReceitaCalculado } from "@/app/api/recipe/calc/route";

/**
 * Nova receita ("marmita", SPEC §3.9): ingredientes crus → a IA devolve peso
 * pronto e macros → a pessoa confere e edita → salva.
 */
export function NovaReceita({ onVoltar, onSalva }: { onVoltar: () => void; onSalva: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({
    nome: "",
    ingredientes: "",
    porcoes: "5",
    peso_pronto: "",
    publica: false,
  });
  const [itens, setItens] = useState<ItemReceitaCalculado[] | null>(null);
  const [comentario, setComentario] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [salvando, startTransition] = useTransition();

  const porcoes = Number(form.porcoes.replace(",", ".")) || 1;

  async function calcular() {
    if (!form.nome.trim() || form.ingredientes.trim().length < 3) {
      setErro("Falta o nome ou os ingredientes.");
      return;
    }
    setErro(null);
    setCalculando(true);

    try {
      const r = await fetch("/api/recipe/calc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome.trim(),
          ingredientes: form.ingredientes.trim(),
          porcoes,
          peso_pronto: form.peso_pronto ? Number(form.peso_pronto.replace(",", ".")) : null,
        }),
      });

      const dados = await r.json();
      if (!r.ok) {
        setErro(dados.message ?? "Não deu para calcular.");
        return;
      }
      setItens(dados.itens);
      setComentario(dados.resposta ?? "");
      if (!form.peso_pronto && dados.peso_pronto_total) {
        setForm((f) => ({ ...f, peso_pronto: String(Math.round(dados.peso_pronto_total)) }));
      }
    } catch {
      setErro("Sem resposta da IA. Tente de novo.");
    } finally {
      setCalculando(false);
    }
  }

  function salvar() {
    if (!itens?.length) return;
    startTransition(async () => {
      const r = await salvarReceita({
        nome: form.nome.trim(),
        porcoes,
        peso_pronto_g: form.peso_pronto ? Number(form.peso_pronto.replace(",", ".")) : null,
        obs: comentario || null,
        publica: form.publica,
        itens,
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      router.refresh();
      onSalva();
    });
  }

  const total = itens
    ? somaMacros(itens.map((i) => ({ ...i, qtd: i.qtd_pronto })))
    : null;

  return (
    <div className="space-y-4">
      <button type="button" onClick={onVoltar} className="text-sm text-muted">
        ‹ Voltar
      </button>
      <h2 className="display text-xl font-semibold">Nova receita</h2>

      <div>
        <label htmlFor="rc-nome" className="block text-[11px] text-muted mb-1">
          Nome
        </label>
        <input
          id="rc-nome"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          placeholder="Marmita de frango com arroz"
          className="w-full rounded-btn border border-line bg-bg px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="rc-ing" className="block text-[11px] text-muted mb-1">
          Ingredientes crus, um por linha, com peso
        </label>
        <textarea
          id="rc-ing"
          rows={5}
          value={form.ingredientes}
          onChange={(e) => setForm({ ...form, ingredientes: e.target.value })}
          placeholder={"1 kg de peito de frango cru\n400 g de arroz branco cru\n2 colheres de azeite"}
          className="w-full rounded-btn border border-line bg-bg px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="rc-porcoes" className="block text-[11px] text-muted mb-1">
            Rendeu quantas porções
          </label>
          <input
            id="rc-porcoes"
            inputMode="decimal"
            value={form.porcoes}
            onChange={(e) => setForm({ ...form, porcoes: e.target.value })}
            className="num w-full rounded-btn border border-line bg-bg px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="rc-peso" className="block text-[11px] text-muted mb-1">
            Peso total pronto (g)
          </label>
          <input
            id="rc-peso"
            inputMode="decimal"
            value={form.peso_pronto}
            onChange={(e) => setForm({ ...form, peso_pronto: e.target.value })}
            placeholder="opcional"
            className="num w-full rounded-btn border border-line bg-bg px-3 py-2"
          />
        </div>
      </div>

      {!itens && (
        <button
          type="button"
          onClick={calcular}
          disabled={calculando}
          className="w-full rounded-btn bg-accent px-4 py-3 font-semibold text-white disabled:opacity-60"
        >
          {calculando ? "Calculando…" : "Calcular com a IA"}
        </button>
      )}

      {erro && (
        <p role="alert" className="text-sm" style={{ color: "var(--over)" }}>
          {erro}
        </p>
      )}

      {itens && total && (
        <div className="space-y-3">
          {comentario && <p className="text-sm text-muted">{comentario}</p>}

          <div className="rounded-card bg-bg p-3">
            <p className="text-[11px] text-muted">Por porção ({num(porcoes)} porções)</p>
            <p className="display num text-3xl font-semibold leading-none mt-1">
              {kcal(total.kcal / porcoes)}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 num text-sm">
              <span style={{ color: "var(--prot)" }}>P {num(total.prot / porcoes)} g</span>
              <span style={{ color: "var(--carb)" }}>C {num(total.carb / porcoes)} g</span>
              <span style={{ color: "var(--gord)" }}>G {num(total.gord / porcoes)} g</span>
            </div>
          </div>

          <ul className="divide-y divide-line">
            {itens.map((it, i) => (
              <li key={`${it.nome}-${i}`} className="py-2 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{it.nome}</p>
                  <p className="num text-[11px] text-muted">
                    {kcal((it.k100 * it.qtd_pronto) / 100)} kcal ·{" "}
                    {num((it.p100 * it.qtd_pronto) / 100)} P
                  </p>
                </div>
                <input
                  inputMode="decimal"
                  value={it.qtd_pronto}
                  onChange={(e) => {
                    const v = Number(e.target.value.replace(",", ".")) || 0;
                    setItens(itens.map((x, j) => (j === i ? { ...x, qtd_pronto: v } : x)));
                  }}
                  aria-label={`Peso pronto de ${it.nome}`}
                  className="num w-20 rounded-btn border border-line bg-bg px-2 py-1.5 text-right text-sm"
                />
                <span className="text-[11px] text-muted">g</span>
                <button
                  type="button"
                  onClick={() => setItens(itens.filter((_, j) => j !== i))}
                  aria-label={`Excluir ${it.nome}`}
                  className="text-muted px-1"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.publica}
              onChange={(e) => setForm({ ...form, publica: e.target.checked })}
            />
            Compartilhar com a casa
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setItens(null)}
              className="flex-1 rounded-btn border border-line px-4 py-3 text-sm"
            >
              Recalcular
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="flex-1 rounded-btn bg-accent px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              {salvando ? "Salvando…" : "Salvar receita"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
