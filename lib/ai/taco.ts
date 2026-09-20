import { chaveAlimento, kcalDeMacros } from "@/lib/calc";

/**
 * Ancoragem dos números na tabela de alimentos.
 *
 * Antes daqui a IA inventava os macros de memória: o prompt mandava "use a
 * tabela TACO" e a tabela nunca era enviada. Agora os candidatos vão no
 * contexto e, quando a IA escolhe um deles, o valor que vale é o do banco —
 * não o que ela digitou.
 */

export type FonteItem = "taco" | "rotulo" | "estimativa";

export const FONTE_LABEL: Record<FonteItem, string> = {
  taco: "tabela",
  rotulo: "rótulo",
  estimativa: "estimativa",
};

export type LinhaTaco = {
  nome: string;
  kcal: number;
  prot: number;
  carb: number;
  gord: number;
  unidade: string;
};

/** Palavras que não ajudam a achar alimento nenhum. */
const VAZIAS = new Set([
  "com", "sem", "uma", "hum", "uns", "umas", "dos", "das", "para", "pela", "pelo",
  "que", "mais", "menos", "mas", "porem", "hoje", "ontem", "agora", "cedo", "tarde",
  "noite", "manha", "comi", "tomei", "almocei", "jantei", "lanchei", "acabei", "foi",
  "muito", "pouco", "meio", "meia", "grande", "pequeno", "grandes", "colher", "colheres",
  "xicara", "xicaras", "copo", "copos", "prato", "pratos", "gramas", "grama", "kcal",
  "fatia", "fatias", "pedaco", "pedacos", "unidade", "unidades", "porcao", "porcoes",
  "cheia", "cheias", "rasa", "rasas", "sopa", "cha", "café" ,"the", "and",
]);

/** Tira números, unidades e palavras vazias; sobra o que nomeia comida. */
export function palavrasDeBusca(texto: string): string[] {
  const limpo = chaveAlimento(texto).replace(/[^a-z\s]/g, " ");
  const vistas = new Set<string>();

  for (const p of limpo.split(/\s+/)) {
    if (p.length < 3 || VAZIAS.has(p)) continue;
    vistas.add(p);
    if (vistas.size >= 12) break;
  }

  return [...vistas];
}

/** Índice por nome normalizado, para casar o que a IA devolveu. */
export function indexarTaco(linhas: LinhaTaco[]): Map<string, LinhaTaco> {
  const mapa = new Map<string, LinhaTaco>();
  for (const l of linhas) mapa.set(chaveAlimento(l.nome), l);
  return mapa;
}

/** O bloco que entra no prompt. Vazio quando nada casou. */
export function listaParaPrompt(linhas: LinhaTaco[]): string {
  if (linhas.length === 0) return "";
  const itens = linhas
    .map(
      (l) =>
        `- ${l.nome}: ${l.kcal} kcal, ${l.prot} P, ${l.carb} C, ${l.gord} G por 100 ${l.unidade}`,
    )
    .join("\n");
  return `ALIMENTOS DA TABELA que combinam com o que a pessoa escreveu.\nQuando um servir, copie o nome EXATAMENTE como está aqui e use estes valores:\n${itens}`;
}

export type ItemBruto = {
  nome: string;
  quantidade: number;
  unidade: "g" | "ml";
  kcal: number;
  prot: number;
  carb: number;
  gord: number;
  fonte?: FonteItem;
};

export type ItemConciliado = ItemBruto & {
  fonte: FonteItem;
  /** Nome da tabela quando veio de lá — é o que o cartão mostra. */
  nomeTabela: string | null;
};

const arred2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Reconcilia o que a IA devolveu com a tabela.
 *
 * Nome que bate com a tabela: os macros do banco mandam, escalados pela
 * quantidade — a IA escolhe o alimento, o banco dá o número. Nome que não
 * bate: fica a estimativa dela, mas com as kcal amarradas em 4P + 4C + 9G,
 * porque macro e caloria não podem contar histórias diferentes.
 */
export function conciliarComTaco(
  itens: ItemBruto[],
  tabela: Map<string, LinhaTaco>,
): ItemConciliado[] {
  return itens.map((item) => {
    const achado = tabela.get(chaveAlimento(item.nome));

    if (achado) {
      const f = item.quantidade / 100;
      return {
        ...item,
        nome: achado.nome,
        nomeTabela: achado.nome,
        fonte: "taco",
        kcal: Math.round(achado.kcal * f),
        prot: arred2(achado.prot * f),
        carb: arred2(achado.carb * f),
        gord: arred2(achado.gord * f),
      };
    }

    const fonte: FonteItem = item.fonte === "rotulo" ? "rotulo" : "estimativa";
    const derivada = kcalDeMacros(item.prot, item.carb, item.gord);

    // Álcool tem caloria e nenhum macro: derivar de 4P+4C+9G zeraria a bebida.
    // Sem macro nenhum, o número da IA é o único que existe.
    const kcal = derivada > 0 ? Math.round(derivada) : Math.round(item.kcal);

    return {
      ...item,
      nomeTabela: null,
      fonte,
      kcal,
      prot: arred2(item.prot),
      carb: arred2(item.carb),
      gord: arred2(item.gord),
    };
  });
}

/** Total do que será gravado — é ele que a resposta do chat vai citar. */
export function totalConciliado(itens: ItemConciliado[]) {
  return itens.reduce(
    (a, i) => ({
      kcal: a.kcal + i.kcal,
      prot: a.prot + i.prot,
      carb: a.carb + i.carb,
      gord: a.gord + i.gord,
    }),
    { kcal: 0, prot: 0, carb: 0, gord: 0 },
  );
}
