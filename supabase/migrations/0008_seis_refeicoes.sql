-- 0008_seis_refeicoes.sql
--
-- O diario passa a ter seis refeicoes fixas, sempre visiveis:
-- cafe, lanche da manha, almoco, lanche da tarde, jantar, ceia.
--
-- Antes eram cinco, com um "lanche" so para as duas pontas do dia. O lanche da
-- manha e o da tarde nao se parecem em nada, e juntar os dois escondia metade
-- do que a pessoa come.
--
-- 'lanche' continua aceito na restricao de proposito: se o app novo subir antes
-- desta migration rodar, ou o contrario, nenhuma gravacao quebra. As linhas
-- antigas viram lanche da tarde, que e onde a maioria delas estava.

alter table public.meals drop constraint if exists meals_tipo_check;

alter table public.meals add constraint meals_tipo_check check (
  tipo in ('cafe', 'lanche_manha', 'almoco', 'lanche_tarde', 'jantar', 'ceia', 'lanche')
);

update public.meals set tipo = 'lanche_tarde' where tipo = 'lanche';
