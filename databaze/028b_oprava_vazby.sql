-- 028b (30.10.2026): vazba dálkového podpisu na archivní PDF bez cizího klíče (soubor se může smazat)
alter table public.dalkove_podpisy drop constraint if exists dalkove_podpisy_archiv_soubor_id_fkey;
