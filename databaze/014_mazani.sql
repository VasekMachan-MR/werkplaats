-- Mazání zákazníka, vozidla a zakázky (jen majitel). Faktury se nemažou nikdy – zakázku s fakturou lze jen zrušit.

-- zámky dokladů a podpisů pustí mazání jen z funkce smazat_zakazku a jen u nefakturačních dokladů
create or replace function hlidej_zamceny_doklad() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.zamceno and not (current_setting('werk.mazani_zakazky', true) = 'ano' and old.druh not in ('faktura', 'zalohova', 'opravny')) then
      raise exception 'Doklad % je vydaný a nelze ho smazat (oprava = opravný doklad -6)', old.cislo;
    end if;
    return old;
  end if;
  if old.zamceno and (to_jsonb(new) - 'pdf_soubor_id' - 'odeslano_uol' - 'zaplaceno')
                  <> (to_jsonb(old) - 'pdf_soubor_id' - 'odeslano_uol' - 'zaplaceno') then
    raise exception 'Doklad % je vydaný a nelze ho měnit (oprava = opravný doklad -6)', old.cislo;
  end if;
  return new;
end $$;
create or replace function hlidej_podpis() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and current_setting('werk.mazani_zakazky', true) = 'ano' then return old; end if;
  raise exception 'Podpis nelze měnit ani mazat';
end $$;

create function smazat_zakazku(p_id uuid) returns int language plpgsql set search_path = '' as $$
declare c int; fa int;
begin
  if not (select soukrome.je_majitel()) then raise exception 'Mazat smí jen majitel'; end if;
  select cislo into c from public.zakazky where id = p_id;
  if c is null then raise exception 'Zakázka nenalezena'; end if;
  select count(*) into fa from public.doklady where zakazka_id = p_id and druh in ('faktura', 'zalohova', 'opravny');
  if fa > 0 then raise exception 'Zakázka #% má vystavenou fakturu – faktury se musí archivovat, zakázku lze jen zrušit', c; end if;
  perform set_config('werk.mazani_zakazky', 'ano', true);
  update public.soubory set zakazka_id = null where zakazka_id = p_id and druh = 'tp';   -- TP patří autu
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
  -- smazaná poslední zakázka uvolní své číslo (aby v řadě nezůstala díra)
  update public.ciselne_rady set posledni = greatest(7376, coalesce((select max(cislo) from public.zakazky), 7376))
  where rada = 'zakazky' and posledni = c;
  return c;
end $$;

create function smazat_zakaznika(p_id uuid) returns void language plpgsql set search_path = '' as $$
declare n int;
begin
  if not (select soukrome.je_majitel()) then raise exception 'Mazat smí jen majitel'; end if;
  select count(*) into n from public.zakazky where zakaznik_id = p_id;
  if n > 0 then raise exception 'Zákazník má % zakázek – nejdřív smažte jeho zakázky', n; end if;
  delete from public.vlastnictvi where zakaznik_id = p_id;
  delete from public.zakaznici where id = p_id;
end $$;

create function smazat_vozidlo(p_id uuid) returns void language plpgsql set search_path = '' as $$
declare n int;
begin
  if not (select soukrome.je_majitel()) then raise exception 'Mazat smí jen majitel'; end if;
  select count(*) into n from public.zakazky where vozidlo_id = p_id;
  if n > 0 then raise exception 'Vozidlo má % zakázek – nejdřív smažte jeho zakázky', n; end if;
  delete from public.vlastnictvi where vozidlo_id = p_id;
  delete from public.servisni_plan where vozidlo_id = p_id;
  delete from public.soubory where vozidlo_id = p_id and zakazka_id is null;
  delete from public.vozidla where id = p_id;
end $$;

revoke execute on function smazat_zakazku(uuid), smazat_zakaznika(uuid), smazat_vozidlo(uuid) from public, anon;
grant execute on function smazat_zakazku(uuid), smazat_zakaznika(uuid), smazat_vozidlo(uuid) to authenticated;
