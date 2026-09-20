-- Balanço — esquema inicial (SPEC §5).
-- Tudo com RLS: cada pessoa enxerga só as próprias linhas.

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------- --
-- updated_at automático                                             --
-- ---------------------------------------------------------------- --
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- --
-- profiles                                                          --
-- ---------------------------------------------------------------- --
create table if not exists public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  nome text,
  sexo text not null default 'm' check (sexo in ('m', 'f')),
  idade int not null default 30 check (idade between 10 and 110),
  altura_cm numeric(5, 1) not null default 175 check (altura_cm between 100 and 250),
  peso_kg numeric(5, 1) not null default 80 check (peso_kg between 30 and 400),
  gordura_pct numeric(4, 1) check (gordura_pct between 2 and 70),
  fator numeric(4, 3) not null default 1.375 check (fator in (1.2, 1.375, 1.55, 1.725, 1.9)),
  kg_sem numeric(3, 2) not null default 0.5 check (kg_sem between -1 and 2),
  deficit_kcal int check (deficit_kcal between -1500 and 1500),
  meta_manual int check (meta_manual between 800 and 6000),
  prot_gkg numeric(3, 1) not null default 2.0 check (prot_gkg between 0.5 and 4),
  gord_pct int not null default 25 check (gord_pct between 10 and 60),
  ingest_token text unique default encode(gen_random_bytes(24), 'hex'),
  plano text not null default 'padrao',
  ai_diario_limite int not null default 40 check (ai_diario_limite >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "perfil próprio" on public.profiles
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Todo usuário novo ganha um perfil com os padrões acima.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, nome)
  values (new.id, split_part(coalesce(new.email, ''), '@', 1))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- --
-- refeições                                                         --
-- ---------------------------------------------------------------- --
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  dia date not null,
  tipo text not null check (tipo in ('cafe', 'almoco', 'lanche', 'jantar', 'ceia')),
  nome text not null,
  hora time,
  origem text not null default 'manual'
    check (origem in ('ia', 'taco', 'receita', 'alimento', 'favorito', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meals enable row level security;

create policy "refeições próprias" on public.meals
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger meals_touch before update on public.meals
  for each row execute function public.touch_updated_at();

create index if not exists meals_user_dia_idx on public.meals (user_id, dia);

create table if not exists public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals on delete cascade,
  nome text not null,
  qtd numeric(8, 2) not null check (qtd > 0),
  unidade text not null default 'g' check (unidade in ('g', 'ml', 'porcao')),
  k100 numeric(8, 2) not null default 0 check (k100 >= 0),
  p100 numeric(8, 2) not null default 0 check (p100 >= 0),
  c100 numeric(8, 2) not null default 0 check (c100 >= 0),
  g100 numeric(8, 2) not null default 0 check (g100 >= 0),
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.meal_items enable row level security;

-- A linha pertence a quem é dono da refeição.
create policy "itens das refeições próprias" on public.meal_items
  for all to authenticated
  using (
    exists (select 1 from public.meals m where m.id = meal_id and m.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.meals m where m.id = meal_id and m.user_id = auth.uid())
  );

create index if not exists meal_items_meal_idx on public.meal_items (meal_id, ordem);

-- ---------------------------------------------------------------- --
-- treinos, nota do dia, pesagens                                    --
-- ---------------------------------------------------------------- --
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  dia date not null,
  nome text not null,
  minutos int check (minutos between 0 and 1440),
  kcal_estimadas int check (kcal_estimadas between 0 and 10000),
  fonte text not null default 'manual' check (fonte in ('manual', 'watch')),
  created_at timestamptz not null default now()
);

alter table public.workouts enable row level security;

create policy "treinos próprios" on public.workouts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists workouts_user_dia_idx on public.workouts (user_id, dia);

create index if not exists workouts_fonte_idx on public.workouts (user_id, dia, fonte);

create table if not exists public.day_notes (
  user_id uuid not null references auth.users on delete cascade,
  dia date not null,
  passos int check (passos between 0 and 200000),
  sono_h numeric(3, 1) check (sono_h between 0 and 24),
  atividade text check (atividade in ('sentado', 'leve', 'ativo')),
  obs text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, dia)
);

alter table public.day_notes enable row level security;

create policy "notas próprias" on public.day_notes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger day_notes_touch before update on public.day_notes
  for each row execute function public.touch_updated_at();

create table if not exists public.weighins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  dia date not null,
  peso numeric(5, 2) not null check (peso between 30 and 400),
  gordura_pct numeric(4, 1) check (gordura_pct between 2 and 70),
  massa_muscular numeric(5, 2) check (massa_muscular between 10 and 200),
  agua_pct numeric(4, 1) check (agua_pct between 20 and 80),
  visceral numeric(4, 1) check (visceral between 0 and 60),
  idade_metabolica int check (idade_metabolica between 10 and 120),
  fonte text not null default 'manual' check (fonte in ('manual', 'ia', 'balanca')),
  created_at timestamptz not null default now()
);

alter table public.weighins enable row level security;

create policy "pesagens próprias" on public.weighins
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists weighins_user_dia_idx on public.weighins (user_id, dia desc);

