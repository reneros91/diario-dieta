"use client";

import { useState } from "react";

/**
 * Campo de senha com botão de mostrar.
 * Digitar senha no celular erra muito; ver o que foi digitado resolve mais que
 * qualquer mensagem de erro.
 */
export function CampoSenha({
  id,
  rotulo,
  valor,
  onChange,
  autoComplete,
  dica,
}: {
  id: string;
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  dica?: string;
}) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div>
      <label className="block text-sm font-medium" htmlFor={id}>
        {rotulo}
      </label>
      <div className="mt-1 relative">
        <input
          id={id}
          type={visivel ? "text" : "password"}
          autoComplete={autoComplete}
          required
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-btn border border-line bg-card px-4 py-3 pr-16"
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? "Esconder senha" : "Mostrar senha"}
          className="absolute inset-y-0 right-0 px-3 text-xs text-muted"
        >
          {visivel ? "Esconder" : "Mostrar"}
        </button>
      </div>
      {dica && <p className="mt-1 text-[11px] text-muted">{dica}</p>}
    </div>
  );
}
