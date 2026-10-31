-- 051: „Velký servis (prohlídka)“ nahrazen úkonem „Klínové řemeny“ (Vašek 31.10.2026) – v E-servisce („Co je příště na řadě“) i ve Werkplaats (Servisní úkony).
-- Interval podle MB Maintenance Sheets: kontrola stavu a napnutí klínových řemenů (job 1350) při každém servisu, výměna podle stavu:
--   A (1986–97) a B (1981–85): každých 15 000 mil / 24 000 km nebo 2 roky; C (do 1980): každých 12 500 mil / 20 000 km.
update public.servisni_ukony set ukon = 'remeny', nazev = 'Klínové řemeny' where ukon = 'servis';
update public.servisni_intervaly set ukon = 'remeny', zdroj = 'MB Maintenance System Sheet 1986–1997 (job 1350: V-belts – check condition and tension)' where ukon = 'servis' and skupina = 'A';
update public.servisni_intervaly set ukon = 'remeny', zdroj = 'MB Maintenance System Sheets 1981–85 (job 1350: V-belts – check condition, retighten)' where ukon = 'servis' and skupina = 'B';
update public.servisni_intervaly set ukon = 'remeny', zdroj = 'MB Regular Maintenance Inspection 1979 (job 1350: V-belts – check condition, retighten)' where ukon = 'servis' and skupina = 'C';
update public.servisni_intervaly_motoru set ukon = 'remeny' where ukon = 'servis';
-- dřívější zaškrtnutý „Velký servis“ u zakázek (7370, 7372, 7378) se odebere – úkon už neexistuje, klínové řemeny se zaškrtnou nově
update public.zakazky set servisni_ukony = array_remove(servisni_ukony, 'servis') where 'servis' = any(servisni_ukony);
