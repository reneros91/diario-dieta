"use client";

import { useState } from "react";
import { CartaoRefeicao } from "@/components/CartaoRefeicao";
import { Hub } from "@/components/Hub";
import { PainelIA } from "@/components/PainelIA";
import { somaMacros } from "@/lib/calc";
import { TIPO_EMOJI, TIPO_LABEL, kcal } from "@/lib/format";
import type { MealComItens, TipoRefeicao } from "@/lib/types/db";

/**
 * Uma das seis refeições do dia, sempre visível mesmo vazia.
 *
 * O diário mostrava só o que já tinha sido registrado, e um dia em branco não
 * dizia por onde começar. Agora as refeições são a estrutura da tela, e cada
 * uma tem as duas portas de entrada: ＋ para a tabela e o que está salvo, IA
 * para descrever em palavras ou por foto.
 */
export function SecaoRefeicao({
  dia,
  tipo,
  refeicoes,
}: {
  dia: string;
  tipo: TipoRefeicao;
  refeicoes: MealComItens[];
}) {
  const [hub, setHub] = useState(false);
  const [ia, setIa] = useState(false);

  const total = somaMacros(
    refeicoes.flatMap((r) =>
      r.meal_items.map((i) => ({
        qtd: Number(i.qtd),
        k100: Number(i.k100),
        p100: Number(i.p100),
        c100: Number(i.c100),
        g100: Number(i.g100),
      })),
    ),
  );

  const vazia = refeicoes.every((r) => r.meal_items.length === 0);

  return (
    <section className="space-y-2">
      <header className="flex items-baseline gap-2 px-0.5">
        <span aria-hidden>{TIPO_EMOJI[tipo]}</span>
        <h2 className="text-sm font-semibold flex-1">{TIPO_LABEL[tipo]}</h2>
        {!vazia && (
          <span className="num text-[11px] text-muted">{kcal(total.kcal)} kcal</span>
        )}
      </header>

      {refeicoes.map((r) => (
        <CartaoRefeicao key={r.id} refeicao={r} />
      ))}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setHub(true)}
          className="flex-1 rounded-btn border border-line bg-card px-3 py-2.5 text-sm"
        >
          ＋ Alimento
        </button>
        <button
          type="button"
          onClick={() => setIa(true)}
          className="flex-1 rounded-btn border px-3 py-2.5 text-sm font-medium"
          style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
        >
          ✨ IA
        </button>
      </div>

      <Hub aberto={hub} dia={dia} tipoFixo={tipo} onFechar={() => setHub(false)} />
      {ia && <PainelIA dia={dia} tipo={tipo} onFechar={() => setIa(false)} />}
    </section>
  );
}
