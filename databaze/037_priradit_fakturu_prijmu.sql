-- 037: přiřazení přijaté faktury k už hotovému příjmu na sklad (Vašek 30.10.2026)
-- Pohyby skladu se jinak nemění (jen vkládají) – tahle funkce smí změnit jen soubor_id u příjmu.
create or replace function public.priradit_fakturu_prijmu(p_pohyb uuid, p_soubor uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select soukrome.je_clen()) then raise exception 'Nepovoleno'; end if;
  if p_soubor is not null and not exists (select 1 from public.soubory where id = p_soubor and druh = 'nakupni_doklad' and smazano is null) then
    raise exception 'Faktura nenalezena';
  end if;
  update public.sklad_pohyby set soubor_id = p_soubor where id = p_pohyb and druh = 'prijem';
  if not found then raise exception 'Příjem na sklad nenalezen'; end if;
end $$;
revoke all on function public.priradit_fakturu_prijmu(uuid, uuid) from public, anon;
grant execute on function public.priradit_fakturu_prijmu(uuid, uuid) to authenticated;
