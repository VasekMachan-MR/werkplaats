-- 035: přijatá faktura u naskladnění (Vašek 30.10.2026)
-- Jedna faktura může patřit k více příjmům (např. 2 druhy pneumatik na jedné faktuře).
-- Soubor: soubory.druh = 'nakupni_doklad', faze = 'sklad', bez zakázky. Díl ze skladu v zakázce pak fakturu ukáže sám.
alter table public.sklad_pohyby add column if not exists soubor_id uuid references public.soubory(id) on delete set null;
create index if not exists sklad_pohyby_soubor on public.sklad_pohyby (soubor_id) where soubor_id is not null;
