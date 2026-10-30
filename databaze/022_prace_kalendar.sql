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

-- Dopodepsání zakázkového listu z E-servisky (zákazník spěchal a odešel bez podpisu):
-- zákazník podepíše z domu → podpis se uloží sem → Werkplaats z něj vystaví podepsanou verzi listu (7380-1-2)
create table if not exists public.dalkove_podpisy (
  id uuid primary key default gen_random_uuid(),
  doklad_id uuid not null unique references public.doklady(id) on delete cascade,
  soubor_id uuid not null references public.soubory(id) on delete cascade,
  podepsano timestamptz not null default now(),
  ip text,
  zarizeni text,
  vystaveny_doklad_id uuid references public.doklady(id) on delete set null
);
alter table public.dalkove_podpisy enable row level security;
create policy dilna_cte on public.dalkove_podpisy for select to authenticated using ((select soukrome.je_clen()));
create policy dilna_upravuje on public.dalkove_podpisy for update to authenticated using ((select soukrome.je_clen())) with check ((select soukrome.je_clen()));
-- zapisuje jen serverová funkce E-servisky (service role); mazání jen majitel
create policy majitel_maze on public.dalkove_podpisy for delete to authenticated using ((select soukrome.je_majitel()));

-- Dvoufázové přihlášení: data dílny vidí jen ten, kdo se při přihlášení ověřil kódem z aplikace (Google Authenticator) – aal2
create or replace function soukrome.je_clen()
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (select 1 from public.uzivatele where id = auth.uid() and aktivni);
$function$;
create or replace function soukrome.je_majitel()
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (select 1 from public.uzivatele where id = auth.uid() and role = 'majitel' and aktivni);
$function$;
