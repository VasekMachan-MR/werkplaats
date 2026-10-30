-- POZOR: zapnout až spolu s nasazením aplikace, která umí ověření kódem (jinak se stará verze aplikace k datům nedostane).
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