-- Uma pesagem por dia: a segunda do mesmo dia sobrescreve.
create unique index if not exists weighins_user_dia_unico on public.weighins (user_id, dia);

-- ---------------------------------------------------------------- --
-- receitas, alimentos, favoritos                                    --
-- ---------------------------------------------------------------- --
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  nome text not null,
  porcoes numeric(5, 2) not null default 1 check (porcoes > 0),
  peso_pronto_g numeric(8, 2) check (peso_pronto_g > 0),
  obs text,
  publica boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recipes enable row level security;

-- Receita pública aparece para todo mundo da casa, mas só o dono edita.
create policy "receitas visíveis" on public.recipes
  for select to authenticated
  using (user_id = auth.uid() or publica);

create policy "receitas próprias: escrita" on public.recipes
  for insert to authenticated with check (user_id = auth.uid());

create policy "receitas próprias: edição" on public.recipes
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "receitas próprias: exclusão" on public.recipes
  for delete to authenticated using (user_id = auth.uid());

create trigger recipes_touch before update on public.recipes
  for each row execute function public.touch_updated_at();

create table if not exists public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes on delete cascade,
  nome text not null,
  qtd_pronto numeric(8, 2) not null check (qtd_pronto > 0),
  unidade text not null default 'g' check (unidade in ('g', 'ml', 'porcao')),
  k100 numeric(8, 2) not null default 0,
  p100 numeric(8, 2) not null default 0,
  c100 numeric(8, 2) not null default 0,
  g100 numeric(8, 2) not null default 0,
  ordem int not null default 0
);

alter table public.recipe_items enable row level security;

create policy "itens de receita visível" on public.recipe_items
  for select to authenticated
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and (r.user_id = auth.uid() or r.publica)
    )
  );

create policy "itens de receita própria" on public.recipe_items
  for all to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()));

create index if not exists recipe_items_recipe_idx on public.recipe_items (recipe_id, ordem);

create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  nome text not null,
  unidade text not null default 'g' check (unidade in ('g', 'ml', 'porcao')),
  porcao_rotulo numeric(8, 2),
  k100 numeric(8, 2) not null default 0,
  p100 numeric(8, 2) not null default 0,
  c100 numeric(8, 2) not null default 0,
  g100 numeric(8, 2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.foods enable row level security;

create policy "alimentos próprios" on public.foods
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists foods_user_nome_idx on public.foods using gin (nome gin_trgm_ops);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  nome text not null,
  itens jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.favorites enable row level security;

create policy "favoritos próprios" on public.favorites
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------- --
-- conversa                                                          --
-- ---------------------------------------------------------------- --
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  texto text not null default '',
  fotos int not null default 0,
  cards jsonb,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "mensagens próprias" on public.messages
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists messages_user_created_idx on public.messages (user_id, created_at desc);

-- ---------------------------------------------------------------- --
-- tabela TACO (pública, só leitura)                                 --
-- ---------------------------------------------------------------- --
create table if not exists public.taco (
  id bigint generated always as identity primary key,
  nome text not null unique,
  kcal numeric(8, 2) not null,
  prot numeric(8, 2) not null,
  carb numeric(8, 2) not null,
  gord numeric(8, 2) not null,
  unidade text not null default 'g' check (unidade in ('g', 'ml')),
  fonte text not null default 'TACO'
);

alter table public.taco enable row level security;

create policy "taco é leitura para todos" on public.taco
  for select to authenticated using (true);

create index if not exists taco_nome_trgm_idx on public.taco using gin (nome gin_trgm_ops);

-- ---------------------------------------------------------------- --
-- custo de IA                                                       --
-- ---------------------------------------------------------------- --
create table if not exists public.ai_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  tipo text not null check (tipo in ('chat', 'receita', 'analise')),
  modelo text not null,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  tokens_cache_read int not null default 0,
  tokens_cache_write int not null default 0,
  imagens int not null default 0,
  ms int not null default 0,
  custo_usd_est numeric(10, 6) not null default 0,
  -- hash de texto+imagens: serve de cache de 5 min para entradas idênticas
  entrada_hash text,
  resposta jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_calls enable row level security;

create policy "chamadas próprias" on public.ai_calls
  for select to authenticated using (user_id = auth.uid());

create index if not exists ai_calls_user_created_idx on public.ai_calls (user_id, created_at desc);
create index if not exists ai_calls_hash_idx on public.ai_calls (user_id, entrada_hash, created_at desc);

-- ---------------------------------------------------------------- --
-- totais por dia (Diário e Período)                                 --
-- ---------------------------------------------------------------- --
create or replace view public.day_totals
with (security_invoker = true) as
select
  m.user_id,
  m.dia,
  round(sum(mi.qtd * mi.k100 / 100)::numeric, 0)::float8 as kcal,
  round(sum(mi.qtd * mi.p100 / 100)::numeric, 1)::float8 as prot,
  round(sum(mi.qtd * mi.c100 / 100)::numeric, 1)::float8 as carb,
  round(sum(mi.qtd * mi.g100 / 100)::numeric, 1)::float8 as gord
from public.meals m
join public.meal_items mi on mi.meal_id = m.id
group by m.user_id, m.dia;
