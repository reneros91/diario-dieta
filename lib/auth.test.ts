import { describe, expect, it } from "vitest";
import { SENHA_MINIMA, mensagemErro, validarSenha } from "./auth";

describe("validarSenha", () => {
  it("exige o mínimo de caracteres", () => {
    expect(validarSenha("1234567", "1234567")).toBe("curta");
    expect("1234567".length).toBe(SENHA_MINIMA - 1);
  });

  it("exige que as duas sejam iguais", () => {
    expect(validarSenha("senhaboa1", "senhaboa2")).toBe("diferente");
  });

  it("aceita senha válida e confirmada", () => {
    expect(validarSenha("senhaboa1", "senhaboa1")).toBeNull();
  });

  it("reclama do tamanho antes da diferença", () => {
    // Senha curta E diferente: a mensagem útil é a do tamanho.
    expect(validarSenha("abc", "xyz")).toBe("curta");
  });
});

describe("mensagemErro", () => {
  it("traduz credencial errada sem entregar qual campo errou", () => {
    const m = mensagemErro({ message: "Invalid login credentials" });
    expect(m).toBe("E-mail ou senha não conferem.");
  });

  it("aponta o caminho quando o e-mail já tem conta", () => {
    expect(mensagemErro({ message: "User already registered" })).toContain("já tem conta");
  });

  it("reconhece o erro pelo código, não só pelo texto", () => {
    expect(mensagemErro({ code: "invalid_credentials" })).toBe("E-mail ou senha não conferem.");
    expect(mensagemErro({ code: "weak_password" })).toContain(String(SENHA_MINIMA));
  });

  it("diz o que fazer quando a confirmação de e-mail está ligada", () => {
    const m = mensagemErro({ code: "email_not_confirmed" });
    expect(m).toContain("Supabase");
  });

  it("tem mensagem de reserva para o que não conhece", () => {
    expect(mensagemErro({ message: "algo muito estranho" })).toBe("Não deu certo. Tente de novo.");
    expect(mensagemErro(null)).toBe("Não deu certo. Tente de novo.");
  });
});
