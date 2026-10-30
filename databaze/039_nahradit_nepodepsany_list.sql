-- 039: nové vystavení zakázkového listu nahradí nepodepsaný list (Vašek 30.10.2026)
-- U zakázky má být jen jeden zakázkový list. Nové vystavení odstraní listy, které zákazník nepodepsal (na iPadu ani v E-servisce),
-- a nový dostane jejich místo (např. 73780001). PDF odstraněných listů jdou do koše (smazano), nemažou se.
-- Podepsaný list se nikdy nemaže – zůstává jako doklad toho, co zákazník odsouhlasil.
create or replace function public.nahradit_nepodepsane_listy(p_zakazka uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare ids uuid[]; soub uuid[];
begin
  if not (select soukrome.je_clen()) then raise exception 'Nepovoleno'; end if;
  select array_agg(d.id) into ids from public.doklady d where d.zakazka_id = p_zakazka and d.druh = 'zakazkovy_list'
    and not exists (select 1 from public.podpisy x where x.doklad_id = d.id and x.role = 'zakaznik')
    and not exists (select 1 from public.dalkove_podpisy x where x.doklad_id = d.id);
  if ids is null then return 0; end if;
  select array_agg(x) into soub from (
    select id x from public.soubory where doklad_id = any(ids)
    union select pdf_soubor_id from public.doklady where id = any(ids) and pdf_soubor_id is not null
    union select obrazek_soubor_id from public.podpisy where doklad_id = any(ids) and obrazek_soubor_id is not null) s;
  perform set_config('werk.mazani_dokladu', 'ano', true);
  update public.soubory set doklad_id = null, smazano = coalesce(smazano, now()) where id = any(coalesce(soub, '{}'));
  delete from public.podpisy where doklad_id = any(ids);
  delete from public.emaily where doklad_id = any(ids);
  delete from public.doklady where id = any(ids);
  perform set_config('werk.mazani_dokladu', '', true);
  return coalesce(array_length(ids, 1), 0);
end $$;
revoke all on function public.nahradit_nepodepsane_listy(uuid) from public, anon;
grant execute on function public.nahradit_nepodepsane_listy(uuid) to authenticated;
