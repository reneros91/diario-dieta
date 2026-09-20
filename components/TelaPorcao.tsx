"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarRefeicao } from "@/app/actions";
import { macrosItem } from "@/lib/calc";
import { ORDEM_TIPO, TIPO_EMOJI, TIPO_LABEL, UNIDADE_LABEL, kcal, num } from "@/lib/format";
import type { OrigemRefeicao, TipoRefeicao, Unidade } from "@/lib/types/db";

export type AlimentoEscolhido = {
  nome: string;
  unidade: Unidade;
  porcao: number;
  k100: number;
  p100: number;
  c100: number;
  g100: number;
  origem: OrigemRefeicao;
};

/**
 * Tela de porção (SPEC §3.8): quantidade com preview ao vivo de kcal e macros,
 * seletor de refeição e o botão de adicionar.
 */
export function TelaPorcao({
  alimento,
  dia,
  tipoInicial,
  onVoltar,
  onPronto,
}: {
  alimento: AlimentoEscolhido;
  dia: string;
  tipoInicial: TipoRefeicao;
  onVoltar: () => void;
  onPronto: () => void;
}) {
  const router = useRouter();
  const [qtd, setQtd] = useState(String(alimento.porcao));
  const [tipo, setTipo] = useState<TipoRefeicao>(tipoInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();

  const valor = Number(qtd.replace(",", ".")) || 0;
  const m = macrosItem({
    qtd: valor,
    k100: alimento.k100,
    p100: alimento.p100,
    c100: alimento.c100,
    g100: alimento.g100,
  });

  function adicionar() {
    if (valor <= 0) {
      setErro("Quantidade precisa ser maior que zero.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      const r = await criarRefeicao({
        dia,
        tipo,
        nome: alimento.nome,
        origem: alimento.origem,
        itens: [
          {
            nome: alimento.nome,
            qtd: valor,
            unidade: alimento.unidade,
            k100: alimento.k100,
            p100: alimento.p100,
            c100: alimento.c100,
            g100: alimento.g100,
          },
        ],
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      router.refresh();
      onPronto();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onVoltar} className="text-sm text-muted" aria-label="Voltar">
          ‹ Voltar
        </button>
      </div>

      <h3 className="display text-xl font-semibold leading-tight">{alimento.nome}</h3>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label htmlFor="qtd-porcao" className="block text-[11px] text-muted mb-1">
            Quantidade ({UNIDADE_LABEL[alimento.unidade]})
          </label>
          <input
            id="qtd-porcao"
            type="text"
            inputMode="decimal"
            value={qtd}
            onChange={(e) => setQtd(e.target.value)}
            className="num w-full rounded-btn border border-line bg-bg px-3 py-2.5 text-lg"
            autoFocus
          />
        </div>
        <div className="flex gap-1.5 pb-1">
          {[50, 100, 150].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setQtd(String(v))}
              className="num rounded-btn border border-line px-2.5 py-2 text-xs"
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-card bg-bg p-3">
        <p className="display num text-3xl font-semibold leading-none">{kcal(m.kcal)}</p>
        <p className="text-[11px] text-muted mt-0.5">kcal</p>
        <div className="mt-3 grid grid-cols-3 gap-2 num text-sm">
          <span style={{ color: "var(--prot)" }}>P {num(m.prot)} g</span>
          <span style={{ color: "var(--carb)" }}>C {num(m.carb)} g</span>
          <span style={{ color: "var(--gord)" }}>G {num(m.gord)} g</span>
        </div>
      </div>

      <div>
        <p className="text-[11px] text-muted mb-1.5">Refeição</p>
        <div className="flex flex-wrap gap-1.5">
          {ORDEM_TIPO.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              aria-pressed={t === tipo}
              className="rounded-btn px-2.5 py-1.5 text-xs border"
              style={{
                borderColor: t === tipo ? "var(--accent)" : "var(--line)",
                color: t === tipo ? "var(--accent)" : "var(--ink)",
              }}
            >
              {TIPO_EMOJI[t]} {TIPO_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {erro && (
        <p role="alert" className="text-sm" style={{ color: "var(--over)" }}>
          {erro}
        </p>
      )}

      <button
        type="button"
        onClick={adicionar}
        disabled={salvando}
        className="w-full rounded-btn btn-acento px-4 py-3 font-semibold"
      >
        {salvando ? "Adicionando…" : "Adicionar"}
      </button>
    </div>
  );
}
