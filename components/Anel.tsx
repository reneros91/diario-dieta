/**
 * Anel de kcal do dia (SPEC §3.1).
 * Mostra restantes; vira vermelho e diz "acima" quando passa da meta.
 */
export function Anel({
  consumido,
  meta,
  tamanho = 108,
}: {
  consumido: number;
  meta: number;
  tamanho?: number;
}) {
  const r = tamanho / 2 - 7;
  const circ = 2 * Math.PI * r;
  const frac = meta > 0 ? Math.min(consumido / meta, 1) : 0;
  const acima = consumido > meta;
  const saldo = Math.round(meta - consumido);

  const cor = acima ? "var(--over)" : "var(--accent)";

  return (
    <div
      className="relative shrink-0"
      style={{ width: tamanho, height: tamanho }}
      role="img"
      aria-label={
        acima
          ? `${Math.abs(saldo)} kcal acima da meta de ${meta}`
          : `${saldo} kcal restantes de ${meta}`
      }
    >
      <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} aria-hidden>
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={r}
          fill="none"
          stroke="var(--track)"
          strokeWidth={9}
        />
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={r}
          fill="none"
          stroke={cor}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - frac)}
          transform={`rotate(-90 ${tamanho / 2} ${tamanho / 2})`}
          style={{ transition: "stroke-dashoffset 420ms ease-out" }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="display num text-[28px] leading-none font-semibold"
          style={{ color: acima ? "var(--over)" : "var(--ink)" }}
        >
          {Math.abs(saldo)}
        </span>
        <span className="text-[11px] text-muted mt-0.5">{acima ? "acima" : "restantes"}</span>
      </div>
    </div>
  );
}
