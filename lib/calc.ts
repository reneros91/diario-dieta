/**
 * Regras de cálculo do NutriDia (SPEC §4).
 *
 * Tudo aqui é puro: sem I/O, sem Supabase, sem React. É o único lugar onde as
 * fórmulas existem — telas e rotas importam daqui.
 */

export const KCAL_POR_KG_GORDURA = 7700;

export type Sexo = "m" | "f";

/** Fatores de atividade aceitos no Perfil (SPEC §3.7). */
export const FATORES = [1.2, 1.375, 1.55, 1.725, 1.9] as const;
export type Fator = (typeof FATORES)[number];

export const FATOR_LABEL: Record<string, string> = {
  "1.2": "Sedentário",
  "1.375": "Leve — 1 a 3 treinos/semana",
  "1.55": "Moderado — 3 a 5 treinos/semana",
  "1.725": "Intenso — 6 a 7 treinos/semana",
  "1.9": "Atleta — 2 sessões/dia",
};

export type PerfilCalc = {
  sexo: Sexo;
  idade: number;
  altura_cm: number;
  peso_kg: number;
  /** % de gordura corporal. null quando a pessoa não mede. */
  gordura_pct: number | null;
  fator: number;
  /** Ritmo desejado em kg por semana (positivo = perder). */
  kg_sem: number;
  /** Déficit em kcal/dia escolhido à mão. null = derivar de kg_sem. */
  deficit_kcal: number | null;
  /** Meta fixa em kcal/dia. Quando presente, ignora GET e déficit. */
  meta_manual: number | null;
  prot_gkg: number;
  gord_pct: number;
};

export type Alvos = {
  /** Massa livre de gordura, em kg. null quando não há % de gordura. */
  mlg: number | null;
  tmb: number;
  formulaTmb: "katch" | "mifflin";
  get: number;
  /** Déficit efetivamente aplicado (pode ser cortado pelo piso da TMB). */
  deficit: number;
  meta: number;
  /** true quando a meta bateu no piso da TMB (SPEC §4). */
  noPisoTmb: boolean;
  prot: number;
  carb: number;
  gord: number;
};

const arred = (n: number, casas = 0) => {
  const f = 10 ** casas;
  return Math.round(n * f) / f;
};

/** MLG = peso × (1 − gordura/100). */
export function mlg(peso_kg: number, gordura_pct: number | null): number | null {
  if (gordura_pct === null || !Number.isFinite(gordura_pct)) return null;
  return peso_kg * (1 - gordura_pct / 100);
}

/** Katch-McArdle: 370 + 21,6 × MLG. */
export function tmbKatch(massaMagra: number): number {
  return 370 + 21.6 * massaMagra;
}

/** Mifflin-St Jeor: 10×peso + 6,25×altura − 5×idade + (5 homem | −161 mulher). */
export function tmbMifflin(peso_kg: number, altura_cm: number, idade: number, sexo: Sexo): number {
  return 10 * peso_kg + 6.25 * altura_cm - 5 * idade + (sexo === "m" ? 5 : -161);
}

/** Katch-McArdle quando há % de gordura; Mifflin como fallback. */
export function tmb(p: Pick<PerfilCalc, "peso_kg" | "altura_cm" | "idade" | "sexo" | "gordura_pct">): {
  valor: number;
  formula: "katch" | "mifflin";
  mlg: number | null;
} {
  const massaMagra = mlg(p.peso_kg, p.gordura_pct);
  if (massaMagra !== null) {
    return { valor: tmbKatch(massaMagra), formula: "katch", mlg: massaMagra };
  }
  return {
    valor: tmbMifflin(p.peso_kg, p.altura_cm, p.idade, p.sexo),
    formula: "mifflin",
    mlg: null,
  };
}

/** déficit_sugerido = kg_por_semana × 7700 / 7. */
export function deficitSugerido(kgPorSemana: number): number {
  return (kgPorSemana * KCAL_POR_KG_GORDURA) / 7;
}

/** Ritmo em kg/semana que um déficit diário representa. */
export function kgSemanaDeDeficit(deficitKcalDia: number): number {
  return (deficitKcalDia * 7) / KCAL_POR_KG_GORDURA;
}

/**
 * Alvos completos do dia: TMB, GET, meta com piso na TMB e macros.
 * Arredonda kcal para inteiro e macros para grama — é o que a tela mostra.
 */
