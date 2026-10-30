-- Anglické doklady (Vašek 30.10.2026): překlady vlastních textů (práce, díly, závady) – co se jednou opraví, aplikace si pamatuje.
-- klic = český text malými písmeny bez nadbytečných mezer
create table if not exists public.preklady (
  klic text primary key check (length(klic) between 1 and 500),
  cs text not null,
  en text not null check (length(btrim(en)) between 1 and 500),
  upravil uuid default auth.uid(),
  upraveno timestamptz not null default now()
);
alter table public.preklady enable row level security;
create policy dilna on public.preklady for all to authenticated using ((select soukrome.je_clen())) with check ((select soukrome.je_clen()));
