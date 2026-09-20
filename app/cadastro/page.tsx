"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { SENHA_MINIMA, TEXTO_PROBLEMA, mensagemErro, validarSenha } from "@/lib/auth";
import { CampoSenha } from "@/components/CampoSenha";

export default function CadastroPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);

    const problema = validarSenha(senha, confirmacao);
    if (problema) {
      setErro(TEXTO_PROBLEMA[problema]);
      return;
    }

    setOcupado(true);
    const sb = supabaseBrowser();
    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password: senha,
    });

    if (error) {
      setOcupado(false);
      setErro(mensagemErro(error));
      return;
    }

    // Com a confirmação de e-mail desligada, o signUp já devolve sessão e a
    // pessoa entra direto. Se estiver ligada, a sessão vem nula — e aí calar
    // seria pior que avisar, porque nada acontece na tela.
    if (!data.session) {
      setOcupado(false);
      setAviso(
        "Conta criada, mas o Supabase está exigindo confirmação por e-mail. " +
          "Desligue 'Confirm email' em Authentication → Providers → Email e entre pela tela de login.",
      );
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <main className="min-h-dvh flex flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="display text-4xl font-semibold tracking-tight">Criar conta</h1>
        <p className="mt-2 text-muted text-sm">
          Só o e-mail e uma senha. Seus dados ficam separados dos de qualquer outra pessoa.
        </p>

        <form onSubmit={cadastrar} className="mt-8 space-y-4">
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
            autoComplete="new-password"
            dica={`No mínimo ${SENHA_MINIMA} caracteres.`}
          />

          <CampoSenha
            id="confirmacao"
            rotulo="Repita a senha"
            valor={confirmacao}
            onChange={setConfirmacao}
            autoComplete="new-password"
          />

          <button
            type="submit"
            disabled={ocupado}
            className="w-full rounded-btn bg-accent px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {ocupado ? "Criando…" : "Criar conta e entrar"}
          </button>
        </form>

        {erro && (
          <p role="alert" className="mt-4 text-sm" style={{ color: "var(--over)" }}>
            {erro}
          </p>
        )}

        {aviso && (
          <p
            role="alert"
            className="mt-4 rounded-btn border px-3 py-2 text-sm leading-relaxed"
            style={{ borderColor: "var(--over)", color: "var(--over)" }}
          >
            {aviso}
          </p>
        )}

        <p className="mt-6 text-sm text-muted">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium" style={{ color: "var(--accent)" }}>
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
