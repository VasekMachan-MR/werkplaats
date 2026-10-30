-- Denní záloha (Vašek 30.10.2026): funkce „zaloha“ pustí jen s jednorázovým klíčem platným 15 minut.
-- Klíč vznikne těsně před zálohou, v databázi je jen jeho otisk SHA-256 a po použití se smaže. Žádné trvalé heslo nikde.
create table if not exists soukrome.zalohovaci_klice (
  otisk text primary key check (otisk ~ '^[0-9a-f]{64}$'),
  plati_do timestamptz not null default now() + interval '15 minutes'
);
alter table soukrome.zalohovaci_klice enable row level security;
revoke all on soukrome.zalohovaci_klice from public, anon, authenticated;

-- ověří a spotřebuje klíč (volá jen serverová funkce se service role)
create or replace function public.pouzit_zalohovaci_klic(p_otisk text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from soukrome.zalohovaci_klice where plati_do < now();
  delete from soukrome.zalohovaci_klice where otisk = p_otisk;
  get diagnostics n = row_count;
  return n = 1;
end $$;
revoke all on function public.pouzit_zalohovaci_klic(text) from public, anon, authenticated;
grant execute on function public.pouzit_zalohovaci_klic(text) to service_role;
