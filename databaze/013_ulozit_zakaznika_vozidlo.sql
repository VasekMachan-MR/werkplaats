-- Samostatné uložení zákazníka nebo auta (bez založení zakázky) – z formuláře příjmu tlačítkem „Uložit“

create function ulozit_zakaznika(p jsonb) returns uuid language plpgsql set search_path = '' as $$
declare zid uuid := nullif(p ->> 'id', '')::uuid;
begin
  if not (select soukrome.je_clen()) then raise exception 'Nepřihlášený uživatel'; end if;
  if coalesce(trim(p ->> 'jmeno'), '') = '' then raise exception 'Chybí jméno zákazníka'; end if;
  if zid is not null then
    update public.zakaznici set
      je_firma = coalesce((p ->> 'je_firma')::boolean, je_firma), jmeno = p ->> 'jmeno', kontaktni_osoba = p ->> 'kontaktni_osoba',
      ico = p ->> 'ico', dic = p ->> 'dic', ulice = p ->> 'ulice', mesto = p ->> 'mesto', psc = p ->> 'psc', zeme = p ->> 'zeme',
      telefon = p ->> 'telefon', email = p ->> 'email', jazyk = coalesce(p ->> 'jazyk', jazyk)
    where id = zid;
    if not found then raise exception 'Zákazník nenalezen'; end if;
  else
    insert into public.zakaznici (je_firma, jmeno, kontaktni_osoba, ico, dic, ulice, mesto, psc, zeme, telefon, email, jazyk)
    values (coalesce((p ->> 'je_firma')::boolean, false), p ->> 'jmeno', p ->> 'kontaktni_osoba', p ->> 'ico', p ->> 'dic',
            p ->> 'ulice', p ->> 'mesto', p ->> 'psc', coalesce(p ->> 'zeme', 'Česká Republika'), p ->> 'telefon', p ->> 'email',
            coalesce(p ->> 'jazyk', 'cs'))
    returning id into zid;
  end if;
  return zid;
end $$;

-- Auto podle VIN (existující se doplní, nové se založí); je-li zadaný zákazník, zapíše se jako majitel (když ještě není)
create function ulozit_vozidlo(p jsonb, p_zakaznik uuid default null) returns uuid language plpgsql set search_path = '' as $$
declare vid uuid;
begin
  if not (select soukrome.je_clen()) then raise exception 'Nepřihlášený uživatel'; end if;
  if length(regexp_replace(coalesce(p ->> 'vin', ''), '\s', '', 'g')) < 8 then raise exception 'Chybí VIN'; end if;
  insert into public.vozidla (vin, spz, znacka, typ, model, rok, verze, barva, km_posledni, jednotka_tachometru)
  values (p ->> 'vin', p ->> 'spz', coalesce(p ->> 'znacka', 'Mercedes-Benz'), p ->> 'typ', p ->> 'model',
          nullif(p ->> 'rok', '')::int, p ->> 'verze', p ->> 'barva', nullif(p ->> 'km', '')::int, coalesce(p ->> 'jednotka_tachometru', 'km'))
  on conflict (vin) do update set
    spz = coalesce(excluded.spz, public.vozidla.spz), typ = coalesce(excluded.typ, public.vozidla.typ),
    model = coalesce(excluded.model, public.vozidla.model), rok = coalesce(excluded.rok, public.vozidla.rok),
    verze = coalesce(excluded.verze, public.vozidla.verze), barva = coalesce(excluded.barva, public.vozidla.barva),
    km_posledni = coalesce(excluded.km_posledni, public.vozidla.km_posledni), jednotka_tachometru = excluded.jednotka_tachometru
  returning id into vid;
  if p_zakaznik is not null and not exists (select 1 from public.vlastnictvi where vozidlo_id = vid and zakaznik_id = p_zakaznik and vlastni_do is null) then
    insert into public.vlastnictvi (vozidlo_id, zakaznik_id) values (vid, p_zakaznik);
  end if;
  return vid;
end $$;

revoke execute on function ulozit_zakaznika(jsonb), ulozit_vozidlo(jsonb, uuid) from public, anon;
grant execute on function ulozit_zakaznika(jsonb), ulozit_vozidlo(jsonb, uuid) to authenticated;
