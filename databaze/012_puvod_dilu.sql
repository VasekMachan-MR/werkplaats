-- Díl: původ (originál MB / aftermarket) – barva řádku v parts listu
alter table dily add column puvod text check (puvod in ('original', 'aftermarket'));

create or replace function ulozit_dily(p_zakazka uuid, p_dily jsonb) returns int language plpgsql set search_path = '' as $$
declare n int;
begin
  if not (select soukrome.je_clen()) then raise exception 'Nepřihlášený uživatel'; end if;
  delete from public.dily d where d.zakazka_id = p_zakazka
    and d.id not in (select (x ->> 'id')::uuid from jsonb_array_elements(p_dily) x where nullif(x ->> 'id', '') is not null);
  insert into public.dily (id, zakazka_id, poradi, nazev, cislo_mb, vyrobce, cislo_vyrobce, dodavatel_id, mnozstvi, jednotka,
                           nakupni_cena, mena, kurz, marze_pct, prodejni_cena, stav, puvod, poznamka, zmeneno)
  select coalesce(nullif(x ->> 'id', '')::uuid, gen_random_uuid()), p_zakazka, ord::int, coalesce(nullif(x ->> 'nazev', ''), '(bez názvu)'),
         nullif(x ->> 'cislo_mb', ''), nullif(x ->> 'vyrobce', ''), nullif(x ->> 'cislo_vyrobce', ''), nullif(x ->> 'dodavatel_id', '')::uuid,
         coalesce(nullif(x ->> 'mnozstvi', '')::numeric, 1), coalesce(nullif(x ->> 'jednotka', ''), 'ks'),
         nullif(x ->> 'nakupni_cena', '')::numeric, coalesce(nullif(x ->> 'mena', ''), 'CZK'), coalesce(nullif(x ->> 'kurz', '')::numeric, 1),
         coalesce(nullif(x ->> 'marze_pct', '')::numeric, 30), nullif(x ->> 'prodejni_cena', '')::numeric,
         coalesce(nullif(x ->> 'stav', ''), 'potreba')::public.stav_dilu, nullif(x ->> 'puvod', ''), nullif(x ->> 'poznamka', ''), now()
  from jsonb_array_elements(p_dily) with ordinality as t(x, ord)
  on conflict (id) do update set
    poradi = excluded.poradi, nazev = excluded.nazev, cislo_mb = excluded.cislo_mb, vyrobce = excluded.vyrobce,
    cislo_vyrobce = excluded.cislo_vyrobce, dodavatel_id = excluded.dodavatel_id, mnozstvi = excluded.mnozstvi, jednotka = excluded.jednotka,
    nakupni_cena = excluded.nakupni_cena, mena = excluded.mena, kurz = excluded.kurz, marze_pct = excluded.marze_pct,
    prodejni_cena = excluded.prodejni_cena, stav = excluded.stav, puvod = excluded.puvod, poznamka = excluded.poznamka, zmeneno = now()
  where public.dily.zakazka_id = p_zakazka;
  get diagnostics n = row_count;
  return n;
end $$;
