-- Nové funkce 30.10.2026 (Vašek): postup prací v zakázce, kalendář, dopodepsání z E-servisky.

-- Práce: odrážky z inspekce [{t: text, h: hotovo}] – zákazník v E-servisce vidí jen poměr hotovo/celkem
alter table public.zakazky add column if not exists ukoly jsonb not null default '[]';
