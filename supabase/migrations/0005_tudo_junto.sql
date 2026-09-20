-- Migration única: aplica tudo que faltou e amplia a tabela de alimentos.
--
-- Seguro rodar mais de uma vez, e seguro rodar mesmo que a 0003 e a 0004 já
-- tenham sido aplicadas. Se você não sabe o que já rodou, rode só esta.

-- ---------------------------------------------------------------- --
-- 1. Permissão da view de totais (era a 0003)                       --
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

grant select on public.day_totals to authenticated;
grant select on public.taco to authenticated;

-- ---------------------------------------------------------------- --
-- 2. Procedência de cada linha (era a 0004)                         --
-- ---------------------------------------------------------------- --
alter table public.meal_items
  add column if not exists fonte text not null default 'estimativa';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'meal_items_fonte_check') then
    alter table public.meal_items
      add constraint meal_items_fonte_check
      check (fonte in ('taco', 'rotulo', 'receita', 'estimativa', 'manual'));
  end if;
end $$;

-- ---------------------------------------------------------------- --
-- 3. Perfil para quem entrou sem passar pelo trigger                --
-- ---------------------------------------------------------------- --
insert into public.profiles (user_id, nome)
select u.id, split_part(coalesce(u.email, ''), '@', 1)
from auth.users u
where not exists (select 1 from public.profiles p where p.user_id = u.id);

-- ---------------------------------------------------------------- --
-- 4. Busca por semelhança de nome                                   --
-- ---------------------------------------------------------------- --
create extension if not exists pg_trgm;
create index if not exists taco_nome_trgm_idx on public.taco using gin (nome gin_trgm_ops);

-- ---------------------------------------------------------------- --
-- 5. Mais alimentos                                                 --
-- ---------------------------------------------------------------- --
-- Valores por 100 g ou 100 ml. `fonte` diz de onde veio cada linha:
--   TACO      — tabela TACO/UNICAMP, alimento in natura ou preparação caseira
--   rótulo    — média de rótulo de mercado (industrializado, suplemento)
--   preparo   — preparação típica, valor médio de receita caseira
-- Nome repetido é atualizado, não duplicado.

