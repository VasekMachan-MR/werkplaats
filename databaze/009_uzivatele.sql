-- Uživatelé dílny (Vašek, mechanici): vlastní podpis „Vyhotovil“, kdo co přijal / vystavil / nahrál

-- vlastní podpis jako obrázek (PNG, data URL) – každý si ho nastaví v profilu
alter table uzivatele add column podpis_obrazek text;
alter table uzivatele add column email text;
alter table uzivatele add column aktivni boolean not null default true;

-- každý smí upravit sám sebe (jméno, podpis), ale roli a aktivitu mění jen majitel
create policy upravit_sebe on uzivatele for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create function hlidej_roli() returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.role is distinct from old.role or new.aktivni is distinct from old.aktivni or new.id is distinct from old.id)
     and not soukrome.je_majitel() then
    raise exception 'Roli a přístup může měnit jen majitel';
  end if;
  return new;
end $$;
create trigger hlidej_roli before update on uzivatele for each row execute function hlidej_roli();

-- zablokovaný uživatel nevidí nic (je_clen počítá jen aktivní)
create or replace function soukrome.je_clen() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.uzivatele where id = auth.uid() and aktivni);
$$;
create or replace function soukrome.je_majitel() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.uzivatele where id = auth.uid() and role = 'majitel' and aktivni);
$$;

-- kdo zakázku přijal, kdo doklad vystavil, kdo soubor nahrál (vyplní se samo podle přihlášeného)
alter table zakazky add column prijal uuid references uzivatele(id) default auth.uid();
alter table doklady add column vystavil uuid references uzivatele(id) default auth.uid();
alter table soubory add column nahral uuid references uzivatele(id) default auth.uid();
alter table podpisy add column uzivatel_id uuid references uzivatele(id);
create index on zakazky (prijal);
create index on doklady (vystavil);
create index on soubory (nahral);
create index on podpisy (uzivatel_id);
