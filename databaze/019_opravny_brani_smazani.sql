-- Faktura / zálohová faktura nejde smazat, když k zakázce existuje opravný doklad
-- (jinak by se číslo uvolnilo a opravný doklad by odkazoval na jiný doklad se stejným číslem). Vašek schválil 29.10.2026.
create or replace function public.smazat_doklad(p_id uuid)
 returns text
 language plpgsql
 set search_path to ''
as $function$
declare d public.doklady; posledni int; zbyva int; st text; soub uuid[];
begin
  if not (select soukrome.je_majitel()) then raise exception 'Mazat doklady smí jen majitel'; end if;
  select * into d from public.doklady where id = p_id;
  if d.id is null then raise exception 'Doklad nenalezen'; end if;
  if d.druh not in ('nabidka', 'faktura', 'zalohova', 'predavaci_protokol') then
    raise exception 'Doklad % nejde smazat (zakázkový list se maže jen s celou zakázkou)', d.cislo;
  end if;
  select max(verze) into posledni from public.doklady where zakazka_id = d.zakazka_id and druh = d.druh;
  if d.verze <> posledni then raise exception 'Smazat jde jen poslední verzi – nejdřív smažte novější doklad stejného druhu'; end if;
  if d.odeslano_uol is not null then raise exception 'Doklad % už byl předán účetní – oprava jen opravným dokladem', d.cislo; end if;
  if d.zaplaceno is not null then raise exception 'Doklad % je označený jako zaplacený – nejdřív zrušte úhradu', d.cislo; end if;
  if d.druh = 'zalohova' and exists (select 1 from public.doklady where zakazka_id = d.zakazka_id and druh = 'faktura') then
    raise exception 'Záloha % je odečtená v konečné faktuře – nejdřív smažte fakturu', d.cislo;
  end if;
  if d.druh in ('faktura', 'zalohova') and exists (select 1 from public.doklady where zakazka_id = d.zakazka_id and druh = 'opravny') then
    raise exception 'K zakázce existuje opravný doklad – doklad % už nejde smazat', d.cislo;
  end if;

  perform set_config('werk.mazani_dokladu', 'ano', true);
  select array_agg(id) into soub from public.soubory where doklad_id = d.id;
  soub := coalesce(soub, '{}') || d.pdf_soubor_id || array(select obrazek_soubor_id from public.podpisy where doklad_id = d.id and obrazek_soubor_id is not null);
  update public.soubory set doklad_id = null where doklad_id = d.id;
  delete from public.podpisy where doklad_id = d.id;
  delete from public.emaily where doklad_id = d.id;
  delete from public.doklady where id = d.id;
  delete from public.soubory where id = any(soub);
  if d.nabidka_id is not null and not exists (select 1 from public.doklady where nabidka_id = d.nabidka_id) then
    delete from public.polozky where nabidka_id = d.nabidka_id;
    delete from public.nabidky where id = d.nabidka_id;
  end if;
  perform set_config('werk.mazani_dokladu', '', true);

  select stav::text into st from public.zakazky where id = d.zakazka_id;
  select count(*) into zbyva from public.doklady where zakazka_id = d.zakazka_id and druh = d.druh;
  if zbyva = 0 then
    if d.druh = 'faktura' and st in ('fakturovano', 'zaplaceno') then
      update public.zakazky set stav = 'v_praci' where id = d.zakazka_id;
    elsif d.druh = 'predavaci_protokol' and st = 'predano' then
      update public.zakazky set stav = case
        when exists (select 1 from public.doklady where zakazka_id = d.zakazka_id and druh = 'faktura' and zaplaceno is not null) then 'zaplaceno'
        when exists (select 1 from public.doklady where zakazka_id = d.zakazka_id and druh = 'faktura') then 'fakturovano'
        else 'v_praci' end::public.stav_zakazky
      where id = d.zakazka_id;
    elsif d.druh = 'nabidka' and st = 'nabidka' then
      update public.zakazky set stav = 'prijato' where id = d.zakazka_id;
    end if;
  end if;
  return d.cislo;
end $function$;
