-- 043: automatický e-mail zákazníkovi po podpisu zakázkového listu (Vašek 31.10.2026)
-- Tabulka emaily (z 001) dostane údaje pro sledování doručení: zakázka, ID zprávy u odesílací služby, chyba, poslední změna.
-- stav: odesilam → odeslano → doruceno | nedoruceno | spam | chyba
-- Zapisuje jen serverová funkce odeslat-email / email-udalosti (service role). Dílna stav jen čte.

alter table public.emaily
  add column if not exists zakazka_id uuid references public.zakazky(id),
  add column if not exists predmet text,
  add column if not exists zprava_id text,
  add column if not exists chyba text,
  add column if not exists zmeneno timestamptz not null default now();

create index if not exists emaily_zakazka_idx on public.emaily (zakazka_id);
create unique index if not exists emaily_zprava_idx on public.emaily (zprava_id) where zprava_id is not null;

alter table public.emaily enable row level security;
drop policy if exists dilna on public.emaily;
drop policy if exists dilna_cte on public.emaily;
create policy dilna_cte on public.emaily for select to authenticated using ((select soukrome.je_clen()));
