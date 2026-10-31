-- 046: servisní úkony podle druhu převodovky (Vašek 31.10.2026: „Olej + filtr automatu“ se nabízel i u aut s manuálem).
-- Druh převodovky se nepíše zvlášť – Werkplaats i E-serviska ho určí samy z údajů vozidla:
--   vozidla.prevodovka: kód 722.xxx / „automat…“ = automat, kód 711–717.xxx / „manuál…“ = manuál;
--   jinak kódy výbavy (SA kód 420/421 = automatická převodovka).
-- servisni_ukony.jen_prevodovka: úkon jen pro automat / jen pro manuál (NULL = pro všechny).
-- Olej manuální převodovky: 60 000 km (Vašek 31.10.2026: „dej natvrdo, mělo by to sedět“).
-- Úkon automatu se jmenuje „Olej automatické převodovky + filtr“ (Vašek 31.10.2026).

alter table public.servisni_ukony add column if not exists jen_prevodovka text check (jen_prevodovka in ('automat', 'manual'));
update public.servisni_ukony set jen_prevodovka = 'automat', nazev = 'Olej automatické převodovky + filtr' where ukon = 'atf';

update public.servisni_ukony set poradi = poradi + 1 where poradi >= 4 and ukon <> 'manual';
insert into public.servisni_ukony (ukon, nazev, poradi, jen_prevodovka)
  values ('manual', 'Olej manuální převodovky', 4, 'manual')
  on conflict (ukon) do update set nazev = excluded.nazev, poradi = excluded.poradi, jen_prevodovka = excluded.jen_prevodovka;

update public.servisni_intervaly set poradi = poradi + 1 where poradi >= 4 and ukon <> 'manual';
insert into public.servisni_intervaly (skupina, ukon, poradi, interval_km, interval_mesice, zdroj)
select s, 'manual', 4, 60000, null, 'Mercedes Restorations'
  from unnest(array['A', 'B', 'C']) s
 where not exists (select 1 from public.servisni_intervaly i where i.skupina = s and i.ukon = 'manual');
