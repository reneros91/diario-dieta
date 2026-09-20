import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Ações que a IA pode registrar (SPEC §6.3)                           */
/* ------------------------------------------------------------------ */

export const zItemIA = z.object({
  nome: z.string().trim().min(1).max(120),
  quantidade: z.number().positive().max(100000),
  unidade: z.enum(["g", "ml"]),
  kcal: z.number().min(0).max(100000),
  prot: z.number().min(0).max(5000),
  carb: z.number().min(0).max(5000),
  gord: z.number().min(0).max(5000),
  /** Álcool puro em gramas: o quarto termo da conta de caloria, a 7 kcal/g. */
  alcool: z.number().min(0).max(1000).default(0),
  /** Declarada pela IA; o app confere contra a tabela e corrige. */
  fonte: z.enum(["taco", "rotulo", "web", "estimativa"]).default("estimativa"),
  /** Onde exatamente: marca do rótulo, site pesquisado. */
  fonte_detalhe: z.string().trim().max(200).nullable().default(null),
});

export const zAcao = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("refeicao"),
    refeicao: z.enum(["cafe", "almoco", "lanche", "jantar", "ceia"]),
    nome: z.string().trim().min(1).max(120),
    itens: z.array(zItemIA).min(1).max(20),
  }),
  z.object({
    tipo: z.literal("treino"),
    nome: z.string().trim().min(1).max(80),
    min: z.number().min(0).max(1440).nullable(),
    kcal: z.number().min(0).max(10000).nullable(),
  }),
  z.object({
    tipo: z.literal("peso"),
    peso: z.number().min(30).max(400),
    gordura: z.number().min(2).max(70).nullable(),
    massa_muscular: z.number().min(10).max(200).nullable(),
  }),
  z.object({
    tipo: z.literal("dia"),
    passos: z.number().int().min(0).max(200000).nullable(),
    sono: z.number().min(0).max(24).nullable(),
    atividade: z.enum(["sentado", "leve", "ativo"]).nullable(),
  }),
  z.object({
    tipo: z.literal("alimento"),
    nome: z.string().trim().min(1).max(120),
    porcao: z.number().positive().max(10000),
    unidade: z.enum(["g", "ml"]),
    kcal: z.number().min(0).max(10000),
    prot: z.number().min(0).max(1000),
    carb: z.number().min(0).max(1000),
    gord: z.number().min(0).max(1000),
  }),
]);

export const zRegistro = z.object({
  resposta: z.string().trim().max(600),
  acoes: z.array(zAcao).max(8),
});

export type Acao = z.infer<typeof zAcao>;
export type Registro = z.infer<typeof zRegistro>;
export type ItemIA = z.infer<typeof zItemIA>;

/**
 * JSON Schema da tool `registrar`. Escrito à mão (e não gerado do zod) porque é
 * o contrato que a API valida — o zod confere de novo o que voltar.
 */
