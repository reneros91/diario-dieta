import { describe, expect, it } from "vitest";
import {
  alvos,
  deficitSugerido,
  fatorRendimento,
  kcalDeMacros,
  macrosItem,
  mlg,
  por100,
  pesoPronto,
  resumoPeriodo,
  rotuloDia,
  somaDias,
  somaMacros,
  sugerirMeta,
  tendencia,
  tmbKatch,
  tmbMifflin,
  variacaoPrevistaKg,
  type PerfilCalc,
} from "./calc";

const rene: PerfilCalc = {
  sexo: "m",
  idade: 34,
  altura_cm: 178,
  peso_kg: 92,
  gordura_pct: 24,
  fator: 1.375,
  kg_sem: 0.5,
  deficit_kcal: null,
  meta_manual: null,
  prot_gkg: 2.0,
  gord_pct: 25,
};

describe("composição e gasto", () => {
  it("MLG desconta o percentual de gordura", () => {
    expect(mlg(92, 24)).toBeCloseTo(69.92, 5);
  });

  it("sem % de gordura não há MLG", () => {
    expect(mlg(92, null)).toBeNull();
  });

  it("Katch-McArdle = 370 + 21,6 × MLG", () => {
    expect(tmbKatch(69.92)).toBeCloseTo(370 + 21.6 * 69.92, 5);
  });

  it("Mifflin muda o termo constante por sexo", () => {
    expect(tmbMifflin(92, 178, 34, "m")).toBeCloseTo(10 * 92 + 6.25 * 178 - 5 * 34 + 5, 5);
    expect(tmbMifflin(62, 165, 30, "f")).toBeCloseTo(10 * 62 + 6.25 * 165 - 5 * 30 - 161, 5);
  });

  it("usa Katch quando há % de gordura e Mifflin como fallback", () => {
    expect(alvos(rene).formulaTmb).toBe("katch");
    expect(alvos({ ...rene, gordura_pct: null }).formulaTmb).toBe("mifflin");
  });

  it("déficit sugerido = kg/semana × 7700 / 7", () => {
    expect(deficitSugerido(0.5)).toBeCloseTo(550, 5);
    expect(deficitSugerido(1)).toBeCloseTo(1100, 5);
  });
});

describe("alvos do dia", () => {
  const a = alvos(rene);

  it("GET = TMB × fator", () => {
    expect(a.get).toBe(Math.round(a.tmb * 1.375));
  });

  it("meta = GET − déficit", () => {
    expect(a.meta).toBe(Math.round(a.get - 550));
    expect(a.noPisoTmb).toBe(false);
  });

  it("proteína = g/kg × peso", () => {
    expect(a.prot).toBe(184);
  });

  it("gordura = meta × pct / 9 e carbo fecha o resto", () => {
    expect(a.gord).toBe(Math.round((a.meta * 0.25) / 9));
    expect(a.carb).toBe(Math.round((a.meta - 4 * a.prot - 9 * a.gord) / 4));
  });

  it("meta nunca cai abaixo da TMB e avisa quando bate no piso", () => {
    const agressivo = alvos({ ...rene, kg_sem: 2 });
    expect(agressivo.meta).toBe(agressivo.tmb);
    expect(agressivo.noPisoTmb).toBe(true);
  });

  it("déficit manual tem precedência sobre o ritmo", () => {
    const manual = alvos({ ...rene, deficit_kcal: 300 });
    expect(manual.meta).toBe(Math.round(manual.get - 300));
  });

  it("meta fixa ignora GET e déficit", () => {
    const fixa = alvos({ ...rene, meta_manual: 2100 });
    expect(fixa.meta).toBe(2100);
    expect(fixa.deficit).toBe(fixa.get - 2100);
  });

  it("carbo não fica negativo com proteína e gordura altas", () => {
    const extremo = alvos({ ...rene, prot_gkg: 3.5, gord_pct: 45, kg_sem: 1.2 });
    expect(extremo.carb).toBeGreaterThanOrEqual(0);
  });
});

