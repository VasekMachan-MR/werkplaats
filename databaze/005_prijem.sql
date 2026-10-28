-- Werkplaats – příjem vozu: úložiště souborů, nastavení firmy, založení zakázky jedním krokem

-- Soubory zatím v úložišti Supabase (později lze přesunout do Cloudflare R2 – proto sloupec uloziste)
alter table soubory rename column r2_klic to klic;
alter table soubory add column uloziste text not null default 'supabase' check (uloziste in ('supabase', 'r2'));
alter table soubory add column doklad_id uuid references doklady(id);
create index on soubory (doklad_id);

-- Soukromý koš na fotky a PDF: číst a nahrávat smí jen členové dílny, mazat ani přepisovat nikdo (nic nezmizí)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('soubory', 'soubory', false, 26214400, array['image/jpeg', 'image/png', 'image/heic', 'application/pdf']);
create policy "dilna cte" on storage.objects for select to authenticated
  using (bucket_id = 'soubory' and (select soukrome.je_clen()));
create policy "dilna nahrava" on storage.objects for insert to authenticated
  with check (bucket_id = 'soubory' and (select soukrome.je_clen()));

-- Nastavení firmy (např. podpis „Vyhotovil“ jako obrázek – nikdy v gitu)
create table nastaveni (klic text primary key, hodnota jsonb not null, zmeneno timestamptz not null default now());
alter table nastaveni enable row level security;
create policy dilna on nastaveni for all to authenticated using ((select soukrome.je_clen())) with check ((select soukrome.je_clen()));

-- VIN vždy velkými písmeny a bez mezer
create function normalizuj_vin() returns trigger language plpgsql set search_path = '' as $$
begin new.vin := upper(regexp_replace(new.vin, '\s', '', 'g')); return new; end $$;
create trigger vin_velka before insert or update of vin on vozidla for each row execute function normalizuj_vin();

-- Založení zakázky: zákazník (nový / upravený), auto podle VIN, vlastnictví a nové číslo – vše najednou, nebo nic
create function zalozit_zakazku(p jsonb) returns jsonb language plpgsql set search_path = '' as $$
declare
  z jsonb := p -> 'zakaznik'; v jsonb := p -> 'vozidlo'; k jsonb := p -> 'zakazka';
  zid uuid; vid uuid; zkid uuid; c int;
begin
  if not (select soukrome.je_clen()) then raise exception 'Nepřihlášený uživatel'; end if;

  -- zákazník
  if nullif(z ->> 'id', '') is not null then
    zid := (z ->> 'id')::uuid;
    update public.zakaznici set
      je_firma = coalesce((z ->> 'je_firma')::boolean, je_firma), jmeno = z ->> 'jmeno', kontaktni_osoba = z ->> 'kontaktni_osoba',
      ico = z ->> 'ico', dic = z ->> 'dic', ulice = z ->> 'ulice', mesto = z ->> 'mesto', psc = z ->> 'psc', zeme = z ->> 'zeme',
      telefon = z ->> 'telefon', email = z ->> 'email', jazyk = coalesce(z ->> 'jazyk', jazyk)
    where id = zid;
    if not found then raise exception 'Zákazník nenalezen'; end if;
  else
    insert into public.zakaznici (je_firma, jmeno, kontaktni_osoba, ico, dic, ulice, mesto, psc, zeme, telefon, email, jazyk)
    values (coalesce((z ->> 'je_firma')::boolean, false), z ->> 'jmeno', z ->> 'kontaktni_osoba', z ->> 'ico', z ->> 'dic',
            z ->> 'ulice', z ->> 'mesto', z ->> 'psc', coalesce(z ->> 'zeme', 'Česká Republika'), z ->> 'telefon', z ->> 'email',
            coalesce(z ->> 'jazyk', 'cs'))
    returning id into zid;
  end if;

  -- auto (podle VIN: existující se doplní, nové se založí)
  insert into public.vozidla (vin, spz, znacka, typ, model, rok, verze, barva, km_posledni, jednotka_tachometru)
  values (v ->> 'vin', v ->> 'spz', coalesce(v ->> 'znacka', 'Mercedes-Benz'), v ->> 'typ', v ->> 'model',
          (v ->> 'rok')::int, v ->> 'verze', v ->> 'barva', (k ->> 'km_prijem')::int, coalesce(v ->> 'jednotka_tachometru', 'km'))
  on conflict (vin) do update set
    spz = coalesce(excluded.spz, public.vozidla.spz), typ = coalesce(excluded.typ, public.vozidla.typ),
    model = coalesce(excluded.model, public.vozidla.model), rok = coalesce(excluded.rok, public.vozidla.rok),
    verze = coalesce(excluded.verze, public.vozidla.verze), barva = coalesce(excluded.barva, public.vozidla.barva),
    km_posledni = coalesce(excluded.km_posledni, public.vozidla.km_posledni),
    jednotka_tachometru = excluded.jednotka_tachometru
  returning id into vid;

  -- vlastnictví: přidá se, když tenhle zákazník u auta ještě není (změnu majitele dělá Vašek ručně)
  if not exists (select 1 from public.vlastnictvi where vozidlo_id = vid and zakaznik_id = zid and vlastni_do is null) then
    insert into public.vlastnictvi (vozidlo_id, zakaznik_id) values (vid, zid);
  end if;

  -- zakázka s dalším číslem v řadě
  c := public.dalsi_cislo('zakazky');
  insert into public.zakazky (cislo, vozidlo_id, zakaznik_id, jazyk, datum_prijmu, predpoklad_dokonceni, km_prijem,
                              nadrz_prijem, tp_prilozen, foto_prijem, zavady, stav_prijem, odhad_ceny)
  values (c, vid, zid, coalesce(k ->> 'jazyk', 'cs'), coalesce((k ->> 'datum_prijmu')::date, current_date),
          (k ->> 'predpoklad_dokonceni')::date, (k ->> 'km_prijem')::int, k ->> 'nadrz_prijem',
          (k ->> 'tp_prilozen')::boolean, (k ->> 'foto_prijem')::boolean,
          coalesce(array(select jsonb_array_elements_text(k -> 'zavady')), '{}'),
          coalesce(array(select jsonb_array_elements_text(k -> 'stav_prijem')), '{}'),
          (k ->> 'odhad_ceny')::numeric)
  returning id into zkid;

  return jsonb_build_object('zakazka_id', zkid, 'cislo', c, 'zakaznik_id', zid, 'vozidlo_id', vid);
end $$;
revoke execute on function zalozit_zakazku(jsonb) from public, anon;
grant execute on function zalozit_zakazku(jsonb) to authenticated;
