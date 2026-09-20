-- Procedência com citação e contagem de buscas na web.
--
-- A regra passou a ser: ou o número vem da tabela, ou vem de uma fonte
-- verificável. Para "sempre forneça a fonte" valer, não basta dizer a
-- categoria — precisa caber o nome do lugar de onde saiu.
--
-- Seguro rodar mais de uma vez.

alter table public.meal_items
  add column if not exists fonte_detalhe text;

-- 'web' entra na lista de origens aceitas.
alter table public.meal_items drop constraint if exists meal_items_fonte_check;
alter table public.meal_items
  add constraint meal_items_fonte_check
  check (fonte in ('taco', 'rotulo', 'web', 'receita', 'estimativa', 'manual'));

-- Busca na web é cobrada por uso: entra no painel de custo.
alter table public.ai_calls
  add column if not exists buscas int not null default 0;
