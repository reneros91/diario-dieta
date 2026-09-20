import { describe, expect, it } from "vitest";
import { colunaAusente, semColuna } from "./compat";

const erro = (code: string, message: string, details = "") => ({
  code,
  message,
  details,
  hint: "",
  name: "PostgrestError",
});

describe("colunaAusente", () => {
  it("reconhece o aviso do PostgREST", () => {
    expect(
      colunaAusente(erro("PGRST204", "Could not find the 'fonte' column of 'meal_items'"), "fonte"),
    ).toBe(true);
  });

  it("reconhece o erro cru do Postgres", () => {
    expect(colunaAusente(erro("42703", 'column "fonte" does not exist'), "fonte")).toBe(true);
  });

  it("não confunde com erro de outra coluna", () => {
    expect(colunaAusente(erro("42703", 'column "qtd" does not exist'), "fonte")).toBe(false);
  });

  it("não confunde com violação de permissão", () => {
    expect(colunaAusente(erro("42501", "new row violates row-level security"), "fonte")).toBe(false);
  });

  it("sem erro, nada a tratar", () => {
    expect(colunaAusente(null, "fonte")).toBe(false);
  });
});

describe("semColuna", () => {
  it("remove só a chave pedida e preserva o resto", () => {
    const [linha] = semColuna([{ nome: "Arroz", qtd: 150, fonte: "taco" }], "fonte");
    expect(linha).toEqual({ nome: "Arroz", qtd: 150 });
  });

  it("não altera o original", () => {
    const original = [{ nome: "Arroz", fonte: "taco" }];
    semColuna(original, "fonte");
    expect(original[0].fonte).toBe("taco");
  });
});
