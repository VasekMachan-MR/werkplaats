-- 047: kontrola intervalů proti MB Maintenance Sheets 1979, 1981–83, 1984–85, 1986–97 (Vašek 31.10.2026: „otestuj, pak nasadíme“)
-- 1) Brzdová kapalina 1× ročně u skupin B (1981–85) a C (do 1980) – všechny listy 1979–1985: „once a year, preferably in spring“.
-- 2) Intervaly podle paliva (diesel) – nová tabulka servisni_intervaly_paliva, přebíjí interval skupiny (interval podle motoru přebíjí oba):
--    A diesel olej 8 000 km / 1 rok (kromě typů 140.134, 124.131, 210.020 – ty mají běžný interval) – list 1986–97
--    A diesel palivový filtr 48 000 km do MY1995 (od MY1996 96 000 km = interval skupiny) – list 1986–97
--    B diesel olej 8 000 km / 1 rok od MY1984 (5 000 mil; listy 1981–83 měly 15 000 mil, necháváme přísnějších 12 000 km skupiny)
--    B diesel palivový filtr 48 000 km (30 000 mil; benzin 60 000 mil = 96 000 km) – listy 1981–85
--    rok_od / rok_do = modelový rok vozu (vozidla.rok); bez roku platí řádek bez omezení roku.
--    krome_typu = typ z VIN („140.134“), u kterého řádek neplatí.

update public.servisni_intervaly set interval_mesice = 12, zdroj = 'MB Maintenance System Sheets 1981–85' where skupina = 'B' and ukon = 'brzdy';
update public.servisni_intervaly set interval_mesice = 12 where skupina = 'C' and ukon = 'brzdy';
update public.servisni_intervaly set zdroj = 'MB Maintenance System Sheets 1981–85' where skupina = 'B' and zdroj like 'MB Maintenance System Sheets 1981, 1984–85%';

create table if not exists public.servisni_intervaly_paliva (
  id serial primary key,
  skupina text not null check (skupina in ('A', 'B', 'C')),
  palivo text not null check (palivo in ('benzin', 'diesel')),
  ukon text not null,
  rok_od int,
  rok_do int,
  krome_typu text[],
  interval_km int,
  interval_mesice int,
  zdroj text
);
alter table public.servisni_intervaly_paliva enable row level security;
drop policy if exists dilna_cte on public.servisni_intervaly_paliva;
drop policy if exists majitel_meni on public.servisni_intervaly_paliva;
create policy dilna_cte on public.servisni_intervaly_paliva for select to authenticated using ((select soukrome.je_clen()));
create policy majitel_meni on public.servisni_intervaly_paliva for all to authenticated using ((select soukrome.je_majitel())) with check ((select soukrome.je_majitel()));

delete from public.servisni_intervaly_paliva;
insert into public.servisni_intervaly_paliva (skupina, palivo, ukon, rok_od, rok_do, krome_typu, interval_km, interval_mesice, zdroj) values
  ('A', 'diesel', 'olej',   null, null, array['140.134', '124.131', '210.020'], 8000, 12, 'MB Maintenance System Sheet 1986–1997 (diesel)'),
  ('A', 'diesel', 'palivo', null, 1995, null,                                   48000, null, 'MB Maintenance System Sheet 1986–1997 (diesel do MY1995)'),
  ('B', 'diesel', 'olej',   1984, null, null,                                   8000, 12, 'MB Maintenance System 1984–85 (diesel)'),
  ('B', 'diesel', 'palivo', null, null, null,                                   48000, null, 'MB Maintenance System Sheets 1981–85 (diesel)');
