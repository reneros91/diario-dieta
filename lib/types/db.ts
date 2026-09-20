/**
 * Tipos do banco.
 *
 * Mantidos à mão no mesmo formato que `supabase gen types typescript` produz,
 * para que dê para regenerar por cima quando o esquema mudar:
 *
 *   npx supabase gen types typescript --project-id <id> > lib/types/db.ts
 */

type Tabela<Row, Ins = Partial<Row>, Upd = Partial<Row>, Rel = []> = {
  Row: Row;
  Insert: Ins;
  Update: Upd;
  Relationships: Rel;
};

/** As chaves estrangeiras que o supabase-js usa para resolver `select("*, filhos(*)")`. */
type FK<Nome extends string, Coluna extends string, Alvo extends string> = {
  foreignKeyName: Nome;
  columns: [Coluna];
  isOneToOne: false;
  referencedRelation: Alvo;
  referencedColumns: ["id"];
};

export type Sexo = "m" | "f";
export type TipoRefeicao = "cafe" | "almoco" | "lanche" | "jantar" | "ceia";
export type Unidade = "g" | "ml" | "porcao";
export type OrigemRefeicao = "ia" | "taco" | "receita" | "alimento" | "favorito" | "manual";
export type NivelAtividade = "sentado" | "leve" | "ativo";
export type TipoChamadaIA = "chat" | "receita" | "analise";

export type ProfileRow = {
  user_id: string;
  nome: string | null;
  sexo: Sexo;
  idade: number;
  altura_cm: number;
  peso_kg: number;
  gordura_pct: number | null;
  fator: number;
  kg_sem: number;
  deficit_kcal: number | null;
  meta_manual: number | null;
  prot_gkg: number;
  gord_pct: number;
  ingest_token: string | null;
  plano: string;
  ai_diario_limite: number;
  created_at: string;
  updated_at: string;
};

export type MealRow = {
  id: string;
  user_id: string;
  dia: string;
  tipo: TipoRefeicao;
  nome: string;
  hora: string | null;
  origem: OrigemRefeicao;
  created_at: string;
  updated_at: string;
};

export type FonteItem = "taco" | "rotulo" | "receita" | "estimativa" | "manual";

export type MealItemRow = {
  id: string;
  meal_id: string;
  nome: string;
  qtd: number;
  unidade: Unidade;
  /** De onde saiu o número desta linha. */
  fonte: FonteItem;
  k100: number;
  p100: number;
  c100: number;
  g100: number;
  ordem: number;
  created_at: string;
};

export type WorkoutRow = {
  id: string;
  user_id: string;
  dia: string;
  nome: string;
  minutos: number | null;
  kcal_estimadas: number | null;
  fonte: "manual" | "watch";
  created_at: string;
};

export type DayNoteRow = {
  user_id: string;
  dia: string;
  passos: number | null;
  sono_h: number | null;
  atividade: NivelAtividade | null;
  obs: string | null;
  created_at: string;
  updated_at: string;
};

export type WeighinRow = {
  id: string;
  user_id: string;
  dia: string;
  peso: number;
  gordura_pct: number | null;
  massa_muscular: number | null;
  agua_pct: number | null;
  visceral: number | null;
  idade_metabolica: number | null;
  fonte: "manual" | "ia" | "balanca";
  created_at: string;
};

export type RecipeRow = {
  id: string;
  user_id: string;
  nome: string;
  porcoes: number;
  peso_pronto_g: number | null;
  obs: string | null;
  publica: boolean;
  created_at: string;
  updated_at: string;
};

export type RecipeItemRow = {
  id: string;
  recipe_id: string;
  nome: string;
  qtd_pronto: number;
  unidade: Unidade;
  k100: number;
  p100: number;
  c100: number;
  g100: number;
  ordem: number;
};

export type FoodRow = {
  id: string;
  user_id: string;
  nome: string;
  unidade: Unidade;
  porcao_rotulo: number | null;
  k100: number;
  p100: number;
  c100: number;
  g100: number;
  created_at: string;
};

/** Item guardado dentro de um favorito (jsonb). */
export type FavoritoItem = {
  nome: string;
  qtd: number;
  unidade: Unidade;
  k100: number;
  p100: number;
  c100: number;
  g100: number;
};

export type FavoriteRow = {
  id: string;
  user_id: string;
  nome: string;
  itens: FavoritoItem[];
  created_at: string;
};

export type MessageRow = {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  texto: string;
  fotos: number;
  cards: unknown | null;
  created_at: string;
};

export type TacoRow = {
  id: number;
  nome: string;
  kcal: number;
  prot: number;
  carb: number;
  gord: number;
  unidade: "g" | "ml";
  fonte: string;
};

export type AiCallRow = {
  id: string;
  user_id: string;
  tipo: TipoChamadaIA;
  modelo: string;
  tokens_in: number;
  tokens_out: number;
  tokens_cache_read: number;
  tokens_cache_write: number;
  imagens: number;
  ms: number;
  custo_usd_est: number;
  entrada_hash: string | null;
  resposta: unknown | null;
  created_at: string;
};

export type DayTotalRow = {
  user_id: string;
  dia: string;
  kcal: number;
  prot: number;
  carb: number;
  gord: number;
};

export type Database = {
  public: {
    Tables: {
      profiles: Tabela<ProfileRow, Partial<ProfileRow> & { user_id: string }>;
      meals: Tabela<MealRow, Omit<MealRow, "id" | "created_at" | "updated_at"> & { id?: string }>;
      meal_items: Tabela<
        MealItemRow,
        Omit<MealItemRow, "id" | "created_at"> & { id?: string },
        Partial<MealItemRow>,
        [FK<"meal_items_meal_id_fkey", "meal_id", "meals">]
      >;
      workouts: Tabela<WorkoutRow, Omit<WorkoutRow, "id" | "created_at"> & { id?: string }>;
      day_notes: Tabela<DayNoteRow, Partial<DayNoteRow> & { user_id: string; dia: string }>;
      weighins: Tabela<WeighinRow, Omit<WeighinRow, "id" | "created_at"> & { id?: string }>;
      recipes: Tabela<
        RecipeRow,
        Omit<RecipeRow, "id" | "created_at" | "updated_at"> & { id?: string }
      >;
      recipe_items: Tabela<
        RecipeItemRow,
        Omit<RecipeItemRow, "id"> & { id?: string },
        Partial<RecipeItemRow>,
        [FK<"recipe_items_recipe_id_fkey", "recipe_id", "recipes">]
      >;
      foods: Tabela<FoodRow, Omit<FoodRow, "id" | "created_at"> & { id?: string }>;
      favorites: Tabela<FavoriteRow, Omit<FavoriteRow, "id" | "created_at"> & { id?: string }>;
      messages: Tabela<MessageRow, Omit<MessageRow, "id" | "created_at"> & { id?: string }>;
      taco: Tabela<TacoRow, Omit<TacoRow, "id">>;
      ai_calls: Tabela<AiCallRow, Omit<AiCallRow, "id" | "created_at"> & { id?: string }>;
    };
    Views: {
      day_totals: { Row: DayTotalRow; Relationships: [] };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

/** Refeição com as linhas dentro — é o formato do cartão. */
export type MealComItens = MealRow & { meal_items: MealItemRow[] };
