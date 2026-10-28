-- Pomocné funkce pro práva přesunout mimo veřejné API
create schema if not exists soukrome;
grant usage on schema soukrome to authenticated;
alter function public.je_clen() set schema soukrome;
alter function public.je_majitel() set schema soukrome;
