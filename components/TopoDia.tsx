import { Anel } from "@/components/Anel";
import { LinhaMacros } from "@/components/BarraMacro";
import { getTopoHoje } from "@/lib/data";
import { kcal } from "@/lib/format";

/**
 * Topo fixo, em todas as abas (SPEC §3.1).
 * Server component: relê os totais a cada navegação ou router.refresh().
 */
export async function TopoDia() {
  const { alvo, consumido } = await getTopoHoje();

  return (
    <header
      className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-line"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto max-w-lg px-4 py-3 flex items-center gap-4">
        <Anel consumido={consumido.kcal} meta={alvo.meta} />

        <div className="min-w-0 flex-1">
          <p className="num text-sm text-muted">
            <span className="text-ink font-semibold">{kcal(consumido.kcal)}</span> / {kcal(alvo.meta)} kcal
          </p>
          <div className="mt-2">
            <LinhaMacros
              prot={consumido.prot}
              carb={consumido.carb}
              gord={consumido.gord}
              alvo={alvo}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
