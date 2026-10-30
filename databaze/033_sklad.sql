-- Sklad = chytrý katalog dílů (Vašek 30.10.2026)
-- • každý díl, který prošel zakázkou, je v katalogu (zpětně i všechny dosavadní); nový díl v zakázce se do katalogu zapíše sám
--   (stejné číslo dílu = stejná položka; díl bez čísla podle názvu)
-- • u položky: kolik je skladem, kde leží, minimální zásoba, poslední nákupní cena a dodavatel, inventura
-- • díl vzatý v zakázce ze skladu (dily.ze_skladu) se ze stavu odečte sám; změna množství, „nepoužito“ nebo smazání ho vrátí
-- • stav skladu = součet pohybů (příjem, výdej do zakázky, inventura) – historie se nemaže
create table if not exists public.sklad (
  id uuid primary key default gen_random_uuid(),
  nazev text not null check (length(btrim(nazev)) between 1 and 200),
  cislo_mb text, vyrobce text, cislo_vyrobce text,
  puvod text check (puvod in ('original', 'aftermarket')),
  jednotka text not null default 'ks',
  mnozstvi numeric(10,2) not null default 0,          -- udržuje trigger z pohybů
  min_mnozstvi numeric(10,2),                          -- pod touto zásobou → „doobjednat“
  umisteni text,                                       -- regál / krabice
  nakupni_cena numeric(12,2),                          -- poslední nákupní cena v Kč za jednotku
  dodavatel_id uuid references public.dodavatele(id) on delete set null,
  poznamka text,
  inventura date,                                      -- kdy byl naposledy spočítaný
  klic text generated always as (
    case when regexp_replace(upper(coalesce(cislo_mb, '')), '[^A-Z0-9]', '', 'g') <> ''
         then 'c:' || regexp_replace(upper(cislo_mb), '[^A-Z0-9]', '', 'g')
         else 'n:' || lower(btrim(nazev)) end) stored,
  vytvoreno timestamptz not null default now(),
  zmeneno timestamptz not null default now()
);
create unique index if not exists sklad_klic on public.sklad (klic);
alter table public.sklad enable row level security;
create policy dilna on public.sklad for all to authenticated using ((select soukrome.je_clen())) with check ((select soukrome.je_clen()));

create table if not exists public.sklad_pohyby (
  id uuid primary key default gen_random_uuid(),
  sklad_id uuid not null references public.sklad(id) on delete cascade,
  druh text not null check (druh in ('prijem', 'zakazka', 'inventura', 'oprava')),
  zmena numeric(10,2) not null,                        -- + naskladněno / − vydáno
  zakazka_id uuid references public.zakazky(id) on delete set null,
  dil_id uuid references public.dily(id) on delete set null,
  cena numeric(12,2),                                  -- u příjmu: nákupní cena Kč / jednotku
  poznamka text,
  vytvoril uuid default auth.uid(),
  cas timestamptz not null default now()
);
create index if not exists sklad_pohyby_sklad on public.sklad_pohyby (sklad_id, cas desc);
alter table public.sklad_pohyby enable row level security;
create policy dilna_cte on public.sklad_pohyby for select to authenticated using ((select soukrome.je_clen()));
create policy dilna_pise on public.sklad_pohyby for insert to authenticated with check ((select soukrome.je_clen()) and druh in ('prijem', 'inventura', 'oprava'));
-- pohyby se nemažou ani nepřepisují (historie); výdej do zakázky zapisuje jen trigger

create or replace function public.sklad_po_pohybu() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.sklad set mnozstvi = mnozstvi + new.zmena, zmeneno = now(),
    nakupni_cena = case when new.druh = 'prijem' and new.cena is not null then new.cena else nakupni_cena end,
    inventura = case when new.druh = 'inventura' then current_date else inventura end
  where id = new.sklad_id;
  return new;
end $$;
revoke execute on function public.sklad_po_pohybu() from public, anon, authenticated;
create trigger sklad_po_pohybu after insert on public.sklad_pohyby for each row execute function public.sklad_po_pohybu();

