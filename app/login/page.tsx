"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const destino = params.get("de") || "/";

  const [etapa, setEtapa] = useState<"email" | "codigo">("email");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    const sb = supabaseBrowser();
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setOcupado(false);
    if (error) {
      setErro("Não deu para enviar o código. Confira o e-mail e tente de novo.");
      return;
    }
    setEtapa("codigo");
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    const sb = supabaseBrowser();
    const { error } = await sb.auth.verifyOtp({
      email: email.trim(),
      token: codigo.trim(),
      type: "email",
    });
    setOcupado(false);
    if (error) {
      setErro("Código inválido ou vencido.");
      return;
    }
    router.replace(destino);
    router.refresh();
  }

  return (
    <main className="min-h-dvh flex flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="display text-4xl font-semibold tracking-tight">Balanço</h1>
        <p className="mt-2 text-muted text-sm">
          Diário alimentar e corporal. Entre com o e-mail: o código chega na hora.
        </p>

        {etapa === "email" ? (
          <form onSubmit={enviarCodigo} className="mt-8 space-y-3">
            <label className="block text-sm font-medium" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              className="w-full rounded-btn border border-line bg-card px-4 py-3"
            />
            <button
              type="submit"
              disabled={ocupado}
              className="w-full rounded-btn bg-accent px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              {ocupado ? "Enviando…" : "Enviar código"}
            </button>
          </form>
        ) : (
          <form onSubmit={confirmar} className="mt-8 space-y-3">
            <label className="block text-sm font-medium" htmlFor="codigo">
              Código enviado para {email}
            </label>
            <input
              id="codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={8}
              required
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="000000"
              className="num w-full rounded-btn border border-line bg-card px-4 py-3 text-center text-2xl tracking-[0.35em]"
            />
            <button
              type="submit"
              disabled={ocupado}
              className="w-full rounded-btn bg-accent px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              {ocupado ? "Conferindo…" : "Entrar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEtapa("email");
                setCodigo("");
                setErro(null);
              }}
              className="w-full rounded-btn px-4 py-2 text-sm text-muted"
            >
              Usar outro e-mail
            </button>
          </form>
        )}

        {erro && (
          <p role="alert" className="mt-4 text-sm" style={{ color: "var(--over)" }}>
            {erro}
          </p>
        )}
      </div>
    </main>
  );
}
