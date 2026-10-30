-- Sady kol místo „Pneu letní / Pneu zimní“ (Vašek 30.10.2026):
-- vozidla.sady_kol = [{pneu, typ: 'letni'|'zimni'|'celorocni'|null, disky_original: bool, disky}] – max. 2 sady.
-- Staré sloupce pneu_letni / pneu_zimni / rafky zůstávají (nic se nemaže), jen se převedou do sad.
alter table public.vozidla add column if not exists sady_kol jsonb;

update public.vozidla v set sady_kol = s.sady
from (
  select id, jsonb_agg(x order by poradi) as sady from (
    select id, 1 as poradi, jsonb_build_object('pneu', pneu_letni, 'typ', 'letni', 'disky_original', rafky is null, 'disky', rafky) as x
      from public.vozidla where nullif(trim(coalesce(pneu_letni, '')), '') is not null
    union all
    select id, 2, jsonb_build_object('pneu', pneu_zimni, 'typ', 'zimni', 'disky_original', true, 'disky', null)
      from public.vozidla where nullif(trim(coalesce(pneu_zimni, '')), '') is not null
    union all   -- jen ráfky bez pneu → první sada s popisem disků
    select id, 1, jsonb_build_object('pneu', null, 'typ', null, 'disky_original', false, 'disky', rafky)
      from public.vozidla where nullif(trim(coalesce(rafky, '')), '') is not null and nullif(trim(coalesce(pneu_letni, '')), '') is null
  ) t group by id
) s
where v.id = s.id and v.sady_kol is null;