create or replace function public.inventura_skladu(p_sklad uuid, p_stav numeric) returns numeric language plpgsql set search_path = '' as $$
declare r numeric;
begin
  if not (select soukrome.je_clen()) then raise exception 'Nepřihlášený uživatel'; end if;
  select p_stav - mnozstvi into r from public.sklad where id = p_sklad for update;
  if r is null then raise exception 'Položka skladu nenalezena'; end if;
  if r <> 0 then insert into public.sklad_pohyby (sklad_id, druh, zmena) values (p_sklad, 'inventura', r);
  else update public.sklad set inventura = current_date where id = p_sklad; end if;
  return r;
end $$;
revoke execute on function public.inventura_skladu(uuid, numeric) from public, anon;
grant execute on function public.inventura_skladu(uuid, numeric) to authenticated;

alter table public.dily add column if not exists sklad_id uuid references public.sklad(id) on delete set null;
alter table public.dily add column if not exists ze_skladu boolean not null default false;
create index if not exists dily_sklad on public.dily (sklad_id);

-- díl v zakázce → položka katalogu (najít podle čísla / názvu, jinak založit) + poslední cena, dodavatel, výrobce
create or replace function public.dil_do_katalogu() returns trigger language plpgsql security definer set search_path = '' as $$
declare k text; cislo text := regexp_replace(upper(coalesce(new.cislo_mb, '')), '[^A-Z0-9]', '', 'g');
begin
  if not new.ze_skladu or new.sklad_id is null then
    k := case when cislo <> '' then 'c:' || cislo else 'n:' || lower(btrim(coalesce(new.nazev, ''))) end;
    if k in ('n:', 'n:(bez názvu)') then new.sklad_id := null; return new; end if;
    insert into public.sklad (nazev, cislo_mb, vyrobce, cislo_vyrobce, puvod, jednotka)
    values (btrim(new.nazev), nullif(btrim(coalesce(new.cislo_mb, '')), ''), new.vyrobce, new.cislo_vyrobce, new.puvod, coalesce(new.jednotka, 'ks'))
    on conflict (klic) do nothing;
    select id into new.sklad_id from public.sklad where klic = k;
  end if;
  update public.sklad s set
    nakupni_cena = case when new.nakupni_cena is not null and new.nakupni_cena > 0 then round(new.nakupni_cena * coalesce(new.kurz, 1), 2) else s.nakupni_cena end,
    dodavatel_id = coalesce(new.dodavatel_id, s.dodavatel_id),
    vyrobce = coalesce(s.vyrobce, new.vyrobce), cislo_vyrobce = coalesce(s.cislo_vyrobce, new.cislo_vyrobce), puvod = coalesce(s.puvod, new.puvod)
  where s.id = new.sklad_id and not new.ze_skladu
    and (tg_op = 'INSERT' or new.nakupni_cena is distinct from old.nakupni_cena or new.kurz is distinct from old.kurz
         or new.dodavatel_id is distinct from old.dodavatel_id or new.sklad_id is distinct from old.sklad_id);
  return new;
end $$;
revoke execute on function public.dil_do_katalogu() from public, anon, authenticated;
create trigger dil_do_katalogu before insert or update on public.dily for each row execute function public.dil_do_katalogu();

-- výdej ze skladu / vrácení na sklad
create or replace function public.sklad_z_dilu() returns trigger language plpgsql security definer set search_path = '' as $$
declare stare numeric := 0; nove numeric := 0;
begin
  if tg_op <> 'INSERT' and old.ze_skladu and old.sklad_id is not null and old.stav <> 'nepouzito' then stare := old.mnozstvi; end if;
  if tg_op <> 'DELETE' and new.ze_skladu and new.sklad_id is not null and new.stav <> 'nepouzito' then nove := new.mnozstvi; end if;
  if tg_op = 'UPDATE' and old.sklad_id is not distinct from new.sklad_id then
    if nove <> stare then
      insert into public.sklad_pohyby (sklad_id, druh, zmena, zakazka_id, dil_id) values (new.sklad_id, 'zakazka', stare - nove, new.zakazka_id, new.id);
    end if;
    return new;
  end if;
  if stare <> 0 and exists (select 1 from public.sklad where id = old.sklad_id) then
    insert into public.sklad_pohyby (sklad_id, druh, zmena, zakazka_id, dil_id)
    values (old.sklad_id, 'zakazka', stare, old.zakazka_id, case when tg_op = 'DELETE' then null else old.id end);
  end if;
  if nove <> 0 then
    insert into public.sklad_pohyby (sklad_id, druh, zmena, zakazka_id, dil_id) values (new.sklad_id, 'zakazka', -nove, new.zakazka_id, new.id);
  end if;
  return coalesce(new, old);
