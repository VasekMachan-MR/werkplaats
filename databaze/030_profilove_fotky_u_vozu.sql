-- Profilové fotky patří k autu, ne k zakázce (Vašek 30.10.2026): smazáním zakázky nezmizí – stejně jako technický průkaz
create or replace function public.smazat_zakazku(p_id uuid)
 returns integer
 language plpgsql
 set search_path to ''
as $function$
declare c int; fa int;
begin
  if not (select soukrome.je_majitel()) then raise exception 'Mazat smí jen majitel'; end if;
  select cislo into c from public.zakazky where id = p_id;
  if c is null then raise exception 'Zakázka nenalezena'; end if;
  select count(*) into fa from public.doklady where zakazka_id = p_id and druh in ('faktura', 'zalohova', 'opravny');
  if fa > 0 then raise exception 'Zakázka #% má vystavenou fakturu – faktury se musí archivovat, zakázku lze jen zrušit', c; end if;
  perform set_config('werk.mazani_zakazky', 'ano', true);
  update public.soubory set zakazka_id = null where zakazka_id = p_id and druh = 'tp';
  update public.soubory set zakazka_id = null where zakazka_id = p_id and druh = 'foto' and faze = 'profil' and vozidlo_id is not null;
  update public.soubory set doklad_id = null where zakazka_id = p_id;
  delete from public.podpisy where doklad_id in (select id from public.doklady where zakazka_id = p_id);
  delete from public.emaily where doklad_id in (select id from public.doklady where zakazka_id = p_id);
  delete from public.doklady where zakazka_id = p_id;
  delete from public.soubory where zakazka_id = p_id;
  delete from public.polozky where zakazka_id = p_id;
  delete from public.dily where zakazka_id = p_id;
  delete from public.nabidky where zakazka_id = p_id;
  delete from public.zakazky where id = p_id;
  perform set_config('werk.mazani_zakazky', '', true);
  update public.ciselne_rady set posledni = greatest(7376, coalesce((select max(cislo) from public.zakazky), 7376))
  where rada = 'zakazky' and posledni = c;
  return c;
end $function$;
