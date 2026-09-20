"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  apagarRefeicao,
  atualizarQtdItem,
  favoritarRefeicao,
  mudarTipoRefeicao,
  removerItem,
} from "@/app/actions";
import { macrosItem, somaMacros } from "@/lib/calc";
import { ORDEM_TIPO, TIPO_EMOJI, TIPO_LABEL, UNIDADE_LABEL, kcal, num } from "@/lib/format";
import { FONTE_LABEL } from "@/lib/ai/taco";
import type { MealComItens, MealItemRow, TipoRefeicao } from "@/lib/types/db";

/**
 * Cartão de refeição (SPEC §3.3): o componente central do app.
 * Editar a quantidade de uma linha recalcula tudo localmente e grava o número —
 * nunca chama a IA.
 */
type Ajuste = { tipo: "qtd"; id: string; qtd: number } | { tipo: "remover"; id: string };

export function CartaoRefeicao({ refeicao }: { refeicao: MealComItens }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // As linhas vêm do servidor, não de estado local. O que a pessoa acabou de
  // fazer aparece na hora como otimismo e, quando a transição termina, o que
  // vale é o que o banco devolveu — inclusive se a gravação falhou.
  const [itens, ajustar] = useOptimistic(refeicao.meal_items, (atuais, a: Ajuste) =>
    a.tipo === "remover"
      ? atuais.filter((i) => i.id !== a.id)
      : atuais.map((i) => (i.id === a.id ? { ...i, qtd: a.qtd } : i)),
  );
  const [tipo, definirTipo] = useOptimistic(refeicao.tipo, (_atual, novo: TipoRefeicao) => novo);
  const [apagado, marcarApagado] = useOptimistic(false, () => true);

  const [menuAberto, setMenuAberto] = useState(false);
  const [favoritado, setFavoritado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (apagado || itens.length === 0) return null;

  const total = somaMacros(
    itens.map((i) => ({
      qtd: Number(i.qtd),
      k100: Number(i.k100),
      p100: Number(i.p100),
      c100: Number(i.c100),
      g100: Number(i.g100),
    })),
  );

  function mudarQtd(item: MealItemRow, qtd: number) {
    if (!Number.isFinite(qtd) || qtd <= 0) return;
    startTransition(async () => {
      ajustar({ tipo: "qtd", id: item.id, qtd });
      setErro(null);
      const r = await atualizarQtdItem(item.id, qtd);
      if (!r.ok) {
        // Sem refresh: o otimismo volta atrás sozinho e a linha reaparece
        // com o valor antigo, que é a verdade.
        setErro(r.erro);
        return;
      }
      router.refresh();
    });
  }

  function excluirLinha(item: MealItemRow) {
    startTransition(async () => {
      ajustar({ tipo: "remover", id: item.id });
      setErro(null);
      const r = await removerItem(item.id);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <article className="anim-card rounded-card bg-card border border-line shadow-card p-4">
      <header className="flex items-start gap-3">
        <span className="text-xl leading-none pt-0.5" aria-hidden>
          {TIPO_EMOJI[tipo]}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-tight truncate">{refeicao.nome}</h3>
          <p className="text-[11px] text-muted">
            {TIPO_LABEL[tipo]}
            {refeicao.hora ? ` · ${refeicao.hora.slice(0, 5)}` : ""}
          </p>
        </div>

        <div className="text-right">
          <p className="display num text-2xl font-semibold leading-none">{kcal(total.kcal)}</p>
          <p className="text-[11px] text-muted">kcal</p>
        </div>

        <button
          type="button"
          onClick={() => setMenuAberto((v) => !v)}
          aria-expanded={menuAberto}
          aria-label="Ações da refeição"
          className="shrink-0 -mr-1 rounded-btn px-2 py-1 text-muted"
        >
          ⋯
        </button>
      </header>

      <div className="mt-3 flex gap-2">
        <Caixinha sigla="P" valor={total.prot} cor="var(--prot)" />
        <Caixinha sigla="C" valor={total.carb} cor="var(--carb)" />
        <Caixinha sigla="G" valor={total.gord} cor="var(--gord)" />
      </div>

      {menuAberto && (
        <div className="mt-3 rounded-btn border border-line p-3 space-y-3">
          <div>
            <p className="text-[11px] text-muted mb-1.5">Mudar refeição</p>
            <div className="flex flex-wrap gap-1.5">
              {ORDEM_TIPO.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      definirTipo(t);
                      const r = await mudarTipoRefeicao(refeicao.id, t);
                      if (!r.ok) {
                        setErro(r.erro);
                        return;
                      }
                      router.refresh();
                    })
                  }
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

          <div className="flex gap-2">
            <button
              type="button"
              disabled={favoritado}
              onClick={() =>
                startTransition(async () => {
                  const r = await favoritarRefeicao(refeicao.id);
                  if (!r.ok) {
                    setErro(r.erro);
                    return;
                  }
                  setFavoritado(true);
                })
              }
              className="flex-1 rounded-btn border border-line px-3 py-2 text-sm"
            >
              {favoritado ? "★ Favoritada" : "☆ Favoritar"}
            </button>
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  marcarApagado(null);
                  setErro(null);
                  const r = await apagarRefeicao(refeicao.id);
                  if (!r.ok) {
                    setErro(r.erro);
                    return;
                  }
                  router.refresh();
                })
              }
              className="flex-1 rounded-btn border px-3 py-2 text-sm"
              style={{ borderColor: "var(--over)", color: "var(--over)" }}
            >
              Apagar
            </button>
          </div>
        </div>
      )}

      {erro && (
        <p
          role="alert"
          className="mt-3 rounded-btn border px-3 py-2 text-sm"
          style={{ borderColor: "var(--over)", color: "var(--over)" }}
        >
          {erro}
        </p>
      )}

      <ul className="mt-3 divide-y divide-line">
        {itens.map((item) => (
          <LinhaItem
            key={`${item.id}:${Number(item.qtd)}`}
            item={item}
            onQtd={mudarQtd}
            onExcluir={excluirLinha}
          />
        ))}
      </ul>
    </article>
  );
}