end $$;
revoke execute on function public.sklad_z_dilu() from public, anon, authenticated;
create trigger sklad_z_dilu after insert or update of sklad_id, ze_skladu, mnozstvi, stav or delete on public.dily
  for each row execute function public.sklad_z_dilu();

-- ulozit_dily: navíc sklad_id a ze_skladu
create or replace function public.ulozit_dily(p_zakazka uuid, p_dily jsonb) returns int language plpgsql set search_path = '' as $$
declare n int;
begin
  if not (select soukrome.je_clen()) then raise exception 'Nepřihlášený uživatel'; end if;
  delete from public.dily d where d.zakazka_id = p_zakazka
    and d.id not in (select (x ->> 'id')::uuid from jsonb_array_elements(p_dily) x where nullif(x ->> 'id', '') is not null);
  insert into public.dily (id, zakazka_id, poradi, nazev, cislo_mb, vyrobce, cislo_vyrobce, dodavatel_id, mnozstvi, jednotka,
                           nakupni_cena, mena, kurz, marze_pct, prodejni_cena, stav, puvod, poznamka, sklad_id, ze_skladu, zmeneno)
  select coalesce(nullif(x ->> 'id', '')::uuid, gen_random_uuid()), p_zakazka, ord::int, coalesce(nullif(x ->> 'nazev', ''), '(bez názvu)'),
         nullif(x ->> 'cislo_mb', ''), nullif(x ->> 'vyrobce', ''), nullif(x ->> 'cislo_vyrobce', ''), nullif(x ->> 'dodavatel_id', '')::uuid,
         coalesce(nullif(x ->> 'mnozstvi', '')::numeric, 1), coalesce(nullif(x ->> 'jednotka', ''), 'ks'),
         nullif(x ->> 'nakupni_cena', '')::numeric, coalesce(nullif(x ->> 'mena', ''), 'CZK'), coalesce(nullif(x ->> 'kurz', '')::numeric, 1),
         coalesce(nullif(x ->> 'marze_pct', '')::numeric, 30), nullif(x ->> 'prodejni_cena', '')::numeric,
         coalesce(nullif(x ->> 'stav', ''), 'potreba')::public.stav_dilu, nullif(x ->> 'puvod', ''), nullif(x ->> 'poznamka', ''),
         (select s.id from public.sklad s where s.id = nullif(x ->> 'sklad_id', '')::uuid), coalesce((x ->> 'ze_skladu')::boolean, false), now()
  from jsonb_array_elements(p_dily) with ordinality as t(x, ord)
  on conflict (id) do update set
    poradi = excluded.poradi, nazev = excluded.nazev, cislo_mb = excluded.cislo_mb, vyrobce = excluded.vyrobce,
    cislo_vyrobce = excluded.cislo_vyrobce, dodavatel_id = excluded.dodavatel_id, mnozstvi = excluded.mnozstvi, jednotka = excluded.jednotka,
    nakupni_cena = excluded.nakupni_cena, mena = excluded.mena, kurz = excluded.kurz, marze_pct = excluded.marze_pct,
    prodejni_cena = excluded.prodejni_cena, stav = excluded.stav, puvod = excluded.puvod, poznamka = excluded.poznamka,
    sklad_id = excluded.sklad_id, ze_skladu = excluded.ze_skladu, zmeneno = now()
  where public.dily.zakazka_id = p_zakazka;
  get diagnostics n = row_count;
  return n;
end $$;

-- zpětně: všechny dosavadní díly do katalogu (od nejstarší zakázky, ať zůstane poslední cena a dodavatel)
do $$
declare r record;
begin
  for r in select d.id from public.dily d left join public.zakazky z on z.id = d.zakazka_id
           where d.sklad_id is null order by z.datum_prijmu nulls first, z.cislo nulls first, d.poradi loop
    update public.dily set sklad_id = null where id = r.id;          -- spustí dil_do_katalogu
  end loop;
end $$;
