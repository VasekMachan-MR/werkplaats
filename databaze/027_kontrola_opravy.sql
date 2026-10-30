-- Opravy po kontrole 30.10.2026
-- 1) Fakturu / zálohu / opravný doklad nejde vyrobit úpravou jiného dokladu (mechanik přes změnu druhu)
drop policy if exists dilna_upravuje on public.doklady;
create policy dilna_upravuje on public.doklady for update to authenticated
  using ((select soukrome.je_clen()))
  with check ((select soukrome.je_clen()) and (druh not in ('faktura', 'zalohova', 'opravny') or (select soukrome.je_majitel())));

-- 2) Důkaz o podpisu z E-servisky nejde přepsat – z aplikace jde změnit jen odkaz na vystavený podepsaný list
create or replace function public.hlidej_dalkovy_podpis()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  if current_user <> 'service_role' and (new.doklad_id, new.soubor_id, new.podepsano, new.ip, new.zarizeni)
       is distinct from (old.doklad_id, old.soubor_id, old.podepsano, old.ip, old.zarizeni) then
    raise exception 'Podpis zákazníka z E-servisky nejde měnit';
  end if;
  return new;
end $function$;
drop trigger if exists hlidej_dalkovy_podpis on public.dalkove_podpisy;
create trigger hlidej_dalkovy_podpis before update on public.dalkove_podpisy for each row execute function public.hlidej_dalkovy_podpis();

-- 3) funkce jen pro přihlášené (anonymní klíč je nesmí volat vůbec)
revoke execute on function public.zapsat_vlastnictvi(uuid, uuid, boolean) from public, anon;
revoke execute on function public.vystavit_doklad(jsonb) from public, anon;
grant execute on function public.zapsat_vlastnictvi(uuid, uuid, boolean) to authenticated;
grant execute on function public.vystavit_doklad(jsonb) to authenticated;
