"use client";

import { useState } from "react";
import { Hub } from "@/components/Hub";

/** "＋ Adicionar neste dia" do Diário (SPEC §3.4). */
export function BotaoAdicionarNoDia({ dia }: { dia: string }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="w-full rounded-btn border border-line bg-card px-4 py-3 text-sm font-medium"
      >
        ＋ Adicionar neste dia
      </button>
      <Hub aberto={aberto} dia={dia} onFechar={() => setAberto(false)} />
    </>
  );
}