describe("itens de refeição", () => {
  it("editar a quantidade recalcula proporcionalmente", () => {
    const item = { qtd: 150, k100: 130, p100: 2.5, c100: 28, g100: 0.2 };
    const m = macrosItem(item);
    expect(m.kcal).toBeCloseTo(195, 5);
    expect(m.carb).toBeCloseTo(42, 5);

    const dobro = macrosItem({ ...item, qtd: 300 });
    expect(dobro.kcal).toBeCloseTo(390, 5);
  });

  it("soma o cartão inteiro", () => {
    const total = somaMacros([
      { qtd: 100, k100: 100, p100: 10, c100: 5, g100: 2 },
      { qtd: 50, k100: 200, p100: 20, c100: 0, g100: 10 },
    ]);
    expect(total.kcal).toBeCloseTo(200, 5);
    expect(total.prot).toBeCloseTo(20, 5);
  });

  it("converte uma porção em valores por 100", () => {
    const p = por100(140, { kcal: 380, prot: 16, carb: 38, gord: 17 });
    expect(p.k100).toBeCloseTo(271.43, 2);
    expect(p.p100).toBeCloseTo(11.43, 2);
  });

  it("kcal batem com 4P + 4C + 9G", () => {
    expect(kcalDeMacros(16, 38, 17)).toBe(369);
  });
});

describe("rendimento cru → pronto", () => {
  it("cereais incham e carnes encolhem", () => {
    expect(fatorRendimento("Arroz branco cru")).toBe(2.5);
    expect(fatorRendimento("feijão carioca")).toBe(2.2);
    expect(fatorRendimento("Peito de frango")).toBe(0.75);
    expect(fatorRendimento("patinho moído")).toBe(0.7);
    expect(fatorRendimento("tilápia")).toBe(0.8);
    expect(fatorRendimento("brócolis")).toBe(0.9);
  });

  it("ingrediente desconhecido não muda de peso", () => {
    expect(fatorRendimento("azeite de oliva")).toBe(1);
  });

  it("1 kg de frango cru rende 750 g prontos", () => {
    expect(pesoPronto("frango", 1000)).toBe(750);
    expect(pesoPronto("arroz", 400)).toBe(1000);
  });
});

describe("tendência de peso", () => {
  const serie = [
    { dia: "2026-02-01", peso: 92.4 },
    { dia: "2026-02-05", peso: 92.0 },
    { dia: "2026-02-09", peso: 91.6 },
    { dia: "2026-02-13", peso: 91.2 },
  ];

  it("exige 3 pesagens", () => {
    expect(tendencia(serie.slice(0, 2))).toBeNull();
  });

  it("exige pelo menos 7 dias de janela", () => {
    const curta = [
      { dia: "2026-02-01", peso: 92.4 },
      { dia: "2026-02-02", peso: 92.2 },
      { dia: "2026-02-03", peso: 92.0 },
    ];
    expect(tendencia(curta)).toBeNull();
  });

  it("aparece com 3 pesagens em 7 dias", () => {
    const t = tendencia([
      { dia: "2026-02-01", peso: 92.4 },
      { dia: "2026-02-04", peso: 92.1 },
      { dia: "2026-02-08", peso: 91.7 },
    ]);
    expect(t).not.toBeNull();
    expect(t!.pesagens).toBe(3);
    expect(t!.janelaDias).toBe(7);
  });

  it("−0,4 kg a cada 4 dias vira −0,7 kg/semana", () => {
    const t = tendencia(serie)!;
    expect(t.kgSemana).toBeCloseTo(-0.7, 2);
    expect(t.pesoAtualSuavizado).toBeCloseTo(91.2, 1);
  });

  it("ignora pesagens fora da janela", () => {
    const comAntiga = [{ dia: "2025-10-01", peso: 99 }, ...serie];
    expect(tendencia(comAntiga, 28)!.pesagens).toBe(4);
  });
});