insert into public.taco (nome, kcal, prot, carb, gord, unidade, fonte) values
  -- frutas
  ('Goiaba vermelha', 54, 1.1, 13.0, 0.4, 'g', 'TACO'),
  ('Tangerina', 38, 0.8, 9.6, 0.1, 'g', 'TACO'),
  ('Limão', 32, 0.9, 11.1, 0.1, 'g', 'TACO'),
  ('Maracujá (polpa)', 68, 2.0, 12.3, 2.1, 'g', 'TACO'),
  ('Acerola', 33, 0.9, 8.0, 0.2, 'g', 'TACO'),
  ('Caju', 43, 1.0, 10.3, 0.3, 'g', 'TACO'),
  ('Caqui', 71, 0.4, 19.3, 0.1, 'g', 'TACO'),
  ('Ameixa', 53, 0.8, 13.9, 0.0, 'g', 'TACO'),
  ('Pêssego', 36, 0.8, 9.3, 0.1, 'g', 'TACO'),
  ('Figo', 41, 1.0, 10.2, 0.2, 'g', 'TACO'),
  ('Jabuticaba', 58, 0.6, 15.3, 0.1, 'g', 'TACO'),
  ('Graviola', 62, 0.8, 15.8, 0.2, 'g', 'TACO'),
  ('Cupuaçu (polpa)', 49, 1.0, 11.0, 0.6, 'g', 'TACO'),
  ('Ameixa seca', 240, 2.2, 63.9, 0.4, 'g', 'TACO'),
  ('Damasco seco', 241, 3.4, 62.6, 0.5, 'g', 'rótulo'),
  ('Tâmara seca', 282, 2.5, 75.0, 0.4, 'g', 'rótulo'),
  ('Banana passa', 318, 3.0, 84.0, 0.6, 'g', 'TACO'),

  -- verduras, legumes e raízes
  ('Agrião', 17, 2.7, 2.3, 0.2, 'g', 'TACO'),
  ('Acelga', 21, 1.4, 4.6, 0.2, 'g', 'TACO'),
  ('Almeirão', 14, 1.8, 2.2, 0.2, 'g', 'TACO'),
  ('Escarola', 19, 1.6, 3.4, 0.2, 'g', 'TACO'),
  ('Aipo (salsão)', 18, 0.8, 3.8, 0.1, 'g', 'TACO'),
  ('Alho-poró', 32, 1.4, 7.3, 0.2, 'g', 'TACO'),
  ('Quiabo', 30, 1.9, 6.4, 0.3, 'g', 'TACO'),
  ('Jiló', 27, 1.4, 5.7, 0.2, 'g', 'TACO'),
  ('Maxixe', 14, 1.0, 2.7, 0.1, 'g', 'TACO'),
  ('Rabanete', 14, 1.1, 2.7, 0.1, 'g', 'TACO'),
  ('Nabo', 18, 1.1, 4.0, 0.1, 'g', 'TACO'),
  ('Palmito em conserva', 23, 2.1, 3.8, 0.2, 'g', 'TACO'),
  ('Couve-flor cozida', 19, 1.6, 3.9, 0.2, 'g', 'TACO'),
  ('Pimentão vermelho', 24, 1.0, 5.5, 0.3, 'g', 'TACO'),
  ('Tomate seco em conserva', 213, 3.0, 12.0, 17.0, 'g', 'rótulo'),
  ('Azeitona verde', 137, 1.0, 4.0, 13.0, 'g', 'TACO'),
  ('Batata doce crua', 118, 1.3, 28.2, 0.1, 'g', 'TACO'),
  ('Mandioquinha (batata baroa) cozida', 80, 1.0, 18.9, 0.2, 'g', 'TACO'),
  ('Cará cozido', 96, 1.8, 22.0, 0.1, 'g', 'TACO'),

  -- cereais, massas e pães
  ('Pão de forma branco', 269, 8.0, 49.0, 3.5, 'g', 'rótulo'),
  ('Pão integral (fatia)', 253, 9.4, 49.9, 3.7, 'g', 'TACO'),
  ('Pão sírio', 275, 9.0, 55.0, 1.5, 'g', 'rótulo'),
  ('Bisnaguinha', 307, 8.4, 54.0, 6.0, 'g', 'rótulo'),
  ('Torrada', 400, 12.0, 70.0, 8.0, 'g', 'rótulo'),
  ('Biscoito água e sal', 432, 10.0, 70.0, 12.0, 'g', 'rótulo'),
  ('Biscoito cream cracker', 432, 10.0, 70.0, 12.0, 'g', 'rótulo'),
  ('Biscoito de polvilho', 440, 3.0, 72.0, 15.0, 'g', 'rótulo'),
  ('Nhoque de batata cozido', 152, 4.0, 30.0, 1.5, 'g', 'preparo'),
  ('Macarrão integral cozido', 124, 5.3, 25.0, 0.9, 'g', 'rótulo'),
  ('Trigo para quibe cru', 349, 12.3, 73.0, 1.7, 'g', 'TACO'),
  ('Aveia farelo (bran)', 360, 15.6, 50.8, 7.0, 'g', 'rótulo'),
  ('Granola sem açúcar', 420, 12.0, 58.0, 15.0, 'g', 'rótulo'),
  ('Flocos de milho (sucrilhos)', 380, 7.0, 84.0, 1.0, 'g', 'rótulo'),
  ('Polvilho doce', 351, 0.3, 86.9, 0.1, 'g', 'TACO'),
  ('Fubá', 353, 7.2, 78.9, 1.9, 'g', 'TACO'),

  -- carnes, aves e ovos
  ('Costela bovina assada', 373, 24.0, 0.0, 30.5, 'g', 'TACO'),
  ('Cupim assado', 330, 25.0, 0.0, 25.5, 'g', 'TACO'),
  ('Maminha grelhada', 218, 30.0, 0.0, 10.5, 'g', 'TACO'),
  ('Fraldinha grelhada', 250, 28.0, 0.0, 15.0, 'g', 'TACO'),
  ('Carne seca cozida', 313, 32.0, 0.0, 20.0, 'g', 'TACO'),
  ('Coração de frango grelhado', 215, 26.0, 0.0, 12.0, 'g', 'TACO'),
  ('Asa de frango assada', 250, 25.0, 0.0, 16.5, 'g', 'TACO'),
  ('Frango à passarinho frito', 290, 24.0, 4.0, 19.5, 'g', 'preparo'),
  ('Ovo de codorna cozido', 177, 13.7, 0.6, 13.0, 'g', 'TACO'),
  ('Omelete simples (2 ovos)', 200, 13.0, 1.0, 16.0, 'g', 'preparo'),
  ('Mortadela', 269, 12.0, 4.0, 22.5, 'g', 'rótulo'),
  ('Salame', 398, 22.0, 2.0, 33.0, 'g', 'rótulo'),
  ('Linguiça calabresa', 296, 19.6, 0.0, 23.8, 'g', 'TACO'),
  ('Peito de frango defumado', 110, 20.0, 1.5, 2.5, 'g', 'rótulo'),

  -- pescados
  ('Pescada cozida', 110, 23.0, 0.0, 1.5, 'g', 'TACO'),
  ('Corvina grelhada', 130, 25.0, 0.0, 3.0, 'g', 'TACO'),
  ('Robalo grelhado', 123, 24.5, 0.0, 2.5, 'g', 'TACO'),
  ('Cavala grelhada', 200, 24.0, 0.0, 11.5, 'g', 'TACO'),
  ('Lula cozida', 92, 15.6, 3.1, 1.4, 'g', 'TACO'),
  ('Polvo cozido', 96, 17.0, 2.6, 1.2, 'g', 'TACO'),
  ('Mexilhão cozido', 86, 12.0, 3.7, 2.2, 'g', 'TACO'),
  ('Salmão cru', 170, 20.0, 0.0, 10.0, 'g', 'TACO'),

  -- laticínios
  ('Leite semidesnatado', 47, 3.3, 4.8, 1.6, 'ml', 'rótulo'),
  ('Leite em pó integral', 497, 26.0, 38.0, 27.0, 'g', 'rótulo'),
  ('Leite sem lactose integral', 61, 3.2, 4.7, 3.3, 'ml', 'rótulo'),
  ('Iogurte grego zero', 60, 9.5, 4.5, 0.2, 'g', 'rótulo'),
  ('Iogurte de morango', 85, 3.0, 14.0, 2.0, 'g', 'rótulo'),
  ('Kefir', 55, 3.3, 4.5, 2.5, 'ml', 'rótulo'),
  ('Queijo coalho', 300, 22.0, 2.0, 23.0, 'g', 'rótulo'),
  ('Ricota', 140, 11.0, 3.8, 8.5, 'g', 'TACO'),
  ('Queijo provolone', 366, 25.6, 2.1, 28.5, 'g', 'rótulo'),
  ('Queijo gorgonzola', 353, 21.0, 2.3, 28.7, 'g', 'rótulo'),
  ('Queijo cheddar', 403, 24.9, 1.3, 33.1, 'g', 'rótulo'),
  ('Catupiry (requeijão cremoso)', 264, 10.0, 3.0, 23.0, 'g', 'rótulo'),
  ('Manteiga sem sal', 726, 0.4, 0.1, 82.4, 'g', 'TACO'),
  ('Doce de leite', 306, 5.5, 59.0, 6.0, 'g', 'TACO'),

  -- óleos, castanhas e sementes
  ('Óleo de coco', 862, 0.0, 0.0, 100.0, 'ml', 'rótulo'),
  ('Óleo de canola', 884, 0.0, 0.0, 100.0, 'ml', 'rótulo'),
  ('Óleo de girassol', 884, 0.0, 0.0, 100.0, 'ml', 'rótulo'),
  ('Banha de porco', 898, 0.0, 0.0, 99.5, 'g', 'TACO'),
  ('Pistache', 567, 20.6, 27.5, 45.4, 'g', 'rótulo'),
  ('Macadâmia', 718, 7.9, 13.8, 75.8, 'g', 'rótulo'),
  ('Avelã', 628, 15.0, 16.7, 60.8, 'g', 'rótulo'),
  ('Semente de girassol', 584, 20.8, 20.0, 51.5, 'g', 'rótulo'),
  ('Semente de abóbora', 559, 30.2, 10.7, 49.1, 'g', 'rótulo'),
  ('Gergelim', 573, 17.7, 23.5, 49.7, 'g', 'TACO'),
  ('Pasta de amendoim integral', 588, 25.0, 20.0, 50.0, 'g', 'rótulo'),
  ('Coco ralado seco', 660, 7.0, 24.0, 60.0, 'g', 'TACO'),

  -- preparações brasileiras
  ('Baião de dois', 140, 6.5, 19.0, 4.0, 'g', 'preparo'),
  ('Escondidinho de carne', 150, 8.0, 14.0, 7.0, 'g', 'preparo'),
  ('Moqueca de peixe', 110, 11.0, 3.0, 6.0, 'g', 'preparo'),
  ('Tutu de feijão', 137, 6.0, 18.0, 4.5, 'g', 'preparo'),
  ('Picadinho de carne', 160, 15.0, 3.0, 9.5, 'g', 'preparo'),
  ('Macarronada com molho', 160, 6.0, 24.0, 4.5, 'g', 'preparo'),
  ('Yakisoba', 130, 6.0, 18.0, 3.5, 'g', 'preparo'),
  ('Risoto de frango', 155, 8.0, 20.0, 4.5, 'g', 'preparo'),
  ('Purê de batata', 110, 2.0, 15.0, 4.5, 'g', 'preparo'),
  ('Mandioca frita', 290, 1.5, 36.0, 15.0, 'g', 'preparo'),
  ('Polenta frita', 220, 2.5, 30.0, 10.0, 'g', 'preparo'),
  ('Torresmo', 590, 30.0, 0.0, 52.0, 'g', 'preparo'),
  ('Panqueca de carne', 195, 10.0, 18.0, 9.0, 'g', 'preparo'),
  ('Sushi (unidade média)', 145, 5.0, 27.0, 1.5, 'g', 'preparo'),
  ('Temaki de salmão', 180, 9.0, 24.0, 5.5, 'g', 'preparo'),
  ('Salada de maionese', 180, 2.0, 12.0, 14.0, 'g', 'preparo'),
  ('Vinagrete', 45, 0.8, 4.0, 3.0, 'g', 'preparo'),

  -- salgados e lanches
  ('Pastel de carne frito', 310, 9.0, 30.0, 17.0, 'g', 'preparo'),
  ('Esfiha de carne', 250, 10.0, 30.0, 10.0, 'g', 'preparo'),
  ('Empada de frango', 330, 8.0, 32.0, 19.0, 'g', 'preparo'),
  ('Quibe frito', 280, 13.0, 22.0, 16.0, 'g', 'preparo'),
  ('Bolinho de bacalhau', 290, 12.0, 22.0, 17.0, 'g', 'preparo'),
  ('Pão de batata com requeijão', 300, 7.0, 40.0, 12.0, 'g', 'preparo'),
  ('X-burger', 260, 13.0, 22.0, 13.0, 'g', 'preparo'),
  ('X-salada', 240, 12.5, 21.0, 12.0, 'g', 'preparo'),
  ('Cachorro-quente', 240, 9.0, 28.0, 10.0, 'g', 'preparo'),
  ('Nuggets de frango', 290, 15.0, 17.0, 18.0, 'g', 'rótulo'),
  ('Pizza portuguesa (fatia)', 240, 12.0, 26.0, 9.5, 'g', 'preparo'),
  ('Pizza de frango com catupiry (fatia)', 270, 14.0, 26.0, 12.0, 'g', 'preparo'),
  ('Batata frita de fast food', 312, 3.4, 41.0, 15.0, 'g', 'rótulo'),

  -- doces
  ('Brigadeiro', 390, 5.0, 55.0, 17.0, 'g', 'preparo'),
  ('Beijinho', 380, 4.5, 56.0, 16.0, 'g', 'preparo'),
  ('Pudim de leite', 180, 5.0, 28.0, 5.5, 'g', 'preparo'),
  ('Mousse de chocolate', 260, 4.0, 30.0, 14.0, 'g', 'preparo'),
  ('Bolo de chocolate', 380, 5.5, 55.0, 15.0, 'g', 'preparo'),
  ('Bolo de cenoura com cobertura', 370, 4.5, 55.0, 14.5, 'g', 'preparo'),
  ('Goiabada', 285, 0.4, 72.0, 0.1, 'g', 'TACO'),
  ('Paçoca', 480, 12.0, 50.0, 25.0, 'g', 'rótulo'),
  ('Pé de moleque', 490, 13.0, 48.0, 27.0, 'g', 'rótulo'),
  ('Cocada', 420, 3.0, 65.0, 17.0, 'g', 'preparo'),
  ('Açúcar mascavo', 369, 0.1, 95.0, 0.1, 'g', 'TACO'),
  ('Melado de cana', 297, 0.0, 76.0, 0.0, 'g', 'TACO'),
  ('Geleia de frutas', 265, 0.3, 65.0, 0.1, 'g', 'rótulo'),
  ('Nutella (creme de avelã)', 539, 6.3, 57.5, 30.9, 'g', 'rótulo'),
  ('Sorvete de chocolate', 216, 3.8, 25.0, 11.0, 'g', 'rótulo'),
  ('Açaí com guaraná (polpa doce)', 110, 1.0, 22.0, 2.5, 'g', 'rótulo'),

  -- bebidas
  ('Água de coco', 22, 0.2, 5.3, 0.0, 'ml', 'TACO'),
  ('Suco de uva integral', 61, 0.3, 15.0, 0.1, 'ml', 'rótulo'),
  ('Suco de laranja industrializado', 45, 0.5, 11.0, 0.1, 'ml', 'rótulo'),
  ('Limonada com açúcar', 42, 0.1, 10.5, 0.0, 'ml', 'preparo'),
  ('Chá mate com açúcar', 28, 0.0, 7.0, 0.0, 'ml', 'rótulo'),
  ('Chá sem açúcar', 1, 0.0, 0.2, 0.0, 'ml', 'TACO'),
  ('Guaraná (refrigerante)', 40, 0.0, 10.0, 0.0, 'ml', 'rótulo'),
  ('Energético', 45, 0.0, 11.0, 0.0, 'ml', 'rótulo'),
  ('Vinho tinto seco', 82, 0.1, 2.6, 0.0, 'ml', 'TACO'),
  ('Cerveja sem álcool', 25, 0.4, 5.5, 0.0, 'ml', 'rótulo'),
  ('Cachaça', 231, 0.0, 0.0, 0.0, 'ml', 'TACO'),
  ('Vodka', 231, 0.0, 0.0, 0.0, 'ml', 'rótulo'),
  ('Caipirinha', 160, 0.1, 15.0, 0.0, 'ml', 'preparo'),
  ('Vitamina de banana com leite', 90, 3.0, 14.0, 2.5, 'ml', 'preparo'),
  ('Leite fermentado (Yakult)', 71, 1.2, 16.0, 0.1, 'ml', 'rótulo'),

  -- suplementos
  ('Creatina', 0, 0.0, 0.0, 0.0, 'g', 'rótulo'),
  ('Maltodextrina', 380, 0.0, 95.0, 0.0, 'g', 'rótulo'),
  ('Dextrose', 380, 0.0, 95.0, 0.0, 'g', 'rótulo'),
  ('Hipercalórico em pó', 380, 15.0, 75.0, 3.0, 'g', 'rótulo'),
  ('Colágeno hidrolisado', 360, 90.0, 0.0, 0.0, 'g', 'rótulo'),
  ('Whey protein 3W', 375, 78.0, 8.0, 3.0, 'g', 'rótulo'),

  -- molhos e temperos
  ('Shoyu', 53, 5.0, 8.0, 0.1, 'ml', 'rótulo'),
  ('Mostarda', 66, 4.0, 5.0, 3.5, 'g', 'rótulo'),
  ('Molho barbecue', 172, 0.8, 41.0, 0.6, 'g', 'rótulo'),
  ('Molho de alho', 320, 1.5, 6.0, 33.0, 'g', 'rótulo'),
  ('Creme de cebola (pó)', 330, 8.0, 55.0, 8.0, 'g', 'rótulo'),
  ('Caldo de galinha (cubo)', 240, 10.0, 20.0, 14.0, 'g', 'rótulo')
on conflict (nome) do update set
  kcal = excluded.kcal,
  prot = excluded.prot,
  carb = excluded.carb,
  gord = excluded.gord,
  unidade = excluded.unidade,
  fonte = excluded.fonte;
