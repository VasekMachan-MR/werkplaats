-- Daň k zakázce: výchozí 50 % (daň z příjmu + srážková daň), počítá se z práce a marže dílů. Vašek 30.10.2026
alter table public.zakazky alter column dan_pct set default 50;
update public.zakazky set dan_pct = 50 where dan_pct = 30;
-- políčko „Daň“ u zakázky: zapnuto = daň v souhrnu i na nabídce a faktuře
alter table public.zakazky add column if not exists dan_zapnuto boolean not null default true;
