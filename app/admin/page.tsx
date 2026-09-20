import Link from "next/link";
import { notFound } from "next/navigation";
import { usuarioAtual } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { num } from "@/lib/format";
import { hojeISO, somaDias } from "@/lib/calc";

export const dynamic = "force-dynamic";

const DIAS = 30;

/** Painel do dono: gasto de IA por usuário e por dia (SPEC §6). */
export default async function PaginaAdmin() {
  const user = await usuarioAtual();
  const admins = (process.env.ADMIN_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Quem não é dono não descobre nem que a página existe.
  if (!user || !admins.includes(user.id)) notFound();

  const admin = supabaseAdmin();
  const desde = somaDias(hojeISO(), -(DIAS - 1));

  const [{ data: chamadas }, { data: perfis }] = await Promise.all([
    admin
      .from("ai_calls")
      .select("user_id, tipo, modelo, tokens_in, tokens_out, custo_usd_est, created_at")
      .gte("created_at", `${desde}T00:00:00Z`)
      .order("created_at", { ascending: false })
      .limit(5000),
    admin.from("profiles").select("user_id, nome, ai_diario_limite"),
  ]);

  const nomes = new Map((perfis ?? []).map((p) => [p.user_id, p.nome ?? p.user_id.slice(0, 8)]));
  const limites = new Map((perfis ?? []).map((p) => [p.user_id, p.ai_diario_limite]));

  const porUsuario = new Map<string, { chamadas: number; custo: number; hoje: number }>();
  const porDia = new Map<string, { chamadas: number; custo: number }>();
  const hoje = hojeISO();

  for (const c of chamadas ?? []) {
    const dia = c.created_at.slice(0, 10);

    const u = porUsuario.get(c.user_id) ?? { chamadas: 0, custo: 0, hoje: 0 };
    u.chamadas += 1;
    u.custo += Number(c.custo_usd_est);
    if (dia === hoje) u.hoje += 1;
    porUsuario.set(c.user_id, u);

    const d = porDia.get(dia) ?? { chamadas: 0, custo: 0 };
    d.chamadas += 1;
    d.custo += Number(c.custo_usd_est);
    porDia.set(dia, d);
  }

  const totalUSD = [...porUsuario.values()].reduce((s, u) => s + u.custo, 0);

  return (
    <main className="mx-auto max-w-lg px-4 py-6 space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="display text-lg font-semibold">Custo de IA</h1>
        <Link href="/" className="text-sm text-muted">
          Voltar
        </Link>
      </div>

      <section className="rounded-card bg-card border border-line shadow-card p-4">
        <p className="text-[11px] text-muted">Últimos {DIAS} dias</p>
        <p className="display num text-3xl font-semibold leading-none mt-1">
          US$ {num(totalUSD, 2)}
        </p>
        <p className="num text-[11px] text-muted mt-1">{chamadas?.length ?? 0} chamadas</p>
      </section>

      <section className="rounded-card bg-card border border-line shadow-card p-4">
        <h2 className="text-sm font-semibold">Por usuário</h2>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-[11px] text-muted text-left">
              <th className="font-normal py-1">Pessoa</th>
              <th className="font-normal py-1 text-right">Hoje</th>
              <th className="font-normal py-1 text-right">Chamadas</th>
              <th className="font-normal py-1 text-right">US$</th>
            </tr>
          </thead>
          <tbody className="num">
            {[...porUsuario.entries()]
              .sort((a, b) => b[1].custo - a[1].custo)
              .map(([id, u]) => (
                <tr key={id} className="border-t border-line">
                  <td className="py-1.5">{nomes.get(id) ?? id.slice(0, 8)}</td>
                  <td className="py-1.5 text-right">
                    {u.hoje}/{limites.get(id) ?? "—"}
                  </td>
                  <td className="py-1.5 text-right">{u.chamadas}</td>
                  <td className="py-1.5 text-right">{num(u.custo, 3)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-card bg-card border border-line shadow-card p-4">
        <h2 className="text-sm font-semibold">Por dia</h2>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-[11px] text-muted text-left">
              <th className="font-normal py-1">Dia</th>
              <th className="font-normal py-1 text-right">Chamadas</th>
              <th className="font-normal py-1 text-right">US$</th>
            </tr>
          </thead>
          <tbody className="num">
            {[...porDia.entries()]
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([dia, d]) => (
                <tr key={dia} className="border-t border-line">
                  <td className="py-1.5">{dia}</td>
                  <td className="py-1.5 text-right">{d.chamadas}</td>
                  <td className="py-1.5 text-right">{num(d.custo, 3)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
