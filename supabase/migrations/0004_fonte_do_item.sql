-- De onde veio o número de cada linha.
--
-- Sem isso não dá para responder "essa caloria saiu da tabela ou foi chute
-- da IA?", que é a diferença entre conferir e acreditar.
--
-- Seguro rodar mais de uma vez.

alter table public.meal_items
  add column if not exists fonte text not null default 'estimativa';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'meal_items_fonte_check'
  ) then
    alter table public.meal_items
      add constraint meal_items_fonte_check
      check (fonte in ('taco', 'rotulo', 'receita', 'estimativa', 'manual'));
  end if;
end $$;
