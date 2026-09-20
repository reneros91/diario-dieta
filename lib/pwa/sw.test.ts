import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Testa as duas decisões de roteamento do service worker.
 *
 * Elas são a diferença entre "leitura offline" e "app mostrando comida que
 * você já apagou": a versão anterior tratava a troca de aba do Next como
 * recurso estático e servia o diário do cache para sempre.
 *
 * O arquivo roda no navegador, então aqui as funções são extraídas do fonte
 * e avaliadas — é o que dá para testar sem um service worker de verdade.
 */
const fonte = readFileSync("public/sw.js", "utf8");

function extrair(nome: string): (...args: unknown[]) => boolean {
  const i = fonte.indexOf(`function ${nome}(`);
  if (i < 0) throw new Error(`${nome} não existe mais no sw.js`);
  // Do início da função até a chave que a fecha na coluna zero.
  const fim = fonte.indexOf("\n}", i);
  const corpo = fonte.slice(i, fim + 2);
  return new Function(`${corpo}; return ${nome};`)() as (...args: unknown[]) => boolean;
}

const ehEstatico = extrair("ehEstatico");
const ehDadoDoApp = extrair("ehDadoDoApp");

const req = (headers: Record<string, string> = {}) => ({
  headers: { get: (h: string) => headers[h] ?? null },
});

describe("ehEstatico", () => {
  it("aceita o que tem hash no nome e não muda", () => {
    expect(ehEstatico(new URL("https://x.app/_next/static/chunks/main-abc123.js"))).toBe(true);
    expect(ehEstatico(new URL("https://x.app/icons/icone-192.png"))).toBe(true);
    expect(ehEstatico(new URL("https://x.app/manifest.webmanifest"))).toBe(true);
    expect(ehEstatico(new URL("https://x.app/logo-nutridia.png"))).toBe(true);
  });

  it("recusa as telas do app", () => {
    expect(ehEstatico(new URL("https://x.app/diario"))).toBe(false);
    expect(ehEstatico(new URL("https://x.app/"))).toBe(false);
    expect(ehEstatico(new URL("https://x.app/periodo?dias=30"))).toBe(false);
  });
});

describe("ehDadoDoApp", () => {
  it("reconhece a troca de aba do Next pelo parâmetro", () => {
    // Era exatamente isto que caía no cache e trazia o diário velho.
    expect(ehDadoDoApp(new URL("https://x.app/diario?_rsc=1a2b3c"), req())).toBe(true);
  });

  it("reconhece pelo cabeçalho, quando não há parâmetro", () => {
    expect(ehDadoDoApp(new URL("https://x.app/diario"), req({ RSC: "1" }))).toBe(true);
    expect(
      ehDadoDoApp(new URL("https://x.app/diario"), req({ "Next-Router-Prefetch": "1" })),
    ).toBe(true);
  });

  it("navegação comum não é dado do app", () => {
    expect(ehDadoDoApp(new URL("https://x.app/diario"), req())).toBe(false);
  });

  it("estático não é confundido com dado do app", () => {
    expect(ehDadoDoApp(new URL("https://x.app/_next/static/chunks/main.js"), req())).toBe(false);
  });
});

describe("as duas regras não se sobrepõem", () => {
  it("nada que seja dado do app pode ser tratado como estático", () => {
    const url = new URL("https://x.app/diario?_rsc=1a2b3c");
    expect(ehDadoDoApp(url, req())).toBe(true);
    expect(ehEstatico(url)).toBe(false);
  });
});
