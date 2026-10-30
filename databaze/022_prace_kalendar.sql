-- Nové funkce 30.10.2026 (Vašek): postup prací v zakázce, kalendář, dopodepsání z E-servisky.

-- Práce: odrážky z inspekce [{t: text, h: hotovo}] – zákazník v E-servisce vidí jen poměr hotovo/celkem
alter table public.zakazky add column if not exists ukoly jsonb not null default '[]';

-- Kalendář v Přehledu: vlastní termíny (zakázky – příjem, termín, předání – se berou rovnou ze zakázek)
create table if not exists public.kalendar (
  id uuid primary key default gen_random_uuid(),
  datum date not null,
  cas time,
  text text not null check (length(text) between 1 and 200),
  zakazka_id uuid references public.zakazky(id) on delete set null,
  vytvoril uuid default auth.uid(),
  vytvoreno timestamptz not null default now()
);
create index if not exists kalendar_datum on public.kalendar (datum);
alter table public.kalendar enable row level security;
create policy dilna on public.kalendar for all to authenticated using ((select soukrome.je_clen())) with check ((select soukrome.je_clen()));
