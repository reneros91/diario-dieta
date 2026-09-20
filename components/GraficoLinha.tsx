"use client";

import { useMemo, useState } from "react";
import { num, rotuloCurto } from "@/lib/grafico";

export type Ponto = { dia: string; valor: number };

const L = { esq: 8, dir: 10, topo: 14, base: 22 };

/**
 * Linha do tempo de uma série só (peso, % de gordura).
 * Uma série: sem legenda — o título nomeia. Extremos rotulados; o resto sai no
 * toque/hover, nunca um número em cada ponto.
 */
export function GraficoLinha({
  pontos,
  titulo,
  cor = "var(--accent)",
  sufixo = "",
  casas = 1,
  altura = 150,
}: {
  pontos: Ponto[];
  titulo: string;
  cor?: string;
  sufixo?: string;
  casas?: number;
  altura?: number;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const largura = 320;

  const { caminho, xy, min, max } = useMemo(() => {
    const vs = pontos.map((p) => p.valor);
    const bruto = { min: Math.min(...vs), max: Math.max(...vs) };
    const folga = (bruto.max - bruto.min) * 0.12 || Math.max(0.5, bruto.max * 0.01);
    const min = bruto.min - folga;
    const max = bruto.max + folga;

    const x = (i: number) =>
      L.esq + (i * (largura - L.esq - L.dir)) / Math.max(1, pontos.length - 1);
    const y = (v: number) =>
      L.topo + ((max - v) / (max - min || 1)) * (altura - L.topo - L.base);

    const xy = pontos.map((p, i) => ({ x: x(i), y: y(p.valor), ...p }));
    const caminho = xy.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
    return { caminho, xy, min, max };
  }, [pontos, altura]);

  if (pontos.length < 2) {
    return (
      <figure>
        <figcaption className="text-sm font-semibold">{titulo}</figcaption>
        <p className="mt-2 text-sm text-muted">Duas medidas ou mais para desenhar a linha.</p>
      </figure>
    );
  }

  const p = ativo === null ? null : xy[ativo];
  const primeiro = xy[0];
  const ultimo = xy[xy.length - 1];

  return (
    <figure>
      <figcaption className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">{titulo}</span>
        <span className="num text-sm" style={{ color: cor }}>
          {num(ultimo.valor, casas)}
          {sufixo}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${largura} ${altura}`}
        className="mt-2 w-full touch-none"
        style={{ height: altura }}
        role="img"
        aria-label={`${titulo}: de ${num(primeiro.valor, casas)}${sufixo} em ${rotuloCurto(
          primeiro.dia,
        )} a ${num(ultimo.valor, casas)}${sufixo} em ${rotuloCurto(ultimo.dia)}`}
        onMouseLeave={() => setAtivo(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * largura;
          setAtivo(maisProximo(xy, x));
        }}
        onTouchMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = ((e.touches[0].clientX - r.left) / r.width) * largura;
          setAtivo(maisProximo(xy, x));
        }}
        onTouchEnd={() => setAtivo(null)}
      >
        {/* grade discreta: mínimo, meio e máximo */}
        {[min, (min + max) / 2, max].map((v, i) => {
          const y = L.topo + ((max - v) / (max - min || 1)) * (altura - L.topo - L.base);
          return (
            <line
              key={i}
              x1={L.esq}
              x2={largura - L.dir}
              y1={y}
              y2={y}
              stroke="var(--line)"
              strokeWidth={1}
            />
          );
        })}

        <path d={caminho} fill="none" stroke={cor} strokeWidth={2} strokeLinejoin="round" />

        {xy.map((ponto, i) => (
          <circle
            key={ponto.dia}
            cx={ponto.x}
            cy={ponto.y}
            r={ativo === i ? 5 : 3}
            fill="var(--card)"
            stroke={cor}
            strokeWidth={2}
          />
        ))}

        {p && (
          <>
            <line
              x1={p.x}
              x2={p.x}
              y1={L.topo}
              y2={altura - L.base}
              stroke="var(--muted)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <text
              x={Math.min(Math.max(p.x, 30), largura - 30)}
              y={L.topo - 2}
              textAnchor="middle"
              className="num"
              fontSize="11"
              fill="var(--ink)"
            >
              {num(p.valor, casas)}
              {sufixo}
            </text>
          </>
        )}

        <text x={L.esq} y={altura - 6} fontSize="10" fill="var(--muted)">
          {rotuloCurto(primeiro.dia)}
        </text>
        <text x={largura - L.dir} y={altura - 6} fontSize="10" fill="var(--muted)" textAnchor="end">
          {rotuloCurto(ultimo.dia)}
        </text>
      </svg>
    </figure>
  );
}

function maisProximo(xy: { x: number }[], x: number): number {
  let melhor = 0;
  let dist = Infinity;
  xy.forEach((p, i) => {
    const d = Math.abs(p.x - x);
    if (d < dist) {
      dist = d;
      melhor = i;
    }
  });
  return melhor;
}
