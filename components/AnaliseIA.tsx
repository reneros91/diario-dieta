"use client";

import { useState } from "react";

/** Botão "Análise da IA" dos últimos 14 dias (SPEC §3.6). */
export function AnaliseIA() {
  const [texto, setTexto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pensando, setPensando] = useState(false);

  async function pedir() {
    setPensando(true);
    setErro(null);
    try {
      const r = await fetch("/api/analysis", { method: "POST" });
      const dados = await r.json();
      if (!r.ok) {
        setErro(dados.message ?? "Não deu certo.");
        return;
      }
      setTexto(dados.texto);
    } catch {
      setErro("Sem conexão com o servidor.");
    } finally {
      setPensando(false);
    }
  }

  return (
    <section className="rounded-card bg-card border border-line shadow-card p-4">
      <h2 className="text-sm font-semibold">Análise da IA</h2>
      <p className="text-[11px] text-muted">Últimos 14 dias.</p>

      {texto && <p className="mt-3 text-sm leading-relaxed">{texto}</p>}

      {erro && (
        <p role="alert" className="mt-3 text-sm" style={{ color: "var(--over)" }}>
          {erro}
        </p>
      )}

      <button
        type="button"
        onClick={pedir}
        disabled={pensando}
        className="mt-3 w-full rounded-btn border border-line px-4 py-2 text-sm disabled:opacity-60"
      >
        {pensando ? "Analisando…" : texto ? "Analisar de novo" : "Analisar"}
      </button>
    </section>
  );
}
