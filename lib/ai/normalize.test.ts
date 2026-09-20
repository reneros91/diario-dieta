import { describe, expect, it } from "vitest";
import { normAcoes, normItensReceita } from "./normalize";
import { zRegistro } from "./schema";
import { kcalDeMacros, por100, somaMacros } from "@/lib/calc";

/** Roda a normalização e o zod, como a rota faz. */
const registrar = (acoes: unknown, hora = 13) =>
  zRegistro.safeParse({ resposta: "ok", acoes: normAcoes(acoes, hora) });

describe("normAcoes — refeições", () => {
  it("aceita o formato limpo", () => {
    const r = registrar([
      {
        tipo: "refeicao",
        refeicao: "almoco",
        nome: "Almoço",
        itens: [
          { nome: "Arroz", quantidade: 150, unidade: "g", kcal: 195, prot: 3.8, carb: 42, gord: 0.3 },
        ],
      },
    ]);
    expect(r.success).toBe(true);
  });

  it("converte número que veio como string com unidade junto", () => {
    const r = registrar([
      {
        tipo: "refeicao",
        refeicao: "jantar",
        nome: "Jantar",
        itens: [
          { nome: "Frango", quantidade: "180 g", kcal: "286", prot: "57,6", carb: "0", gord: "4,5" },
        ],
      },
    ]);
    expect(r.success).toBe(true);
    const item = (r.data!.acoes[0] as { itens: { quantidade: number; prot: number }[] }).itens[0];
    expect(item.quantidade).toBe(180);
    expect(item.prot).toBeCloseTo(57.6, 2);
  });

  it("lê 1.500 como mil e quinhentos e 1.5 como um e meio", () => {
    const r = registrar([
      {
        tipo: "refeicao",
        nome: "Ceia",
        refeicao: "ceia",
        itens: [
          { nome: "A", quantidade: "1.500", kcal: 100, prot: 5, carb: 15, gord: 2 },
          { nome: "B", quantidade: "1.5", kcal: 10, prot: 0, carb: 2, gord: 0 },
        ],
      },
    ]);
    const itens = (r.data!.acoes[0] as { itens: { quantidade: number }[] }).itens;
    expect(itens[0].quantidade).toBe(1500);
    expect(itens[1].quantidade).toBe(1.5);
  });

  it("deduz a refeição pela hora quando a IA não diz", () => {
    const manha = registrar(
      [{ tipo: "refeicao", nome: "Café", itens: [{ nome: "Ovo", quantidade: 100, kcal: 146, prot: 13.3, carb: 0.6, gord: 9.5 }] }],
      8,
    );
    expect((manha.data!.acoes[0] as { refeicao: string }).refeicao).toBe("cafe");

    const noite = registrar(
      [{ tipo: "refeicao", nome: "Ceia", itens: [{ nome: "Ovo", quantidade: 100, kcal: 146, prot: 13.3, carb: 0.6, gord: 9.5 }] }],
      23,
    );
    expect((noite.data!.acoes[0] as { refeicao: string }).refeicao).toBe("ceia");
  });

  it("entende sinônimo de refeição", () => {
    const r = registrar([
      {
        tipo: "refeicao",
        refeicao: "janta",
        nome: "Janta",
        itens: [{ nome: "Sopa", quantidade: 300, kcal: 150, prot: 8, carb: 20, gord: 4 }],
      },
    ]);
    expect((r.data!.acoes[0] as { refeicao: string }).refeicao).toBe("jantar");
  });

  it("deduz que é refeição quando falta o campo tipo", () => {
    const r = registrar([
      { nome: "Lanche", itens: [{ nome: "Pão", quantidade: 50, kcal: 150, prot: 4, carb: 29, gord: 1.5 }] },
    ]);
    expect((r.data!.acoes[0] as { tipo: string }).tipo).toBe("refeicao");
  });

  it("recalcula kcal que não fecham com 4P + 4C + 9G", () => {
    const r = registrar([
      {
        tipo: "refeicao",
        refeicao: "almoco",
        nome: "Almoço",
        itens: [{ nome: "Bife", quantidade: 150, kcal: 999, prot: 45, carb: 0, gord: 12 }],
      },
    ]);
    const item = (r.data!.acoes[0] as { itens: { kcal: number }[] }).itens[0];
    expect(item.kcal).toBe(Math.round(kcalDeMacros(45, 0, 12)));
  });

  it("mantém as kcal quando a diferença está dentro de 5%", () => {
    // 4×45 + 9×12 = 288; 290 está a 0,7% e passa como veio.
    const r = registrar([
      {
        tipo: "refeicao",
        refeicao: "almoco",
        nome: "Almoço",
        itens: [{ nome: "Bife", quantidade: 150, kcal: 290, prot: 45, carb: 0, gord: 12 }],
      },
    ]);
    expect((r.data!.acoes[0] as { itens: { kcal: number }[] }).itens[0].kcal).toBe(290);
  });

  it("descarta linha sem nada aproveitável e a refeição que ficou vazia", () => {
    const r = registrar([
      {
        tipo: "refeicao",
        refeicao: "almoco",
        nome: "Almoço",
        itens: [{ nome: "Água", quantidade: 200, kcal: 0, prot: 0, carb: 0, gord: 0 }],
      },
    ]);
    expect(r.data!.acoes).toHaveLength(0);
  });

  it("ignora lixo que não é objeto", () => {
    expect(normAcoes(["oi", null, 42], 12)).toHaveLength(0);
    expect(normAcoes("não é lista", 12)).toHaveLength(0);
  });
});

