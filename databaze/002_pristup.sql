-- Werkplaats – přístupová práva a pojistky
-- K datům se dostane jen přihlášený uživatel, který je zapsaný v tabulce uzivatele (Vašek, později mechanik).
-- Nepřihlášený (anon) nevidí nic. E-serviska bude číst přes vlastní server, ne napřímo.

create function je_clen() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.uzivatele where id = auth.uid());
$$;
create function je_majitel() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.uzivatele where id = auth.uid() and role = 'majitel');
$$;
revoke execute on function je_clen(), je_majitel() from public, anon;
revoke execute on function dalsi_cislo(text) from public, anon;
grant execute on function je_clen(), je_majitel(), dalsi_cislo(text) to authenticated;

-- RLS na všech tabulkách: člen dílny smí číst i zapisovat
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename <> 'uzivatele' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy dilna on public.%I for all to authenticated using (public.je_clen()) with check (public.je_clen())', t);
  end loop;
end $$;

-- Uživatele vidí všichni členové, měnit je smí jen majitel
alter table uzivatele enable row level security;
create policy cteni on uzivatele for select to authenticated using (public.je_clen());
create policy sprava on uzivatele for all to authenticated using (public.je_majitel()) with check (public.je_majitel());

-- Vydaný (zamčený) doklad už nejde změnit ani smazat – jen doplnit PDF a datum odeslání účetní
create function hlidej_zamceny_doklad() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.zamceno then raise exception 'Doklad % je vydaný a nelze ho smazat (oprava = opravný doklad /6)', old.cislo; end if;
    return old;
  end if;
  if old.zamceno and (to_jsonb(new) - 'pdf_soubor_id' - 'odeslano_uol') <> (to_jsonb(old) - 'pdf_soubor_id' - 'odeslano_uol') then
    raise exception 'Doklad % je vydaný a nelze ho měnit (oprava = opravný doklad /6)', old.cislo;
  end if;
  return new;
end $$;
create trigger zamek_dokladu before update or delete on doklady for each row execute function hlidej_zamceny_doklad();

-- Podpis k dokladu se po uložení už nemění
create function hlidej_podpis() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Podpis nelze měnit ani mazat'; end $$;
create trigger zamek_podpisu before update or delete on podpisy for each row execute function hlidej_podpis();

-- Indexy pro rychlé hledání (VIN, SPZ, jméno, telefon)
create index on vozidla (spz);
create index on zakaznici (lower(jmeno));
create index on zakaznici (telefon);
create index on zakazky (vozidlo_id);
create index on zakazky (zakaznik_id);
create index on vlastnictvi (vozidlo_id);
create index on polozky (zakazka_id);
create index on dily (zakazka_id);
create index on doklady (zakazka_id);
create index on soubory (zakazka_id);
create index on soubory (vozidlo_id);
