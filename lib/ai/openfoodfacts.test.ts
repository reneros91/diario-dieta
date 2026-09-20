import { describe, expect, it } from "vitest";
import { descreverProduto, normalizarProduto } from "@/lib/ai/openfoodfacts";

/**
 * As respostas aqui são as que o Open Food Facts devolveu de verdade nas
 * consultas de reconhecimento, incluindo a ruim: o mesmo leite Italac volta
 * como 59 kcal/100 ml (certo) e como 492 kcal/100 g (entrada quebrada).
 */

const coca = {
  code: "7894900011517",
  product_name: "Refrigerante Coca-Cola 2Lt",
  brands: "Coca-Cola",
  quantity: "2 L",
  nutriments: {
    "energy-kcal_100g": 42.5,
    proteins_100g: 0,
    carbohydrates_100g: 10.5,
    fat_100g: 0,
  },
};

const leiteBom = {
  code: "1",
  product_name: "Leite UHT Integral",
  brands: "Italac",
  quantity: "1 L",
  nutriments: {
    "energy-kcal_100g": 59,
    proteins_100g: 3.1,
    carbohydrates_100g: 4.8,
    fat_100g: 3,
  },
};

const leiteQuebrado = {
  code: "2",
  product_name: "leite integral italac",
  brands: "Italac",
  nutriments: {
    "energy-kcal_100g": 492,
    proteins_100g: 24,
    carbohydrates_100g: 40,
    fat_100g: 26,
  },
};

describe("normalizarProduto", () => {
  it("lê o refrigerante e reconhece que é líquido pela embalagem", () => {
    const p = normalizarProduto(coca)!;
    expect(p.kcal).toBe(42.5);
    expect(p.carb).toBe(10.5);
    expect(p.unidade).toBe("ml");
    expect(p.marca).toBe("Coca-Cola");
  });

  it("converte o teor alcoólico em gramas de álcool", () => {
    const p = normalizarProduto({
      code: "3",
      product_name: "Cerveja Pilsen",
      brands: "Skol",
      quantity: "350 ml",
      nutriments: {
        "energy-kcal_100g": 42,
        proteins_100g: 0.5,
        carbohydrates_100g: 3.6,
        fat_100g: 0,
        alcohol_100g: 5, // % de volume, não gramas
      },
    })!;
    expect(p.alcool).toBe(3.95);
    expect(p.unidade).toBe("ml");
    expect(p.kcal).toBe(42);
  });

  it("aceita o registro bom do leite", () => {
    expect(normalizarProduto(leiteBom)!.kcal).toBe(59);
  });

  it("não barra o registro errado do leite, porque ele é internamente coerente", () => {
    // 4×24 + 4×40 + 9×26 = 490, contra 492 declarados: a conta fecha.
    // Filtro nenhum pega isto. Quem separa é a IA, comparando com o que a
    // pessoa disse, e a linha do diário, que mostra de onde o número veio.
    expect(normalizarProduto(leiteQuebrado)).not.toBeNull();
  });

  it("descarta caloria impossível", () => {
    expect(
      normalizarProduto({
        code: "4",
        product_name: "Coisa",
        nutriments: { "energy-kcal_100g": 1200, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 0 },
      }),
    ).toBeNull();
  });

  it("descarta macro que não cabe em 100 g", () => {
    expect(
      normalizarProduto({
        code: "5",
        product_name: "Coisa",
        nutriments: { "energy-kcal_100g": 400, proteins_100g: 60, carbohydrates_100g: 60, fat_100g: 10 },
      }),
    ).toBeNull();
  });

  it("descarta caloria que briga com os próprios macros", () => {
    // 4×20 + 4×60 + 9×10 = 410 contra 50 declarados.
    expect(
      normalizarProduto({
        code: "6",
        product_name: "Coisa",
        nutriments: { "energy-kcal_100g": 50, proteins_100g: 20, carbohydrates_100g: 60, fat_100g: 10 },
      }),
    ).toBeNull();
  });

  it("deixa passar sobra de caloria em líquido, que pode ser álcool", () => {
    // Cachaça: 231 kcal e quase nenhum macro. Em sólido isto seria descartado.
    const p = normalizarProduto({
      code: "7",
      product_name: "Cachaça",
      quantity: "700 ml",
      nutriments: {
        "energy-kcal_100g": 231,
        proteins_100g: 0,
        carbohydrates_100g: 0,
        fat_100g: 0,
        alcohol_100g: 40,
      },
    })!;
    expect(p.kcal).toBe(231);
    expect(p.alcool).toBe(31.56);
  });

  it("descarta ficha sem nome de produto", () => {
    // Foi o caso do 1º resultado de "skol" na vistoria.
    expect(
      normalizarProduto({
        code: "8",
        product_name: "",
        nutriments: { "energy-kcal_100g": 42, proteins_100g: 0, carbohydrates_100g: 3, fat_100g: 0 },
      }),
    ).toBeNull();
  });

  it("descarta ficha sem tabela nutricional", () => {
    // Foi o caso do Skol Beats Senses.
    expect(normalizarProduto({ code: "9", product_name: "Skol Beats Senses", nutriments: {} })).toBeNull();
  });

  it("descreve o produto com marca, nome e embalagem", () => {
    expect(descreverProduto(normalizarProduto(coca)!)).toBe(
      "Open Food Facts · Coca-Cola Refrigerante Coca-Cola 2Lt 2 L",
    );
  });
});
