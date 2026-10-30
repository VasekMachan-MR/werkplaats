-- Naskladnění z faktur (Vašek 30.10.2026)
-- • doprava/poštovné se vede u nákupní faktury zvlášť, nepočítá se do cen dílů
-- • příjem na sklad ví, z které nákupní faktury přišel (doplňuje soubor_id z 035)
alter table public.nakupni_doklady add column if not exists doprava numeric(12,2);
comment on column public.nakupni_doklady.doprava is 'Doprava/poštovné z faktury (s DPH), vedená zvlášť – nepočítá se do nákupních cen dílů';
alter table public.sklad_pohyby add column if not exists nakupni_doklad_id uuid references public.nakupni_doklady(id) on delete set null;
create index if not exists sklad_pohyby_nakupni_doklad on public.sklad_pohyby (nakupni_doklad_id) where nakupni_doklad_id is not null;
