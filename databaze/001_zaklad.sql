-- Werkplaats – základní datový model (schváleno 28. 10. 2026)
-- PostgreSQL / Supabase, region EU (Frankfurt)

-- ============ Uživatelé a role ============
create type role_uzivatele as enum ('majitel', 'mechanik');
create table uzivatele (
  id uuid primary key references auth.users(id) on delete cascade,
  jmeno text not null,
  role role_uzivatele not null default 'mechanik',
  podpis_soubor_id uuid,                       -- podpis „Vyhotovil“ (u Vaška stávající podpis)
  vytvoreno timestamptz not null default now()
);

-- ============ Zákazníci ============
create table zakaznici (
  id uuid primary key default gen_random_uuid(),
  je_firma boolean not null default false,
  jmeno text not null,                         -- jméno a příjmení nebo název firmy
  kontaktni_osoba text,                        -- např. kontaktní osoba u firmy
  ico text, dic text,
  ulice text, mesto text, psc text, zeme text default 'Česká Republika',
  telefon text, email text,
  jazyk text not null default 'cs' check (jazyk in ('cs', 'en')),
  poznamka text,
  vytvoreno timestamptz not null default now()
);

-- ============ Katalog aut (sdílený: Werkplaats, E-serviska, další aplikace) ============
create table katalog_rady (                    -- W123, W126, R107 …
  id uuid primary key default gen_random_uuid(),
  kod text not null unique, nazev text, karoserie text, rok_od int, rok_do int
);
create table katalog_modely (                  -- 300 SE (126.024), 560 SL (107.048) …
  id uuid primary key default gen_random_uuid(),
  rada_id uuid not null references katalog_rady(id),
  nazev text not null, kod_mb text, trh text,  -- trh: EU / US / JP
  rok_od int, rok_do int
);
create table katalog_motorizace (              -- M103.981 + 722.3 …
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references katalog_modely(id),
  motor text not null, objem_ccm int, vykon_kw int, vykon_hp int, palivo text,
  prevodovky text[], rok_od int, rok_do int,
  napln jsonb                                  -- objemy náplní, filtry apod.
);

-- ============ Vozidla ============
create table vozidla (
  id uuid primary key default gen_random_uuid(),
  vin text not null unique,
  spz text,
  model_id uuid references katalog_modely(id),
  motorizace_id uuid references katalog_motorizace(id),
  znacka text not null default 'Mercedes-Benz',
  typ text, model text,                        -- text tak, jak se tiskne na dokladech (126 / 300 SE)
  rok int, mesic int, verze text,              -- verze: EU / US
  cislo_motoru text, prevodovka text, barva text,
  rafky text, pneu_letni text, pneu_zimni text, baterie text,
  kody_vybavy jsonb,                           -- [{kod:'410', popis:'Schiebedach elektrisch'}]
  km_posledni int, jednotka_tachometru text not null default 'km' check (jednotka_tachometru in ('km', 'mi')),
  poznamka text,
  vytvoreno timestamptz not null default now()
);
create table vlastnictvi (                     -- kdo auto vlastnil kdy → doklady starého majitele zůstanou jemu
  id uuid primary key default gen_random_uuid(),
  vozidlo_id uuid not null references vozidla(id),
  zakaznik_id uuid not null references zakaznici(id),
  vlastni_od date not null default current_date, vlastni_do date
);

-- ============ Servisní plán („co je příště na řadě“) ============
create table servisni_plan (
  id uuid primary key default gen_random_uuid(),
  motorizace_id uuid references katalog_motorizace(id),
  vozidlo_id uuid references vozidla(id),      -- vlastní interval jen pro konkrétní auto
  ukon text not null,
  interval_km int, interval_mesice int,
  zdroj text not null,                         -- název podkladu MB, nebo 'Mercedes Restorations'
  zdroj_strana text, zdroj_soubor_id uuid,
  check (motorizace_id is not null or vozidlo_id is not null)
);

-- ============ Zakázky ============
create type stav_zakazky as enum ('poptavka','prijato','nabidka','schvaleno','v_praci','hotovo','fakturovano','zaplaceno','predano','zruseno');
create table zakazky (
  id uuid primary key default gen_random_uuid(),
  cislo int not null unique,                   -- navazuje na řadu: první nová = 7377
  vozidlo_id uuid not null references vozidla(id),
  zakaznik_id uuid not null references zakaznici(id),
  stav stav_zakazky not null default 'prijato',
  jazyk text not null default 'cs' check (jazyk in ('cs', 'en')),
  datum_prijmu date not null default current_date,
  predpoklad_dokonceni date, datum_predani date,
  km_prijem int, km_predani int,
  nadrz_prijem text, nadrz_predani text,
  tp_prilozen boolean, foto_prijem boolean, foto_predani boolean,
  zavady text[] not null default '{}',         -- Popis závad a objednaných oprav
  stav_prijem text[] not null default '{}',    -- Stav při převzetí
  stav_predani text[] not null default '{}',   -- Stav při předání
  zkusebni_jizda boolean, kola_dotazena boolean,
  odhad_ceny numeric(12,2),
  vytvoreno timestamptz not null default now()
);

-- ============ Ceník, nabídky, položky ============
create table sazby (id uuid primary key default gen_random_uuid(), nazev text not null, kc_za_hodinu numeric(10,2) not null, poradi int);
insert into sazby (nazev, kc_za_hodinu, poradi) values ('Inspekce', 1200, 1), ('Ostatní práce', 1500, 2);

