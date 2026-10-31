-- 044: oprava po 043 (Vašek 31.10.2026) – smazání zakázky / dokladu hlásilo chybu emaily_doklad_id_fkey.
-- Mazací funkce (014, 015, 030, 039, 042) běží pod přihlášeným členem dílny a mažou i záznamy v emaily;
-- v 043 zůstalo jen čtení, takže se e-maily nesmazaly a doklad pak nešel smazat. Člen dílny smí záznamy e-mailů mazat.
drop policy if exists dilna_maze on public.emaily;
create policy dilna_maze on public.emaily for delete to authenticated using ((select soukrome.je_clen()));
