import { describe, expect, it } from "vitest";
import {
  conciliarComTaco,
  indexarTaco,
  listaParaPrompt,
  palavrasDeBusca,
  totalConciliado,
  type ItemBruto,
  type LinhaTaco,
} from "./taco";
import { kcalDeMacros } from "@/lib/calc";

const TABELA: LinhaTaco[] = [
  { nome: "Arroz branco cozido", kcal: 128, prot: 2.5, carb: 28.1, gord: 0.2, unidade: "g" },
  { nome: "Peito de frango grelhado", kcal: 159, prot: 32, carb: 0, gord: 2.5, unidade: "g" },
];
const mapa = indexarTaco(TABELA);

const item = (p: Partial<ItemBruto>): ItemBruto => ({
  nome: "X",
  quantidade: 100,
  unidade: "g",
  kcal: 0,
  prot: 0,
  carb: 0,
  gord: 0,
  ...p,
});

describe("palavrasDeBusca", () => {
  it("fica só com o que nomeia comida", () => {
    const p = palavrasDeBusca("comi 150g de arroz com frango hoje cedo");
    expect(p).toContain("arroz");
    expect(p).toContain("frango");
    expect(p).not.toContain("comi");
    expect(p).not.toContain("hoje");
    expect(p).not.toContain("150");
  });

  it("ignora acento e caixa", () => {
    expect(palavrasDeBusca("Feijão com ABÓBORA")).toEqual(
      expect.arrayContaining(["feijao", "abobora"]),
    );
  });

  it("texto sem comida não gera busca", () => {
    expect(palavrasDeBusca("oi tudo bem")).not.toContain("oi");
  });
});

describe("conciliarComTaco", () => {
  it("nome que bate usa o valor do banco, não o da IA", () => {
    // A IA chutou 300 kcal para 150 g de arroz; a tabela diz 128/100 g.
    const [r] = conciliarComTaco(
      [item({ nome: "Arroz branco cozido", quantidade: 150, kcal: 300, prot: 9, carb: 60, gord: 5 })],
      mapa,
    );
    expect(r.fonte).toBe("taco");
    expect(r.kcal).toBe(192); // 128 × 1,5
    expect(r.prot).toBeCloseTo(3.75, 2);
    expect(r.carb).toBeCloseTo(42.15, 2);
  });

  it("casa mesmo com acento e caixa diferentes", () => {
    const [r] = conciliarComTaco([item({ nome: "PEITO DE FRANGO GRELHADO", quantidade: 200 })], mapa);
    expect(r.fonte).toBe("taco");
    expect(r.kcal).toBe(318);
    expect(r.nomeTabela).toBe("Peito de frango grelhado");
  });

  it("nome fora da tabela continua estimativa, e não mente dizendo taco", () => {
    const [r] = conciliarComTaco(
      [item({ nome: "Torta da vovó", quantidade: 120, prot: 5, carb: 30, gord: 12, fonte: "taco" })],
      mapa,
    );
    expect(r.fonte).toBe("estimativa");
    expect(r.nomeTabela).toBeNull();
  });

  it("rótulo lido na foto é preservado como rótulo", () => {
    const [r] = conciliarComTaco(
      [item({ nome: "Barra XYZ", quantidade: 40, prot: 10, carb: 20, gord: 6, fonte: "rotulo" })],
      mapa,
    );
    expect(r.fonte).toBe("rotulo");
  });

  it("estimativa sai sempre com kcal fechando com 4P + 4C + 9G", () => {
    const [r] = conciliarComTaco(
      [item({ nome: "Coisa nova", quantidade: 100, kcal: 999, prot: 10, carb: 20, gord: 5 })],
      mapa,
    );
    expect(r.kcal).toBe(Math.round(kcalDeMacros(10, 20, 5)));
  });

  it("o total é a soma do que vai ser gravado", () => {
    const conc = conciliarComTaco(
      [
        item({ nome: "Arroz branco cozido", quantidade: 100 }),
        item({ nome: "Peito de frango grelhado", quantidade: 100 }),
      ],
      mapa,
    );
    expect(totalConciliado(conc).kcal).toBe(128 + 159);
  });
});

describe("listaParaPrompt", () => {
  it("descreve cada alimento por 100 unidades", () => {
    expect(listaParaPrompt(TABELA)).toContain("Arroz branco cozido: 128 kcal, 2.5 P");
  });

  it("some quando nada casou", () => {
    expect(listaParaPrompt([])).toBe("");
  });
});