export function alvos(p: PerfilCalc): Alvos {
  const base = tmb(p);
  const tmbV = arred(base.valor);
  const get = arred(tmbV * p.fator);

  const deficitPedido =
    p.deficit_kcal !== null && Number.isFinite(p.deficit_kcal)
      ? p.deficit_kcal
      : deficitSugerido(p.kg_sem);

  let meta: number;
  let noPisoTmb: boolean;

  if (p.meta_manual !== null && Number.isFinite(p.meta_manual)) {
    meta = arred(p.meta_manual);
    noPisoTmb = meta <= tmbV;
  } else {
    const bruta = get - deficitPedido;
    meta = arred(Math.max(bruta, tmbV));
    noPisoTmb = bruta < tmbV;
  }

  const deficit = arred(get - meta);

  const prot = arred(p.prot_gkg * p.peso_kg);
  const gord = arred((meta * (p.gord_pct / 100)) / 9);
  const carb = Math.max(0, arred((meta - 4 * prot - 9 * gord) / 4));

  return {
    mlg: base.mlg === null ? null : arred(base.mlg, 1),
    tmb: tmbV,
    formulaTmb: base.formula,
    get,
    deficit,
    meta,
    noPisoTmb,
    prot,
    carb,
    gord,
  };
}

/* ------------------------------------------------------------------ */
/* Itens de refeição                                                   */
/* ------------------------------------------------------------------ */

export type Unidade = "g" | "ml" | "porcao";

/** Um item guarda sempre valores por 100 unidades + quantidade (SPEC §4). */
export type ItemMacro = {
  qtd: number;
  k100: number;
  p100: number;
  c100: number;
  g100: number;
};

export type Macros = { kcal: number; prot: number; carb: number; gord: number };

export const MACROS_ZERO: Macros = { kcal: 0, prot: 0, carb: 0, gord: 0 };

/** Macros de uma linha. Editar a quantidade recalcula proporcionalmente, sem IA. */
export function macrosItem(item: ItemMacro): Macros {
  const f = item.qtd / 100;
  return {
    kcal: item.k100 * f,
    prot: item.p100 * f,
    carb: item.c100 * f,
    gord: item.g100 * f,
  };
}

export function somaMacros(itens: ItemMacro[]): Macros {
  return itens.reduce<Macros>((acc, it) => {
    const m = macrosItem(it);
    return {
      kcal: acc.kcal + m.kcal,
      prot: acc.prot + m.prot,
      carb: acc.carb + m.carb,
      gord: acc.gord + m.gord,
    };
  }, { ...MACROS_ZERO });
}

/**
 * kcal derivadas dos macros: 4P + 4C + 9G + 7A. Usada para conferir o que a IA
 * devolve.
 *
 * O álcool é o quarto termo e não é opcional por elegância: ele tem caloria e
 * não é nenhum dos três macros. Sem ele, uma cerveja de 42 kcal vira 16 —
 * porque só sobram o resto de proteína e o carboidrato residual.
 */
export function kcalDeMacros(
  prot: number,
  carb: number,
  gord: number,
  alcool = 0,
): number {
  return 4 * prot + 4 * carb + 9 * gord + 7 * alcool;
}

const DENSIDADE_ETANOL = 0.789;

/** Gramas de álcool puro num volume, pelo teor declarado no rótulo. */
export function gramasDeAlcool(ml: number, teorPct: number): number {
  return Math.round(ml * (teorPct / 100) * DENSIDADE_ETANOL * 100) / 100;
}

/**
 * Converte kcal/macros absolutos de uma porção em valores por 100 unidades.
 * É como toda entrada (IA, rótulo, TACO) vira `ItemMacro`.
 */
export function por100(
  quantidade: number,
  m: Macros,
): { k100: number; p100: number; c100: number; g100: number } {
  const q = quantidade > 0 ? quantidade : 100;
  const f = 100 / q;
  return {
    k100: arred(m.kcal * f, 2),
    p100: arred(m.prot * f, 2),
    c100: arred(m.carb * f, 2),
    g100: arred(m.gord * f, 2),
  };
}

/* ------------------------------------------------------------------ */
/* Receitas: rendimento cru → pronto                                   */
/* ------------------------------------------------------------------ */

/** Fator de peso cru → pronto (SPEC §4). Macros continuam sendo os do cru. */
export const RENDIMENTO: Record<string, number> = {
  arroz: 2.5,
  feijao: 2.2,
  macarrao: 2.2,
  lentilha: 2.2,
  carne_bovina: 0.7,
  frango: 0.75,
  peixe: 0.8,
  legumes: 0.9,
  batata: 0.95,
};