create type stav_nabidky as enum ('koncept','odeslano','schvaleno','zamitnuto');
create table nabidky (
  id uuid primary key default gen_random_uuid(),
  zakazka_id uuid not null references zakazky(id),
  verze int not null default 1, varianta text,  -- např. „jen převodovka“ / „kompletní“
  stav stav_nabidky not null default 'koncept',
  platnost date,
  unique (zakazka_id, verze, varianta)
);
create type typ_polozky as enum ('prace','pausal','nadpis','prazdny');
create table polozky (
  id uuid primary key default gen_random_uuid(),
  zakazka_id uuid not null references zakazky(id),
  nabidka_id uuid references nabidky(id),      -- null = položka skutečně provedené práce (faktura)
  poradi int not null,
  typ typ_polozky not null default 'prace',
  popis text, mnozstvi numeric(10,2), jednotka text default 'h',
  sazba numeric(10,2),                         -- předvyplní se z ceníku, jde ručně změnit
  castka numeric(12,2)                         -- jen u paušálu
);

-- ============ Díly a nákup ============
create table dodavatele (id uuid primary key default gen_random_uuid(), nazev text not null unique, web text, mena text default 'CZK');
create table nakupni_doklady (
  id uuid primary key default gen_random_uuid(),
  dodavatel_id uuid references dodavatele(id), cislo text, datum date,
  castka numeric(12,2), mena text default 'CZK', soubor_id uuid
);
create type stav_dilu as enum ('potreba','objednano','mam','skladem','namontovano','nepouzito');
create table dily (
  id uuid primary key default gen_random_uuid(),
  zakazka_id uuid references zakazky(id),
  nazev text not null, cislo_mb text, vyrobce text, cislo_vyrobce text,
  dodavatel_id uuid references dodavatele(id), nakupni_doklad_id uuid references nakupni_doklady(id),
  mnozstvi numeric(10,2) not null default 1, jednotka text default 'ks',
  nakupni_cena numeric(12,2), mena text default 'CZK', kurz numeric(10,4) default 1,
  marze_pct numeric(5,2) not null default 30,
  prodejni_cena numeric(12,2),                 -- dopočítá se (nákup × kurz × 1,3), jde přepsat
  stav stav_dilu not null default 'potreba', faze int default 1,
  motorizace_id uuid references katalog_motorizace(id),   -- pro „opakující se díly“
  poznamka text
);

-- ============ Doklady, podpisy, soubory ============
-- Číslo dokladu = číslo zakázky / pevná přípona podle druhu (-verze od druhé verze):
--   7377-1 zakázkový list · 7377-2 cenová nabídka (7377-2-2 další verze) · 7377-3 faktura (7377-3-2 doúčtování)
--   7377-4 předávací protokol · 7377-5 zálohová faktura · 7377-6 opravný doklad k faktuře  (pomlčka – změněno 28. 10.)
create type druh_dokladu as enum ('zakazkovy_list','nabidka','faktura','predavaci_protokol','zalohova','opravny');
create function pripona_dokladu(d public.druh_dokladu) returns int language sql immutable set search_path = '' as $$
  select case d when 'zakazkovy_list' then 1 when 'nabidka' then 2 when 'faktura' then 3
                when 'predavaci_protokol' then 4 when 'zalohova' then 5 when 'opravny' then 6 end;
$$;
create table doklady (
  id uuid primary key default gen_random_uuid(),
  zakazka_id uuid not null references zakazky(id),
  nabidka_id uuid references nabidky(id),
  druh druh_dokladu not null,
  verze int not null default 1,
  cislo text not null,                         -- 7377-3, 7377-2-2 (skládá aplikace z čísla zakázky, přípony a verze)
  variabilni_symbol text not null,             -- jen číslice pro banku: 73773, 737322
  jazyk text not null default 'cs',
  vystaveno date not null default current_date, splatnost date,
  data jsonb not null,                         -- zmrazený obsah v okamžiku vystavení
  pdf_soubor_id uuid,
  zamceno boolean not null default false,      -- vydaný doklad se už nemění
  odeslano_uol timestamptz,
  unique (cislo),
  unique (zakazka_id, druh, verze)
);
create table podpisy (
  id uuid primary key default gen_random_uuid(),
  doklad_id uuid not null references doklady(id),
  role text not null check (role in ('zakaznik','vyhotovil')),
  jmeno text not null, zpusob text not null check (zpusob in ('ipad','dalkove','ulozeny')),
  podepsano timestamptz not null default now(),
  otisk_dokumentu text not null,               -- SHA-256 PDF
  obrazek_soubor_id uuid, ip text
);
create table soubory (
  id uuid primary key default gen_random_uuid(),
  zakazka_id uuid references zakazky(id), vozidlo_id uuid references vozidla(id),
  druh text not null,                          -- foto / pdf / manual / podpis / nakupni_doklad
  faze text,                                   -- prijem / prubeh / predani
  r2_klic text not null, nazev text, velikost int, mime text,
  verejne boolean not null default false,      -- zobrazit v E-servisce
  smazano timestamptz,                         -- jen koš, nic se nemaže natvrdo
  vytvoreno timestamptz not null default now()
);
create table emaily (
  id uuid primary key default gen_random_uuid(),
  doklad_id uuid references doklady(id), komu text not null,
  ucel text, odeslano timestamptz default now(), stav text
);
create table postupy (                         -- pracovní postupy a znalosti (722.3, ASD …)
  id uuid primary key default gen_random_uuid(),
  nazev text not null, agregat text, model_id uuid references katalog_modely(id),
  obsah text, vytvoreno timestamptz not null default now()
);

-- ============ Číslování (bez mezer, nikdy dvakrát) ============
create table ciselne_rady (rada text primary key, posledni int not null);
insert into ciselne_rady values ('zakazky', 7376);
create function dalsi_cislo(p_rada text) returns int language sql set search_path = '' as $$
  update public.ciselne_rady set posledni = posledni + 1 where rada = p_rada returning posledni;
$$;

