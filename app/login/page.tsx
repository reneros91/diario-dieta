"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { mensagemErro } from "@/lib/auth";
import { CampoSenha } from "@/components/CampoSenha";
import { Logo } from "@/components/Logo";

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

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);

    const sb = supabaseBrowser();
    const { error } = await sb.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });

    if (error) {
      setOcupado(false);
      setErro(mensagemErro(error));
      return;
    }

    router.replace(destino);
    router.refresh();
  }

  return (
    <main className="min-h-dvh flex flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <h1>
          <Logo largura={210} prioridade />
          <span className="sr-only">NutriDia</span>
        </h1>
        <p className="mt-3 text-muted text-sm">Diário alimentar e corporal.</p>

        <form onSubmit={entrar} className="mt-8 space-y-4">
          <div>
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
              className="mt-1 w-full rounded-btn border border-line bg-card px-4 py-3"
            />
          </div>

          <CampoSenha
            id="senha"
            rotulo="Senha"
            valor={senha}
            onChange={setSenha}
            autoComplete="current-password"
          />

          <button
            type="submit"
            disabled={ocupado}
            className="w-full rounded-btn bg-accent px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {ocupado ? "Entrando…" : "Entrar"}
          </button>
        </form>

        {erro && (
          <p role="alert" className="mt-4 text-sm" style={{ color: "var(--over)" }}>
            {erro}
          </p>
        )}

        <p className="mt-6 text-sm text-muted">
          Primeira vez?{" "}
          <Link href="/cadastro" className="font-medium" style={{ color: "var(--accent)" }}>
            Criar conta
          </Link>
        </p>
      </div>
    </main>
  );
}