export const TOOL_REGISTRAR = {
  name: "registrar",
  description:
    "Registra o que a pessoa comeu, treinou, pesou ou anotou no dia, e devolve a resposta curta que ela vai ler.",
  input_schema: {
    type: "object" as const,
    additionalProperties: false,
    required: ["resposta", "acoes"],
    properties: {
      resposta: {
        type: "string",
        description: "Resposta para a pessoa, no máximo 3 frases curtas em pt-BR.",
      },
      acoes: {
        type: "array",
        description: "O que registrar. Vazio quando ela só perguntou algo.",
        items: {
          type: "object",
          required: ["tipo"],
          properties: {
            tipo: {
              type: "string",
              enum: ["refeicao", "treino", "peso", "dia", "alimento"],
            },
            refeicao: {
              type: "string",
              enum: ["cafe", "almoco", "lanche", "jantar", "ceia"],
              description: "Só para tipo=refeicao.",
            },
            nome: { type: "string", description: "Nome curto da refeição, treino ou alimento." },
            itens: {
              type: "array",
              description: "Ingredientes da refeição. Só para tipo=refeicao.",
              items: {
                type: "object",
                required: [
                  "nome", "quantidade", "unidade", "kcal", "prot", "carb", "gord",
                  "alcool", "fonte", "fonte_detalhe",
                ],
                additionalProperties: false,
                properties: {
                  nome: { type: "string" },
                  quantidade: { type: "number", description: "Quantidade consumida, em g ou ml." },
                  unidade: { type: "string", enum: ["g", "ml"] },
                  kcal: { type: "number", description: "kcal desta quantidade, não por 100 g." },
                  prot: { type: "number", description: "Proteína em g nesta quantidade." },
                  carb: { type: "number", description: "Carboidrato em g nesta quantidade." },
                  gord: { type: "number", description: "Gordura em g nesta quantidade." },
                  alcool: {
                    type: "number",
                    description:
                      "Álcool puro em gramas nesta quantidade, a 7 kcal/g. Calcule por ml × teor% ÷ 100 × 0,789. Zero para qualquer coisa que não seja bebida alcoólica.",
                  },
                  fonte: {
                    type: "string",
                    enum: ["taco", "rotulo", "web", "estimativa"],
                    description:
                      "taco quando copiou da lista ALIMENTOS DA TABELA, rotulo quando leu de um rótulo na foto, web quando pesquisou com web_search. Nunca use estimativa: se não tem fonte, não registre a linha e peça o que falta.",
                  },
                  fonte_detalhe: {
                    type: ["string", "null"],
                    description:
                      "Onde exatamente: a marca e o produto do rótulo, ou o site de onde veio o valor pesquisado. Null quando a fonte é taco.",
                  },
                },
              },
            },
            min: { type: ["number", "null"], description: "Minutos de treino. Só para tipo=treino." },
            kcal: {
              type: ["number", "null"],
              description: "kcal do treino, do alimento ou nulo. Nunca abate da meta.",
            },
            peso: { type: "number", description: "Peso em kg. Só para tipo=peso." },
            gordura: { type: ["number", "null"], description: "% de gordura. Só para tipo=peso." },
            massa_muscular: { type: ["number", "null"], description: "kg de massa muscular." },
            passos: { type: ["number", "null"], description: "Passos do dia. Só para tipo=dia." },
            sono: { type: ["number", "null"], description: "Horas de sono. Só para tipo=dia." },
            atividade: {
              type: ["string", "null"],
              enum: ["sentado", "leve", "ativo", null],
              description: "Nível de atividade do dia.",
            },
            porcao: {
              type: "number",
              description: "Peso da porção do rótulo. Só para tipo=alimento.",
            },
            unidade: { type: "string", enum: ["g", "ml"] },
            prot: { type: "number" },
            carb: { type: "number" },
            gord: { type: "number" },
          },
        },
      },
    },
  },
};

/* ------------------------------------------------------------------ */
/* Receita                                                             */
/* ------------------------------------------------------------------ */

export const zReceitaIA = z.object({
  resposta: z.string().trim().max(400),
  peso_pronto_total: z.number().positive().max(100000).nullable(),
  itens: z
    .array(
      z.object({
        nome: z.string().trim().min(1).max(120),
        peso_pronto: z.number().positive().max(100000),
        kcal: z.number().min(0).max(100000),
        prot: z.number().min(0).max(5000),
        carb: z.number().min(0).max(5000),
        gord: z.number().min(0).max(5000),
      }),
    )
    .min(1)
    .max(30),
});

export type ReceitaIA = z.infer<typeof zReceitaIA>;

export const TOOL_RECEITA = {
  name: "receita",
  description: "Devolve os ingredientes da receita com peso pronto e macros calculados pelo cru.",
  input_schema: {
    type: "object" as const,
    additionalProperties: false,
    required: ["resposta", "itens"],
    properties: {
      resposta: { type: "string", description: "No máximo 2 frases em pt-BR." },
      peso_pronto_total: {
        type: ["number", "null"],
        description: "Peso total pronto da receita em gramas, se der para estimar.",
      },
      itens: {
        type: "array",
        items: {
          type: "object",
          required: ["nome", "peso_pronto", "kcal", "prot", "carb", "gord"],
          additionalProperties: false,
          properties: {
            nome: { type: "string" },
            peso_pronto: { type: "number", description: "Peso do ingrediente já pronto, em gramas." },
            kcal: { type: "number", description: "kcal totais deste ingrediente na receita." },
            prot: { type: "number", description: "Proteína total em g deste ingrediente." },
            carb: { type: "number", description: "Carboidrato total em g." },
            gord: { type: "number", description: "Gordura total em g." },
          },
        },
      },
    },
  },
};
