-- Katalog motorů a servisních úkonů: které úkony se u daného motoru vůbec dělají
-- (diesel nemá svíčky, seřízení ventilů jen u motorů s mechanicky seřiditelnými ventily).
create table motory (
  kod text primary key,                         -- M110, M117, OM617 …
  palivo text not null check (palivo in ('benzin', 'diesel')),
  serizovani_ventilu boolean not null default false,
  popis text
);
create table typy_motoru (
  klic text primary key,                        -- kód typu z VIN (126.022) nebo název modelu (560 SL)
  motor text not null references motory(kod)
);
create table servisni_ukony (
  ukon text primary key,
  nazev text not null,
  poradi int not null,
  jen_palivo text check (jen_palivo in ('benzin', 'diesel')),
  jen_serizovani_ventilu boolean not null default false
);
alter table vozidla add column motor text references motory(kod);   -- ruční určení motoru, jinak podle čísla motoru / VIN / modelu
do $$ declare t text; begin
  foreach t in array array['motory', 'typy_motoru', 'servisni_ukony'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy dilna on public.%I for all to authenticated using ((select soukrome.je_clen())) with check ((select soukrome.je_clen()))', t);
  end loop;
end $$;

insert into motory (kod, palivo, serizovani_ventilu, popis) values
  ('M102','benzin',false,'4válec 2.0–2.3'), ('M103','benzin',false,'6válec 2.6–3.0'), ('M104','benzin',false,'6válec 24V'),
  ('M110','benzin',true,'6válec DOHC 2.8'), ('M115','benzin',true,'4válec 2.0–2.3'),
  ('M116','benzin',false,'V8 3.5–3.8'), ('M117','benzin',false,'V8 4.5–5.6'), ('M119','benzin',false,'V8 32V'),
  ('OM615','diesel',true,'4válec 2.0–2.2'), ('OM616','diesel',true,'4válec 2.4'), ('OM617','diesel',true,'5válec 3.0'),
  ('OM601','diesel',false,'4válec 2.0–2.2'), ('OM602','diesel',false,'5válec 2.5–2.9'), ('OM603','diesel',false,'6válec 3.0–3.5');

insert into typy_motoru (klic, motor) values
  ('107.042','M110'), ('107.043','M116'), ('107.044','M117'), ('107.045','M117'), ('107.048','M117'),
  ('124.050','M103'), ('126.022','M110'), ('126.023','M110'), ('126.024','M103'), ('126.025','M103'),
  ('108.068','M117'), ('116.033','M117'), ('123.130','OM616'), ('123.133','OM617'), ('123.150','OM617'),
  ('123.153','OM617'), ('123.193','OM617'), ('123.190','OM617'),
  ('280 SL','M110'), ('350 SL','M116'), ('450 SL','M117'), ('500 SL','M117'), ('560 SL','M117'),
  ('280 SE','M110'), ('280 SEL','M110'), ('300 SE','M103'), ('300 SEL','M103'), ('300 CE','M103'),
  ('280 SEL 4.5','M117'), ('300 SEL 6.3','M117');

insert into servisni_ukony (ukon, nazev, poradi, jen_palivo, jen_serizovani_ventilu) values
  ('olej','Motorový olej + filtr',1,null,false), ('servis','Velký servis (prohlídka)',2,null,false),
  ('atf','Olej + filtr automatu',3,null,false), ('vzduch','Vzduchový filtr',4,null,false),
  ('svicky','Zapalovací svíčky',5,'benzin',false), ('palivo','Palivový filtr',6,null,false),
  ('brzdy','Brzdová kapalina',7,null,false), ('chladici','Chladicí kapalina',8,null,false),
  ('diferencial','Olej diferenciálu',9,null,false), ('servo','Olej servořízení',10,null,false),
  ('ventily','Seřízení ventilů',11,null,true);

-- seřízení ventilů i pro skupiny A a C (diesely OM61x, M110/M115 před 1981)
insert into servisni_intervaly (skupina, ukon, poradi, interval_km, interval_mesice, zdroj) values
  ('A','ventily',11,24000,24,'MB Maintenance System Sheet 1986–1997'),
  ('C','ventily',11,20000,null,'MB Regular Maintenance Inspection 1979');
