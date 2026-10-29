-- Servisní intervaly pro E-servisku („Co je příště na řadě“) a zaškrtávání provedených servisních úkonů u zakázky.
-- Skupiny podle stáří vozu (podklady MB ve složce Mercedes-Benz, odsouhlaseno Vaškem 29.10.2026):
--   A = MY 1986–1991 (Maintenance System Sheet 1986–1997, Owner's manual W126 1989)
--   B = MY 1981–1985 (Maintenance System Sheets 1981, 1984–85)
--   C = do MY 1980 (Regular Maintenance Inspection 1979; W108 podle M117)
-- Brzdová kapalina 2 roky (rozhodnutí Vaška), diferenciál a servořízení = vlastní doporučení dílny.

alter table zakazky add column servisni_ukony text[] not null default '{}';
alter table vozidla add column servisni_skupina text check (servisni_skupina in ('A', 'B', 'C'));   -- ruční přepsání, jinak podle roku

create table servisni_intervaly (
  skupina text not null check (skupina in ('A', 'B', 'C')),
  ukon text not null,
  poradi int not null,
  interval_km int,
  interval_mesice int,
  zdroj text not null,
  primary key (skupina, ukon)
);
alter table servisni_intervaly enable row level security;
create policy dilna on servisni_intervaly for all to authenticated using ((select soukrome.je_clen())) with check ((select soukrome.je_clen()));

insert into servisni_intervaly (skupina, ukon, poradi, interval_km, interval_mesice, zdroj) values
  ('A','olej',1,12000,12,'MB Maintenance System Sheet 1986–1997'),
  ('A','servis',2,24000,24,'MB Maintenance System Sheet 1986–1997'),
  ('A','atf',3,48000,null,'MB Maintenance System Sheet 1986–1997'),
  ('A','vzduch',4,48000,null,'MB Maintenance System Sheet 1986–1997'),
  ('A','svicky',5,48000,null,'MB Maintenance System Sheet 1986–1997'),
  ('A','palivo',6,96000,null,'MB Maintenance System Sheet 1986–1997'),
  ('A','brzdy',7,null,24,'MB Maintenance System Sheet 1986–1997'),
  ('A','chladici',8,null,36,'MB Maintenance System Sheet 1986–1997'),
  ('A','diferencial',9,60000,60,'Mercedes Restorations'),
  ('A','servo',10,48000,36,'Mercedes Restorations'),
  ('B','olej',1,12000,12,'MB Maintenance System Sheets 1981, 1984–85'),
  ('B','servis',2,24000,24,'MB Maintenance System Sheets 1981, 1984–85'),
  ('B','atf',3,48000,null,'MB Maintenance System Sheets 1981, 1984–85'),
  ('B','vzduch',4,48000,null,'MB Maintenance System Sheets 1981, 1984–85'),
  ('B','svicky',5,48000,null,'MB Maintenance System Sheets 1981, 1984–85'),
  ('B','palivo',6,96000,null,'MB Maintenance System Sheets 1981, 1984–85'),
  ('B','brzdy',7,null,24,'MB Maintenance System Sheets 1981, 1984–85'),
  ('B','chladici',8,null,36,'MB Maintenance System Sheets 1981, 1984–85'),
  ('B','diferencial',9,60000,60,'Mercedes Restorations'),
  ('B','servo',10,48000,36,'Mercedes Restorations'),
  ('B','ventily',11,24000,24,'MB Maintenance System Sheets 1981, 1984–85 (M110)'),
  ('C','olej',1,20000,12,'MB Regular Maintenance Inspection 1979'),
  ('C','servis',2,20000,null,'MB Regular Maintenance Inspection 1979'),
  ('C','atf',3,60000,null,'MB Regular Maintenance Inspection 1979'),
  ('C','vzduch',4,60000,null,'MB Regular Maintenance Inspection 1979'),
  ('C','svicky',5,20000,null,'MB Regular Maintenance Inspection 1979'),
  ('C','palivo',6,60000,null,'MB Regular Maintenance Inspection 1979'),
  ('C','brzdy',7,null,24,'MB Regular Maintenance Inspection 1979'),
  ('C','chladici',8,null,36,'MB Regular Maintenance Inspection 1979'),
  ('C','diferencial',9,60000,60,'Mercedes Restorations'),
  ('C','servo',10,48000,36,'Mercedes Restorations');