/** Remove acento e caixa — o nome vem digitado pela pessoa ou pela IA. */
export function chaveAlimento(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Acha o fator de rendimento pelo nome do ingrediente. 1 quando não reconhece. */
export function fatorRendimento(nome: string): number {
  const n = chaveAlimento(nome);
  if (/\barroz\b/.test(n)) return RENDIMENTO.arroz;
  if (/\bfeij/.test(n)) return RENDIMENTO.feijao;
  if (/macarr|espaguete|penne|talharim|massa\b/.test(n)) return RENDIMENTO.macarrao;
  if (/lentilha|grao de bico|ervilha seca/.test(n)) return RENDIMENTO.lentilha;
  if (/\bfrango|peito de frango|sobrecoxa|coxa\b/.test(n)) return RENDIMENTO.frango;
  if (/peixe|tilapia|salmao|merluza|atum fresco/.test(n)) return RENDIMENTO.peixe;
  if (/carne|patinho|alcatra|acem|coxao|musculo|moida|file mignon|picanha/.test(n)) {
    return RENDIMENTO.carne_bovina;
  }
  if (/batata(?! doce frita)|mandioca|inhame/.test(n)) return RENDIMENTO.batata;
  if (/brocolis|couve|abobrinha|cenoura|chuchu|vagem|legume|abobora|berinjela/.test(n)) {
    return RENDIMENTO.legumes;
  }
  return 1;
}

/** Peso pronto estimado a partir do peso cru. */
export function pesoPronto(nome: string, gramasCru: number): number {
  return arred(gramasCru * fatorRendimento(nome), 0);
}

/* ------------------------------------------------------------------ */
/* Tendência de peso                                                   */
/* ------------------------------------------------------------------ */

export type Pesagem = { dia: string; peso: number };

export type Tendencia = {
  /** kg por semana. Negativo = perdendo. */
  kgSemana: number;
  /** Peso previsto pela reta no último dia da janela. */
  pesoAtualSuavizado: number;
  pesagens: number;
  /** Dias entre a primeira e a última pesagem da janela. */
  janelaDias: number;
};

const diasEntre = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/**
 * Regressão linear simples (dias × peso) → coeficiente × 7 = kg/semana.
 * Exige 3 pesagens em pelo menos 7 dias, olhando a janela mais recente
 * (SPEC §3.6). Devolve null quando não dá para afirmar nada.
 */
export function tendencia(
  pesagens: Pesagem[],
  janelaDias = 28,
  hoje?: string,
): Tendencia | null {
  if (pesagens.length < 3) return null;

  const ordenadas = [...pesagens].sort((a, b) => a.dia.localeCompare(b.dia));
  const fim = hoje ?? ordenadas[ordenadas.length - 1].dia;
  const dentro = ordenadas.filter((p) => {
    const d = diasEntre(p.dia, fim);
    return d >= 0 && d <= janelaDias;
  });

  if (dentro.length < 3) return null;

  const base = dentro[0].dia;
  const span = diasEntre(base, dentro[dentro.length - 1].dia);
  if (span < 7) return null;

  const xs = dentro.map((p) => diasEntre(base, p.dia));
  const ys = dentro.map((p) => p.peso);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;

  const coef = num / den; // kg por dia
  const intercepto = my - coef * mx;

  return {
    kgSemana: arred(coef * 7, 3),
    pesoAtualSuavizado: arred(intercepto + coef * xs[n - 1], 2),
    pesagens: n,
    janelaDias: span,
  };
}

export type SugestaoMeta = {
  /** kg/semana que o perfil planejou (negativo = perder). */
  planejado: number;
  real: number;
  /** Diferença em kg/semana (real − planejado). */
  gap: number;
  /** Ajuste em kcal/dia, limitado a ±250. */
  ajusteKcal: number;
  novaMeta: number;
  /** true quando o ajuste foi cortado pelo piso da TMB. */
  cortadoPelaTmb: boolean;
};

/** Acima disto o ritmo real difere do plano o bastante para sugerir ajuste. */
export const GAP_MINIMO_KG_SEM = 0.12;
export const AJUSTE_MAXIMO_KCAL = 250;

/**
 * Compara o ritmo real com o planejado e sugere uma nova meta.
 * Ajuste limitado a ±250 kcal/dia e nunca abaixo da TMB (SPEC §3.6).
 */
export function sugerirMeta(t: Tendencia, a: Alvos, p: PerfilCalc): SugestaoMeta | null {
  const planejado = -Math.abs(p.kg_sem) * Math.sign(p.kg_sem || 1);
  const real = t.kgSemana;
  const gap = real - planejado;

  if (Math.abs(gap) < GAP_MINIMO_KG_SEM) return null;

  // Perdendo menos que o plano (gap > 0) → cortar kcal.
  const bruto = -(gap * KCAL_POR_KG_GORDURA) / 7;
  const ajuste = arred(Math.max(-AJUSTE_MAXIMO_KCAL, Math.min(AJUSTE_MAXIMO_KCAL, bruto)));
  const alvo = a.meta + ajuste;
  const novaMeta = Math.max(alvo, a.tmb);

  return {
    planejado: arred(planejado, 3),
    real,
    gap: arred(gap, 3),
    ajusteKcal: arred(novaMeta - a.meta),
    novaMeta: arred(novaMeta),
    cortadoPelaTmb: alvo < a.tmb,
  };
}

/* ------------------------------------------------------------------ */
/* Período                                                             */
/* ------------------------------------------------------------------ */

export type DiaTotal = { dia: string; kcal: number; prot: number; carb: number; gord: number };

export type ResumoPeriodo = {
  diasComRegistro: number;
  kcalTotal: number;
  kcalMedia: number;
  deficitAcumulado: number;
  deficitMedio: number;
  /** Equivalente teórico em kg de gordura (7.700 kcal/kg). */
  gorduraEquivalenteKg: number;
  prot: number;
  carb: number;
  gord: number;
  protGkg: number;
  pctProt: number;
  pctCarb: number;
  pctGord: number;
};

/**
 * Resumo do período. Só entram dias com pelo menos uma refeição registrada
 * (SPEC §4) — dia sem registro não é dia de déficit, é dia sem dado.
 */
export function resumoPeriodo(dias: DiaTotal[], meta: number, peso_kg: number): ResumoPeriodo {
  const comRegistro = dias.filter((d) => d.kcal > 0);
  const n = comRegistro.length;

  if (n === 0) {
    return {
      diasComRegistro: 0,
      kcalTotal: 0,
      kcalMedia: 0,
      deficitAcumulado: 0,
      deficitMedio: 0,
      gorduraEquivalenteKg: 0,
      prot: 0,
      carb: 0,
      gord: 0,
      protGkg: 0,
      pctProt: 0,
      pctCarb: 0,
      pctGord: 0,
    };
  }

  const soma = comRegistro.reduce(
    (acc, d) => ({
      kcal: acc.kcal + d.kcal,
      prot: acc.prot + d.prot,
      carb: acc.carb + d.carb,
      gord: acc.gord + d.gord,
    }),
    { kcal: 0, prot: 0, carb: 0, gord: 0 },
  );

  const kcalMedia = soma.kcal / n;
  const deficitAcumulado = meta * n - soma.kcal;
  const prot = soma.prot / n;
  const carb = soma.carb / n;
  const gord = soma.gord / n;
  const kcalMacros = kcalDeMacros(prot, carb, gord) || 1;

  return {
    diasComRegistro: n,
    kcalTotal: arred(soma.kcal),
    kcalMedia: arred(kcalMedia),
    deficitAcumulado: arred(deficitAcumulado),
    deficitMedio: arred(deficitAcumulado / n),
    gorduraEquivalenteKg: arred(deficitAcumulado / KCAL_POR_KG_GORDURA, 2),
    prot: arred(prot),
    carb: arred(carb),
    gord: arred(gord),
    protGkg: peso_kg > 0 ? arred(prot / peso_kg, 2) : 0,
    pctProt: arred((4 * prot * 100) / kcalMacros),
    pctCarb: arred((4 * carb * 100) / kcalMacros),
    pctGord: arred((9 * gord * 100) / kcalMacros),
  };
}

/** Variação de peso prevista pelo déficit acumulado, em kg. */
export function variacaoPrevistaKg(deficitAcumulado: number): number {
  return arred(-deficitAcumulado / KCAL_POR_KG_GORDURA, 2);
}

/* ------------------------------------------------------------------ */
/* Datas (tudo em America/Sao_Paulo, formato YYYY-MM-DD)               */
/* ------------------------------------------------------------------ */

export const TZ = "America/Sao_Paulo";

export function hojeISO(agora = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(agora);
}

export function horaAgora(agora = new Date()): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(agora);
}

export function somaDias(diaISO: string, n: number): string {
  const d = new Date(`${diaISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "seg, 3 fev" — cabeçalho do Diário. */
export function rotuloDia(diaISO: string, hoje = hojeISO()): string {
  if (diaISO === hoje) return "Hoje";
  if (diaISO === somaDias(hoje, -1)) return "Ontem";
  const d = new Date(`${diaISO}T12:00:00Z`);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}
