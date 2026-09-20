-- Permissões da view de totais.
--
-- `day_totals` alimenta o anel de kcal do topo e a tela de Período. Se a view
-- não tiver SELECT para o papel `authenticated`, o app não quebra: ele mostra
-- zero, como se nada tivesse sido registrado. É o tipo de falha que parece bug
-- de gravação e não é.
--
-- Seguro rodar mais de uma vez.

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

-- Confere se o perfil de quem já entrou existe. Conta criada pelo painel do
-- Supabase dispara o mesmo trigger, mas se ele falhou o app fica sem alvos.
insert into public.profiles (user_id, nome)
select u.id, split_part(coalesce(u.email, ''), '@', 1)
from auth.users u
where not exists (select 1 from public.profiles p where p.user_id = u.id);