/** Número da tabela é verificável; estimativa não. A tela diz qual é qual. */
function rotuloFonte(fonte: string): string {
  if (fonte === "taco") return "tabela de alimentos";
  if (fonte === "web") return "pesquisado";
  if (fonte === "rotulo") return "rótulo";
  if (fonte === "receita") return "receita salva";
  if (fonte === "manual") return "digitado";
  return `${FONTE_LABEL.estimativa} da IA`;
}

function corDaFonte(fonte: string): string {
  return fonte === "estimativa" ? "var(--carb)" : "var(--muted)";
}

function Caixinha({ sigla, valor, cor }: { sigla: string; valor: number; cor: string }) {
  return (
    <div className="flex-1 rounded-btn bg-bg px-2 py-1.5 text-center">
      <p className="text-[10px] font-semibold" style={{ color: cor }}>
        {sigla}
      </p>
      <p className="num text-sm font-medium">{num(valor, 0)} g</p>
    </div>
  );
}

function LinhaItem({
  item,
  onQtd,
  onExcluir,
}: {
  item: MealItemRow;
  onQtd: (item: MealItemRow, qtd: number) => void;
  onExcluir: (item: MealItemRow) => void;
}) {
  const [rascunho, setRascunho] = useState(String(Number(item.qtd)));
  const m = macrosItem({
    qtd: Number(item.qtd),
    k100: Number(item.k100),
    p100: Number(item.p100),
    c100: Number(item.c100),
    g100: Number(item.g100),
  });

  function confirmar() {
    const v = Number(rascunho.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) {
      setRascunho(String(Number(item.qtd)));
      return;
    }
    if (v !== Number(item.qtd)) onQtd(item, v);
  }

  return (
    <li className="py-2.5 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-tight truncate">{item.nome}</p>
        <p className="num text-[11px] text-muted">
          {kcal(m.kcal)} kcal · {num(m.prot)} P · {num(m.carb)} C · {num(m.gord)} G
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: corDaFonte(item.fonte) }}>
          {rotuloFonte(item.fonte)}
          {item.fonte_detalhe ? ` · ${item.fonte_detalhe}` : ""}
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <input
          type="text"
          inputMode="decimal"
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          onBlur={confirmar}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          aria-label={`Quantidade de ${item.nome}`}
          className="num w-16 rounded-btn border border-line bg-bg px-2 py-1.5 text-right text-sm"
        />
        <span className="text-[11px] text-muted w-10">{UNIDADE_LABEL[item.unidade]}</span>
        <button
          type="button"
          onClick={() => onExcluir(item)}
          aria-label={`Excluir ${item.nome}`}
          className="rounded-btn px-2 py-1 text-muted"
        >
          ✕
        </button>
      </div>
    </li>
  );
}
