"use client";

import { useState } from "react";
import { num, rotuloCurto } from "@/lib/grafico";

export type Barra = { dia: string; kcal: number };

const L = { esq: 6, dir: 6, topo: 16, base: 20 };

/**
 * kcal por dia com a linha da meta (SPEC §3.5).
 * Barra acima da meta fica vermelha e leva rótulo próprio — a cor nunca é a
 * única pista. Dia sem registro aparece como vazio, não como zero de dieta.
 */
export function GraficoBarras({
  barras,
  meta,
  titulo,
  altura = 170,
  unidadeRotulo = "dia",
}: {
  barras: Barra[];
  meta: number;
  titulo: string;
  altura?: number;
  unidadeRotulo?: "dia" | "semana";
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const largura = 320;

  if (barras.length === 0) {
    return (
      <figure>
        <figcaption className="text-sm font-semibold">{titulo}</figcaption>
        <p className="mt-2 text-sm text-muted">Sem dias registrados no período.</p>
      </figure>
    );
  }

  const teto = Math.max(meta * 1.25, ...barras.map((b) => b.kcal)) || 1;
  const areaAltura = altura - L.topo - L.base;
  const passo = (largura - L.esq - L.dir) / barras.length;
  // 2px de respiro entre barras vizinhas (sem virar traço em 90 dias).
  const larguraBarra = Math.max(2, passo - 2);
  const yMeta = L.topo + (1 - meta / teto) * areaAltura;

  const p = ativo === null ? null : barras[ativo];

  return (
    <figure>
      <figcaption className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">{titulo}</span>
        <span className="num text-[11px] text-muted">
          meta {num(meta, 0)} kcal{unidadeRotulo === "semana" ? "/dia (média)" : ""}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${largura} ${altura}`}
        className="mt-2 w-full touch-none"
        style={{ height: altura }}
        role="img"
        aria-label={`${titulo}. ${barras.length} ${
          unidadeRotulo === "semana" ? "semanas" : "dias"
        }, meta de ${num(meta, 0)} kcal.`}
        onMouseLeave={() => setAtivo(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * largura;
          setAtivo(Math.min(barras.length - 1, Math.max(0, Math.floor((x - L.esq) / passo))));
        }}
        onTouchEnd={() => setAtivo(null)}
        onTouchMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = ((e.touches[0].clientX - r.left) / r.width) * largura;
          setAtivo(Math.min(barras.length - 1, Math.max(0, Math.floor((x - L.esq) / passo))));
        }}
      >
        {barras.map((b, i) => {
          if (b.kcal <= 0) return null;
          const h = (b.kcal / teto) * areaAltura;
          const x = L.esq + i * passo + (passo - larguraBarra) / 2;
          const y = L.topo + areaAltura - h;
          const acima = b.kcal > meta;
          return (
            <rect
              key={b.dia}
              x={x}
              y={y}
              width={larguraBarra}
              height={h}
              rx={Math.min(4, larguraBarra / 2)}
              fill={acima ? "var(--over)" : "var(--accent)"}
              opacity={ativo === null || ativo === i ? 1 : 0.55}
            />
          );
        })}

        <line
          x1={L.esq}
          x2={largura - L.dir}
          y1={yMeta}
          y2={yMeta}
          stroke="var(--ink)"
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={0.5}
        />

        <line
          x1={L.esq}
          x2={largura - L.dir}
          y1={L.topo + areaAltura}
          y2={L.topo + areaAltura}
          stroke="var(--line)"
          strokeWidth={1}
        />

        {p && (
          <text
            x={largura / 2}
            y={L.topo - 4}
            textAnchor="middle"
            className="num"
            fontSize="11"
            fill="var(--ink)"
          >
            {rotuloCurto(p.dia)} · {num(p.kcal, 0)} kcal
            {p.kcal > meta ? ` (+${num(p.kcal - meta, 0)})` : ""}
          </text>
        )}

        <text x={L.esq} y={altura - 5} fontSize="10" fill="var(--muted)">
          {rotuloCurto(barras[0].dia)}
        </text>
        <text x={largura - L.dir} y={altura - 5} fontSize="10" fill="var(--muted)" textAnchor="end">
          {rotuloCurto(barras[barras.length - 1].dia)}
        </text>
      </svg>
    </figure>
  );
}
