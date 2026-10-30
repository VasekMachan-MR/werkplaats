-- Podpis z E-servisky se nevkládal do PDF (Vašek 30.10.2026): serverová funkce (service_role) mění u vydaného dokladu
-- jen pdf_soubor_id, ale kontrola úhrady volala soukrome.je_majitel() i tehdy, když se úhrada neměnila
-- → „permission denied for schema soukrome“. Kontrola majitele se teď volá jen při skutečné změně úhrady.
create or replace function public.hlidej_zamceny_doklad()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  if tg_op = 'DELETE' then
    if old.zamceno and not (current_setting('werk.mazani_dokladu', true) = 'ano'
                            or (current_setting('werk.mazani_zakazky', true) = 'ano' and old.druh not in ('faktura', 'zalohova', 'opravny'))) then
      raise exception 'Doklad % je vydaný a nelze ho smazat (oprava = opravný doklad -6)', old.cislo;
    end if;
    return old;
  end if;
  if old.odeslano_uol is not null and new.odeslano_uol is distinct from old.odeslano_uol then
    raise exception 'Doklad % už byl předán účetní – to nejde vrátit', old.cislo;
  end if;
  if new.zaplaceno is distinct from old.zaplaceno then
    if not (select soukrome.je_majitel()) then
      raise exception 'Úhradu dokladu může označit jen majitel';
    end if;
  end if;
  if old.zamceno and (to_jsonb(new) - 'pdf_soubor_id' - 'odeslano_uol' - 'zaplaceno')
                  <> (to_jsonb(old) - 'pdf_soubor_id' - 'odeslano_uol' - 'zaplaceno') then
    raise exception 'Doklad % je vydaný a nelze ho měnit (oprava = opravný doklad -6)', old.cislo;
  end if;
  return new;
end $function$;
