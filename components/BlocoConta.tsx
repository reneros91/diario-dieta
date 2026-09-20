"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { apagarConta, girarTokenIngest } from "@/app/actions";
import { supabaseBrowser } from "@/lib/supabase/client";

/** Token do Atalho, exportação, saída e exclusão da conta (SPEC §3.7 e §9). */
export function BlocoConta({
  email,
  token,
  limite,
}: {
  email: string;
  token: string | null;
  limite: number;
}) {
  const router = useRouter();
  const [tokenAtual, setTokenAtual] = useState(token);
  const [revelado, setRevelado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, startTransition] = useTransition();

  const url = typeof window === "undefined" ? "" : `${window.location.origin}/api/ingest/health`;

  async function sair() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <section className="rounded-card bg-card border border-line shadow-card p-4">
        <h2 className="text-sm font-semibold">Atalho do iOS</h2>
        <p className="text-[11px] text-muted mt-1">
          O Atalho lê o app Saúde de manhã e manda passos, sono e treinos para este endereço. O
          passo a passo está no README.
        </p>

        <p className="num mt-3 break-all rounded-btn bg-bg px-3 py-2 text-[11px]">POST {url}</p>

        <p className="num mt-2 break-all rounded-btn bg-bg px-3 py-2 text-[11px]">
          {tokenAtual ? (revelado ? tokenAtual : "•".repeat(24)) : "sem token"}
        </p>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setRevelado((v) => !v)}
            className="flex-1 rounded-btn border border-line px-3 py-2 text-sm"
          >
            {revelado ? "Esconder" : "Mostrar"}
          </button>
          <button
            type="button"
            disabled={!tokenAtual}
            onClick={async () => {
              if (!tokenAtual) return;
              await navigator.clipboard.writeText(tokenAtual);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 1500);
            }}
            className="flex-1 rounded-btn border border-line px-3 py-2 text-sm"
          >
            {copiado ? "Copiado" : "Copiar"}
          </button>
          <button
            type="button"
            disabled={ocupado}
            onClick={() =>
              startTransition(async () => {
                const r = await girarTokenIngest();
                if (r.ok) {
                  setTokenAtual(r.dados.token);
                  setRevelado(true);
                }
              })
            }
            className="flex-1 rounded-btn border border-line px-3 py-2 text-sm"
          >
            Trocar
          </button>
        </div>
      </section>

      <section className="rounded-card bg-card border border-line shadow-card p-4">
        <h2 className="text-sm font-semibold">Conta</h2>
        <p className="num text-[11px] text-muted mt-1">
          {email} · limite de {limite} chamadas de IA por dia
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <a
            href="/api/export?formato=json"
            className="rounded-btn border border-line px-3 py-2 text-center text-sm"
          >
            Exportar JSON
          </a>
          <a
            href="/api/export?formato=csv"
            className="rounded-btn border border-line px-3 py-2 text-center text-sm"
          >
            Exportar CSV
          </a>
        </div>

        <button
          type="button"
          onClick={sair}
          className="mt-2 w-full rounded-btn border border-line px-3 py-2 text-sm"
        >
          Sair
        </button>
      </section>

      <section className="rounded-card bg-card border p-4" style={{ borderColor: "var(--over)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--over)" }}>
          Apagar conta
        </h2>
        <p className="text-[11px] text-muted mt-1">
          Apaga refeições, pesagens, receitas, conversas e perfil. Não tem volta — exporte antes.
        </p>

        {erro && (
          <p role="alert" className="mt-2 text-sm" style={{ color: "var(--over)" }}>
            {erro}
          </p>
        )}

        {confirmando ? (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="flex-1 rounded-btn border border-line px-3 py-2 text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() =>
                startTransition(async () => {
                  const r = await apagarConta();
                  if (!r.ok) {
                    setErro(r.erro);
                    return;
                  }
                  await supabaseBrowser().auth.signOut();
                  router.replace("/login");
                  router.refresh();
                })
              }
              className="flex-1 rounded-btn px-3 py-2 text-sm font-semibold text-white"
              style={{ background: "var(--over)" }}
            >
              {ocupado ? "Apagando…" : "Apagar tudo"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="mt-3 w-full rounded-btn border px-3 py-2 text-sm"
            style={{ borderColor: "var(--over)", color: "var(--over)" }}
          >
            Apagar minha conta
          </button>
        )}
      </section>
    </div>
  );
}
