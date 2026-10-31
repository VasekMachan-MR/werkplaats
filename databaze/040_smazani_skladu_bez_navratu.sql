-- 040: smazaná položka skladu se už sama nevrátí (noční kontrola 31.10.2026)
-- dily.sklad_id má „on delete set null“. Postgres to provede jako UPDATE dílu, a protože pak je sklad_id prázdné,
-- trigger dil_do_katalogu položku hned znovu založil (nové id, stejný název) – smazání ze skladu tak nemělo efekt.
-- Nově: když se dílu změní JEN sklad_id na prázdné (to dělá právě mazání položky skladu), trigger nic nezakládá
-- a díl zůstane bez vazby na sklad. Vše ostatní (uložení dílu, přejmenování, nový díl) funguje beze změny.
create or replace function public.dil_do_katalogu()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare k text; cislo text := regexp_replace(upper(coalesce(new.cislo_mb, '')), '[^A-Z0-9]', '', 'g');
begin
  if tg_op = 'UPDATE' and old.sklad_id is not null and new.sklad_id is null
     and (to_jsonb(new) - 'sklad_id') = (to_jsonb(old) - 'sklad_id') then
    return new;   -- položka skladu byla smazána (on delete set null) → nezakládat ji znovu
  end if;
  if not new.ze_skladu or new.sklad_id is null then
    k := case when cislo <> '' then 'c:' || cislo else 'n:' || lower(btrim(coalesce(new.nazev, ''))) end;
    if k in ('n:', 'n:(bez názvu)') then new.sklad_id := null; return new; end if;
    insert into public.sklad (nazev, cislo_mb, vyrobce, cislo_vyrobce, puvod, jednotka)
    values (btrim(new.nazev), nullif(btrim(coalesce(new.cislo_mb, '')), ''), new.vyrobce, new.cislo_vyrobce, new.puvod, coalesce(new.jednotka, 'ks'))
    on conflict (klic) do nothing;
    select id into new.sklad_id from public.sklad where klic = k;
  end if;
  update public.sklad s set
    nakupni_cena = case when new.nakupni_cena is not null and new.nakupni_cena > 0 then round(new.nakupni_cena * coalesce(new.kurz, 1), 2) else s.nakupni_cena end,
    dodavatel_id = coalesce(new.dodavatel_id, s.dodavatel_id),
    vyrobce = coalesce(s.vyrobce, new.vyrobce), cislo_vyrobce = coalesce(s.cislo_vyrobce, new.cislo_vyrobce), puvod = coalesce(s.puvod, new.puvod)
  where s.id = new.sklad_id and not new.ze_skladu
    and (tg_op = 'INSERT' or new.nakupni_cena is distinct from old.nakupni_cena or new.kurz is distinct from old.kurz
         or new.dodavatel_id is distinct from old.dodavatel_id or new.sklad_id is distinct from old.sklad_id);
  return new;
end $function$;
