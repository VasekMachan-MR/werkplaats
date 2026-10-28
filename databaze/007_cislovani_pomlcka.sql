-- Čísla dokladů s pomlčkou (7377-1 místo 7377/1) – úprava hlášek a kontrola tvaru čísla
create or replace function hlidej_zamceny_doklad() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.zamceno then raise exception 'Doklad % je vydaný a nelze ho smazat (oprava = opravný doklad -6)', old.cislo; end if;
    return old;
  end if;
  if old.zamceno and (to_jsonb(new) - 'pdf_soubor_id' - 'odeslano_uol') <> (to_jsonb(old) - 'pdf_soubor_id' - 'odeslano_uol') then
    raise exception 'Doklad % je vydaný a nelze ho měnit (oprava = opravný doklad -6)', old.cislo;
  end if;
  return new;
end $$;
-- číslo dokladu: 7377-1 nebo 7377-2-2, variabilní symbol jen číslice
alter table doklady add constraint doklady_cislo_tvar check (cislo ~ '^[0-9]+-[1-6](-[0-9]+)?$');
alter table doklady add constraint doklady_vs_tvar check (variabilni_symbol ~ '^[0-9]{1,10}$');
