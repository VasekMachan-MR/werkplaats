-- Daň k zakázce: navýšení ceny práce o daň, kterou Vašek odvede (výchozí 30 %, jde u zakázky změnit). 30.10.2026
alter table public.zakazky add column if not exists dan_pct numeric not null default 30 check (dan_pct >= 0 and dan_pct <= 100);
