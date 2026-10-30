-- Rozpracovaný příjem vidět na všech zařízeních (Vašek 30.10.2026): koncept se ukládá i na server.
-- Jeden koncept na přihlášeného člověka; každý vidí a mění jen ten svůj.
create table if not exists public.koncepty_prijmu (
  uzivatel_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null,
  upraveno timestamptz not null default now()
);
alter table public.koncepty_prijmu enable row level security;
create policy vlastni on public.koncepty_prijmu for all to authenticated
  using (uzivatel_id = (select auth.uid()) and (select soukrome.je_clen()))
  with check (uzivatel_id = (select auth.uid()) and (select soukrome.je_clen()));