describe("normAcoes — treino, peso e dia", () => {
  it("treino aceita minutos com outro nome de campo", () => {
    const r = registrar([{ tipo: "treino", nome: "Perna", minutos: 50, kcal: 400 }]);
    expect(r.data!.acoes[0]).toMatchObject({ tipo: "treino", min: 50, kcal: 400 });
  });

  it("peso fora da faixa humana não vira pesagem", () => {
    expect(normAcoes([{ tipo: "peso", peso: 2 }], 12)).toHaveLength(0);
    expect(normAcoes([{ tipo: "peso", peso: 91.4 }], 12)).toHaveLength(1);
  });

  it("gordura absurda vira nulo sem derrubar a pesagem", () => {
    const r = registrar([{ tipo: "peso", peso: 91.4, gordura: 480 }]);
    expect(r.data!.acoes[0]).toMatchObject({ tipo: "peso", peso: 91.4, gordura: null });
  });

  it("dia sem nenhum dado não é registrado", () => {
    expect(normAcoes([{ tipo: "dia", passos: null, sono: null, atividade: null }], 12)).toHaveLength(
      0,
    );
  });

  it("atividade inventada é descartada mas os passos ficam", () => {
    const r = registrar([{ tipo: "dia", passos: 8400, atividade: "voando" }]);
    expect(r.data!.acoes[0]).toMatchObject({ tipo: "dia", passos: 8400, atividade: null });
  });
});

describe("definição de pronto: fatia de pizza de 140 g", () => {
  // O que a IA devolveria para "fatia de mussarela e calabresa, 140 g".
  const acoes = [
    {
      tipo: "refeicao",
      refeicao: "jantar",
      nome: "Pizza",
      itens: [
        { nome: "Massa de pizza", quantidade: 60, unidade: "g", kcal: 158, prot: 5, carb: 30, gord: 2 },
        { nome: "Mussarela", quantidade: 40, unidade: "g", kcal: 132, prot: 9, carb: 1.2, gord: 10.1 },
        { nome: "Calabresa", quantidade: 25, unidade: "g", kcal: 74, prot: 4.9, carb: 0, gord: 6 },
        { nome: "Molho de tomate", quantidade: 15, unidade: "g", kcal: 7, prot: 0.2, carb: 1.2, gord: 0.2 },
      ],
    },
  ];

  const r = registrar(acoes);
  const itens = (r.data!.acoes[0] as { itens: { quantidade: number; kcal: number; prot: number; carb: number; gord: number }[] }).itens;

  it("sai com 3 a 5 linhas", () => {
    expect(itens.length).toBeGreaterThanOrEqual(3);
    expect(itens.length).toBeLessThanOrEqual(5);
  });

  it("os gramas somam os 140 informados", () => {
    expect(itens.reduce((s, i) => s + i.quantidade, 0)).toBe(140);
  });

  it("as kcal de cada linha fecham com 4P + 4C + 9G dentro de 5%", () => {
    for (const i of itens) {
      const derivada = kcalDeMacros(i.prot, i.carb, i.gord);
      // 1 kcal de folga: o valor gravado é inteiro, o derivado não.
      expect(Math.abs(i.kcal - derivada)).toBeLessThanOrEqual(Math.max(1, derivada * 0.05));
    }
  });

  it("virar item de refeição por 100 g preserva o total", () => {
    const gravados = itens.map((i) => ({
      qtd: i.quantidade,
      ...por100(i.quantidade, { kcal: i.kcal, prot: i.prot, carb: i.carb, gord: i.gord }),
    }));
    const total = somaMacros(gravados);
    const esperado = itens.reduce((s, i) => s + i.kcal, 0);
    expect(total.kcal).toBeCloseTo(esperado, 0);
  });
});

describe("normItensReceita", () => {
  it("1 kg de frango cru vira 750 g prontos sem perder proteína", () => {
    const itens = normItensReceita([
      { nome: "Peito de frango", peso_pronto: 750, kcal: 1190, prot: 215, carb: 0, gord: 30 },
      { nome: "Arroz branco", peso_pronto: 1000, kcal: 1432, prot: 28.8, carb: 315, gord: 1.2 },
    ]) as { nome: string; peso_pronto: number; prot: number }[];

    expect(itens).toHaveLength(2);
    expect(itens[0].peso_pronto).toBe(750);
    expect(itens[0].prot).toBe(215);
  });

  it("ingrediente sem peso não entra", () => {
    expect(normItensReceita([{ nome: "Sal", kcal: 0 }])).toHaveLength(0);
  });
});