describe("sugestão de meta", () => {
  const a = alvos(rene);

  it("silencia quando o ritmo real bate com o plano", () => {
    const t = { kgSemana: -0.48, pesoAtualSuavizado: 91, pesagens: 4, janelaDias: 21 };
    expect(sugerirMeta(t, a, rene)).toBeNull();
  });

  it("corta kcal quando a perda está lenta", () => {
    const t = { kgSemana: -0.2, pesoAtualSuavizado: 91.8, pesagens: 4, janelaDias: 21 };
    const s = sugerirMeta(t, a, rene)!;
    expect(s.gap).toBeCloseTo(0.3, 3);
    expect(s.ajusteKcal).toBeLessThan(0);
    expect(s.novaMeta).toBeLessThan(a.meta);
  });

  it("nunca ajusta mais que 250 kcal", () => {
    const t = { kgSemana: 0.8, pesoAtualSuavizado: 93, pesagens: 5, janelaDias: 28 };
    const s = sugerirMeta(t, a, rene)!;
    expect(Math.abs(s.ajusteKcal)).toBeLessThanOrEqual(250);
  });

  it("devolve kcal quando a perda está rápida demais", () => {
    const t = { kgSemana: -1.1, pesoAtualSuavizado: 90, pesagens: 5, janelaDias: 28 };
    const s = sugerirMeta(t, a, rene)!;
    expect(s.ajusteKcal).toBeGreaterThan(0);
  });

  it("não sugere meta abaixo da TMB", () => {
    const noLimite = alvos({ ...rene, kg_sem: 1.8 });
    const t = { kgSemana: -0.1, pesoAtualSuavizado: 91.9, pesagens: 4, janelaDias: 21 };
    const s = sugerirMeta(t, noLimite, { ...rene, kg_sem: 1.8 });
    expect(s!.novaMeta).toBeGreaterThanOrEqual(noLimite.tmb);
    expect(s!.cortadoPelaTmb).toBe(true);
  });
});

describe("período", () => {
  const dias = [
    { dia: "2026-02-01", kcal: 2100, prot: 180, carb: 190, gord: 60 },
    { dia: "2026-02-02", kcal: 2400, prot: 170, carb: 240, gord: 70 },
    { dia: "2026-02-03", kcal: 0, prot: 0, carb: 0, gord: 0 },
  ];

  it("dia sem registro não entra na conta", () => {
    const r = resumoPeriodo(dias, 2300, 92);
    expect(r.diasComRegistro).toBe(2);
    expect(r.kcalMedia).toBe(2250);
    expect(r.deficitAcumulado).toBe(2300 * 2 - 4500);
  });

  it("converte o déficit em kg de gordura", () => {
    const r = resumoPeriodo(dias, 2300, 92);
    expect(r.gorduraEquivalenteKg).toBeCloseTo(100 / 7700, 2);
    expect(variacaoPrevistaKg(7700)).toBe(-1);
  });

  it("proteína média por kg e distribuição em % das kcal", () => {
    const r = resumoPeriodo(dias, 2300, 92);
    expect(r.protGkg).toBeCloseTo(175 / 92, 2);
    expect(r.pctProt + r.pctCarb + r.pctGord).toBeGreaterThan(98);
  });

  it("período vazio não divide por zero", () => {
    const r = resumoPeriodo([], 2300, 92);
    expect(r.kcalMedia).toBe(0);
    expect(r.protGkg).toBe(0);
  });
});

describe("datas", () => {
  it("anda para frente e para trás sem tropeçar no mês", () => {
    expect(somaDias("2026-02-28", 1)).toBe("2026-03-01");
    expect(somaDias("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("nomeia hoje e ontem", () => {
    expect(rotuloDia("2026-02-10", "2026-02-10")).toBe("Hoje");
    expect(rotuloDia("2026-02-09", "2026-02-10")).toBe("Ontem");
    expect(rotuloDia("2026-02-03", "2026-02-10")).toContain("fev");
  });
});
