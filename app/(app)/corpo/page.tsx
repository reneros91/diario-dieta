import { FormPesagem } from "@/components/FormPesagem";
import { GraficoLinha } from "@/components/GraficoLinha";
import { AnaliseIA } from "@/components/AnaliseIA";
import { CartaoTendencia } from "@/components/CartaoTendencia";
import { HistoricoPesagens } from "@/components/HistoricoPesagens";
import { getPerfilEAlvos, getPesagens } from "@/lib/data";
import { hojeISO, mlg, sugerirMeta, tendencia } from "@/lib/calc";
import { kg, num } from "@/lib/format";
import { perfilParaCalc } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function PaginaCorpo() {
  const [{ perfil, alvo }, pesagens] = await Promise.all([getPerfilEAlvos(), getPesagens()]);

  const serie = pesagens.map((p) => ({ dia: p.dia, peso: Number(p.peso) }));
  const t = tendencia(serie, 28, hojeISO());
  const sugestao = t ? sugerirMeta(t, alvo, perfilParaCalc(perfil)) : null;

  const ultima = pesagens[pesagens.length - 1];
  const massaMagra = ultima
    ? mlg(Number(ultima.peso), ultima.gordura_pct === null ? null : Number(ultima.gordura_pct))
    : null;

  const comGordura = pesagens.filter((p) => p.gordura_pct !== null);

  return (
    <div className="space-y-4">
      <h1 className="display text-lg font-semibold">Corpo</h1>

      <FormPesagem hoje={hojeISO()} ultima={ultima ?? null} />

      {ultima && (
        <section className="rounded-card bg-card border border-line shadow-card p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="display num text-xl font-semibold">{kg(Number(ultima.peso))}</p>
              <p className="text-[11px] text-muted">peso</p>
            </div>
            <div>
              <p className="display num text-xl font-semibold">
                {ultima.gordura_pct === null ? "—" : `${num(Number(ultima.gordura_pct))}%`}
              </p>
              <p className="text-[11px] text-muted">gordura</p>
            </div>
            <div>
              <p className="display num text-xl font-semibold">
                {massaMagra === null ? "—" : kg(massaMagra)}
              </p>
              <p className="text-[11px] text-muted">massa magra</p>
            </div>
          </div>
        </section>
      )}

      {serie.length >= 2 && (
        <section className="rounded-card bg-card border border-line shadow-card p-4">
          <GraficoLinha
            titulo="Peso"
            pontos={serie.map((p) => ({ dia: p.dia, valor: p.peso }))}
            sufixo=" kg"
            casas={1}
          />
        </section>
      )}

      {comGordura.length >= 2 && (
        <section className="rounded-card bg-card border border-line shadow-card p-4">
          <GraficoLinha
            titulo="Gordura corporal"
            pontos={comGordura.map((p) => ({ dia: p.dia, valor: Number(p.gordura_pct) }))}
            cor="var(--gord)"
            sufixo="%"
            casas={1}
          />
        </section>
      )}

      <CartaoTendencia tendencia={t} sugestao={sugestao} metaAtual={alvo.meta} tmb={alvo.tmb} />

      <AnaliseIA />

      <HistoricoPesagens pesagens={[...pesagens].reverse()} />
    </div>
  );
}
