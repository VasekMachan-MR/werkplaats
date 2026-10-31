-- 048: notifikace na telefon (Web Push) – Vašek 31.10.2026: upozornění, když zákazník v E-servisce podepíše / odsouhlasí doklad.
-- push_odbery: zařízení, na kterých si člen dílny zapnul upozornění (iPhone s Werkplaats na ploše, počítač…). Každý vidí a mění jen svoje.
-- push_vapid: klíče pro odesílání (vytvoří je funkce notifikace při prvním použití). Soukromý klíč čte jen server – žádné pravidlo pro aplikaci.

create table if not exists public.push_odbery (
  id uuid primary key default gen_random_uuid(),
  uzivatel_id uuid not null default auth.uid() references public.uzivatele(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  zarizeni text,
  vytvoreno timestamptz not null default now(),
  naposledy timestamptz
);
alter table public.push_odbery enable row level security;
drop policy if exists vlastni on public.push_odbery;
create policy vlastni on public.push_odbery for all to authenticated
  using (uzivatel_id = (select auth.uid()) and (select soukrome.je_clen()))
  with check (uzivatel_id = (select auth.uid()) and (select soukrome.je_clen()));
create index if not exists push_odbery_uzivatel on public.push_odbery (uzivatel_id);

create table if not exists public.push_vapid (
  id int primary key default 1 check (id = 1),
  verejny text not null,
  soukromy jsonb not null,
  vytvoreno timestamptz not null default now()
);
alter table public.push_vapid enable row level security;   -- bez pravidel: jen server (service role)
revoke all on public.push_vapid from anon, authenticated;
