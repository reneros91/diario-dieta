import { g } from "@/lib/format";

const COR: Record<string, string> = {
  P: "var(--prot)",
  C: "var(--carb)",
  G: "var(--gord)",
};

/**
 * Barra de um macro com valor / alvo (SPEC §3.1).
 * O rótulo em texto é obrigatório: a cor nunca é a única pista.
 */
export function BarraMacro({
  sigla,
  valor,
  alvo,
  compacto = false,
}: {
  sigla: "P" | "C" | "G";
  valor: number;
  alvo: number;
  compacto?: boolean;
}) {
  const frac = alvo > 0 ? Math.min(valor / alvo, 1) : 0;
  const acima = valor > alvo * 1.05;

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[11px] font-semibold text-muted">{sigla}</span>
        <span className="num text-[11px] text-muted truncate">
          {compacto ? g(valor) : `${Math.round(valor)} / ${g(alvo)}`}
        </span>
      </div>
      <div
        className="mt-1 h-1.5 rounded-full bg-track overflow-hidden"
        role="progressbar"
        aria-label={sigla}
        aria-valuenow={Math.round(valor)}
        aria-valuemin={0}
        aria-valuemax={Math.round(alvo)}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${frac * 100}%`,
            background: acima ? "var(--over)" : COR[sigla],
            transition: "width 420ms ease-out",
          }}
        />
      </div>
    </div>
  );
}

export function LinhaMacros({
  prot,
  carb,
  gord,
  alvo,
  compacto,
}: {
  prot: number;
  carb: number;
  gord: number;
  alvo: { prot: number; carb: number; gord: number };
  compacto?: boolean;
}) {
  return (
    <div className="flex gap-3 w-full">
      <BarraMacro sigla="P" valor={prot} alvo={alvo.prot} compacto={compacto} />
      <BarraMacro sigla="C" valor={carb} alvo={alvo.carb} compacto={compacto} />
      <BarraMacro sigla="G" valor={gord} alvo={alvo.gord} compacto={compacto} />
    </div>
  );
}
