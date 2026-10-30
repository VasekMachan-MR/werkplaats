-- Dopodepsání starého zakázkového listu (PDF v „Ostatních dokumentech“) zákazníkem v E-servisce (Vašek 30.10.2026)
-- soubory.podpis_pozadan = kdy dílna poslala PDF k podpisu; soubory.podepsany_z = podepsaná kopie (…_signed.pdf) ukazuje na originál
alter table public.soubory add column if not exists podpis_pozadan timestamptz;
alter table public.soubory add column if not exists podepsany_z uuid references public.soubory(id) on delete set null;

-- důkaz podpisu: buď k dokladu (nový zakázkový list), nebo k PDF z archivu
alter table public.dalkove_podpisy alter column doklad_id drop not null;
-- bez cizího klíče: druhá vazba dalkove_podpisy→soubory by rozbila načítání zakázky v aplikaci (soubory(klic) by nebylo jednoznačné)
alter table public.dalkove_podpisy add column if not exists archiv_soubor_id uuid;
alter table public.dalkove_podpisy drop constraint if exists dalkove_podpisy_archiv_soubor_id_fkey;
alter table public.dalkove_podpisy drop constraint if exists dalkove_podpisy_k_cemu;
alter table public.dalkove_podpisy add constraint dalkove_podpisy_k_cemu check (doklad_id is not null or archiv_soubor_id is not null);

create or replace function public.hlidej_dalkovy_podpis()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  if current_user <> 'service_role' and (new.doklad_id, new.archiv_soubor_id, new.soubor_id, new.podepsano, new.ip, new.zarizeni)
       is distinct from (old.doklad_id, old.archiv_soubor_id, old.soubor_id, old.podepsano, old.ip, old.zarizeni) then
    raise exception 'Podpis zákazníka z E-servisky nejde měnit';
  end if;
  return new;
end $function$;
