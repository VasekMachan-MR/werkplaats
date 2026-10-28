-- Práce a díly zakázky (podklad pro cenovou nabídku a fakturu), součty a úhrada dokladů

-- doklad si pamatuje celkovou částku a datum úhrady (přehledy, měsíční podklady pro účetní)
alter table doklady add column celkem numeric(12,2);
alter table doklady add column zaplaceno date;
-- úhradu lze zapsat i k vydanému (zamčenému) dokladu → zámek ji povolí stejně jako PDF a odeslání účetní
create or replace function hlidej_zamceny_doklad() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.zamceno then raise exception 'Doklad % je vydaný a nelze ho smazat (oprava = opravný doklad -6)', old.cislo; end if;
    return old;
  end if;
  if old.zamceno and (to_jsonb(new) - 'pdf_soubor_id' - 'odeslano_uol' - 'zaplaceno')
                  <> (to_jsonb(old) - 'pdf_soubor_id' - 'odeslano_uol' - 'zaplaceno') then
    raise exception 'Doklad % je vydaný a nelze ho měnit (oprava = opravný doklad -6)', old.cislo;
  end if;
  return new;
end $$;

-- díly: kdy se změnily (řazení, přehled objednávek)
alter table dily add column poradi int not null default 0;
alter table dily add column zmeneno timestamptz not null default now();

-- Uložení pracovních položek zakázky najednou (pořadí, typy, sazby). Položky vydaných nabídek se nemění – jsou zmrazené v dokladu.
create function ulozit_polozky(p_zakazka uuid, p_polozky jsonb) returns int language plpgsql set search_path = '' as $$
declare n int;
begin
  if not (select soukrome.je_clen()) then raise exception 'Nepřihlášený uživatel'; end if;
  delete from public.polozky where zakazka_id = p_zakazka and nabidka_id is null;
  insert into public.polozky (zakazka_id, poradi, typ, popis, mnozstvi, jednotka, sazba, castka)
  select p_zakazka, ord::int, coalesce(x ->> 'typ', 'prace')::public.typ_polozky, x ->> 'popis',
         nullif(x ->> 'mnozstvi', '')::numeric, nullif(x ->> 'jednotka', ''), nullif(x ->> 'sazba', '')::numeric, nullif(x ->> 'castka', '')::numeric
  from jsonb_array_elements(p_polozky) with ordinality as t(x, ord);
  get diagnostics n = row_count;
  return n;
end $$;

-- Uložení dílů zakázky: existující se upraví, nové přidají, odebrané smažou (jen u této zakázky)
create function ulozit_dily(p_zakazka uuid, p_dily jsonb) returns int language plpgsql set search_path = '' as $$
declare n int;
begin
  if not (select soukrome.je_clen()) then raise exception 'Nepřihlášený uživatel'; end if;
  delete from public.dily d where d.zakazka_id = p_zakazka
    and d.id not in (select (x ->> 'id')::uuid from jsonb_array_elements(p_dily) x where nullif(x ->> 'id', '') is not null);
  insert into public.dily (id, zakazka_id, poradi, nazev, cislo_mb, vyrobce, cislo_vyrobce, dodavatel_id, mnozstvi, jednotka,
                           nakupni_cena, mena, kurz, marze_pct, prodejni_cena, stav, poznamka, zmeneno)
  select coalesce(nullif(x ->> 'id', '')::uuid, gen_random_uuid()), p_zakazka, ord::int, coalesce(nullif(x ->> 'nazev', ''), '(bez názvu)'),
         nullif(x ->> 'cislo_mb', ''), nullif(x ->> 'vyrobce', ''), nullif(x ->> 'cislo_vyrobce', ''), nullif(x ->> 'dodavatel_id', '')::uuid,
         coalesce(nullif(x ->> 'mnozstvi', '')::numeric, 1), coalesce(nullif(x ->> 'jednotka', ''), 'ks'),
         nullif(x ->> 'nakupni_cena', '')::numeric, coalesce(nullif(x ->> 'mena', ''), 'CZK'), coalesce(nullif(x ->> 'kurz', '')::numeric, 1),
         coalesce(nullif(x ->> 'marze_pct', '')::numeric, 30), nullif(x ->> 'prodejni_cena', '')::numeric,
         coalesce(nullif(x ->> 'stav', ''), 'potreba')::public.stav_dilu, nullif(x ->> 'poznamka', ''), now()
  from jsonb_array_elements(p_dily) with ordinality as t(x, ord)
  on conflict (id) do update set
    poradi = excluded.poradi, nazev = excluded.nazev, cislo_mb = excluded.cislo_mb, vyrobce = excluded.vyrobce,
    cislo_vyrobce = excluded.cislo_vyrobce, dodavatel_id = excluded.dodavatel_id, mnozstvi = excluded.mnozstvi, jednotka = excluded.jednotka,
    nakupni_cena = excluded.nakupni_cena, mena = excluded.mena, kurz = excluded.kurz, marze_pct = excluded.marze_pct,
    prodejni_cena = excluded.prodejni_cena, stav = excluded.stav, poznamka = excluded.poznamka, zmeneno = now()
  where public.dily.zakazka_id = p_zakazka;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function ulozit_polozky(uuid, jsonb), ulozit_dily(uuid, jsonb) from public, anon;
grant execute on function ulozit_polozky(uuid, jsonb), ulozit_dily(uuid, jsonb) to authenticated;

-- dodavatelé, které Vašek používá
insert into dodavatele (nazev, web) values ('Granex', 'https://www.granex.cz'), ('Auto Kelly', 'https://www.autokelly.cz'),
  ('Mercedes-Benz (originál)', null), ('Jiný', null)
on conflict (nazev) do nothing;
