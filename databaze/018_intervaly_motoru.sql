-- Intervaly podle motoru (přebíjí interval skupiny A/B/C) + úpravy podle Vaška 29.10.2026
create table servisni_intervaly_motoru (
  motor text not null references motory(kod),
  ukon text not null,
  interval_km int,
  interval_mesice int,
  zdroj text,
  primary key (motor, ukon)
);
alter table public.servisni_intervaly_motoru enable row level security;
create policy dilna on public.servisni_intervaly_motoru for all to authenticated using ((select soukrome.je_clen())) with check ((select soukrome.je_clen()));

-- M110: seřízení ventilů každých 18 000 km, bez časového intervalu
insert into servisni_intervaly_motoru (motor, ukon, interval_km, interval_mesice, zdroj)
values ('M110', 'ventily', 18000, null, 'Mercedes Restorations');

-- diferenciál: 40 000 km nebo 4 roky, všechny skupiny
update servisni_intervaly set interval_km = 40000, interval_mesice = 48, zdroj = 'Mercedes Restorations' where ukon = 'diferencial';
