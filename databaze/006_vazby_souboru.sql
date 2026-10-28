-- Vazby na soubory (aby odkaz nikdy nevedl do prázdna a aplikace mohla načíst PDF dokladu jedním dotazem)
alter table doklady add constraint doklady_pdf_soubor_id_fkey foreign key (pdf_soubor_id) references soubory(id);
alter table podpisy add constraint podpisy_obrazek_soubor_id_fkey foreign key (obrazek_soubor_id) references soubory(id);
alter table uzivatele add constraint uzivatele_podpis_soubor_id_fkey foreign key (podpis_soubor_id) references soubory(id);
alter table nakupni_doklady add constraint nakupni_doklady_soubor_id_fkey foreign key (soubor_id) references soubory(id);
alter table servisni_plan add constraint servisni_plan_zdroj_soubor_id_fkey foreign key (zdroj_soubor_id) references soubory(id);
create index on doklady (pdf_soubor_id);
create index on podpisy (obrazek_soubor_id);
create index on uzivatele (podpis_soubor_id);
create index on nakupni_doklady (soubor_id);
create index on servisni_plan (zdroj_soubor_id);
