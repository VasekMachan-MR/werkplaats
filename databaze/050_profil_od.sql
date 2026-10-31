-- 050: pořadí profilových fotek (Vašek 31.10.2026): v E-servisce se jako výchozí ukáže vždy ta profilovka, která se profilovou stala jako první.
-- soubory.profil_od = kdy se fotka stala profilovou (⭐ při nahrání i pozdějším označením); při zrušení ⭐ se smaže.
alter table public.soubory add column if not exists profil_od timestamptz;

create or replace function soukrome.soubory_profil_od() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.faze = 'profil' then
    if tg_op = 'INSERT' or old.faze is distinct from 'profil' then new.profil_od := coalesce(new.profil_od, now()); end if;
    if tg_op = 'UPDATE' and old.faze is distinct from 'profil' then new.profil_od := now(); end if;
  else
    new.profil_od := null;
  end if;
  return new;
end $$;
drop trigger if exists soubory_profil_od on public.soubory;
create trigger soubory_profil_od before insert or update of faze on public.soubory
  for each row execute function soukrome.soubory_profil_od();

-- stávající profilovky: pořadí podle nahrání
update public.soubory set profil_od = vytvoreno where faze = 'profil' and profil_od is null;
