// Záloha dat (Vašek 30.10.2026): všechny tabulky + seznam souborů v úložišti (fotky a PDF se zrcadlí zvlášť do Cloudflare R2).
// Denní záloha (2:00): pustí jen s klíčem zálohy. V kódu je jen jeho otisk SHA-256, samotný klíč je v souboru
// .klic-zalohy ve složce iCloud „Mercedes Restorations/Zálohy Werkplaats“ (kde jsou i zálohy samotné).
import { createClient } from "jsr:@supabase/supabase-js@2";
const OTISK = "81f89862ecb5b10711c83ca2d0d2c64e407a8aa6de7db077389e97cb504ccbad";
const TABULKY = ["ciselne_rady","dalkove_podpisy","dily","dodavatele","doklady","emaily","kalendar","katalog_modely","katalog_motorizace","katalog_rady","katalog_vozu",
  "motory","nabidky","nakupni_doklady","nastaveni","podpisy","polozky","postupy","sazby","servisni_intervaly","servisni_intervaly_motoru","servisni_plan",
  "servisni_ukony","soubory","typy_motoru","uzivatele","vlastnictvi","vozidla","zakazky","zakaznici","koncepty_prijmu","sklad","sklad_pohyby","preklady"];
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
Deno.serve(async req => {
  const k = req.headers.get("x-zaloha") || "";
  if (hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(k))) !== OTISK) return new Response("zakázáno", { status: 403 });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const tabulky: Record<string, unknown> = {};
  for (const t of TABULKY) {
    const rows: unknown[] = [];
    for (let od = 0; ; od += 1000) {
      const { data, error } = await sb.from(t).select("*").range(od, od + 999);
      if (error) { tabulky[t] = { chyba: error.message }; break; }
      rows.push(...data); if (data.length < 1000) { tabulky[t] = rows; break; }
    }
  }
  // všechny soubory v úložišti (rekurzivně po složkách)
  const cesty: string[] = [];
  const projdi = async (slozka: string) => {
    for (let od = 0; ; od += 1000) {
      const { data } = await sb.storage.from("soubory").list(slozka, { limit: 1000, offset: od });
      if (!data?.length) break;
      for (const f of data) { const c = slozka ? `${slozka}/${f.name}` : f.name; if (f.id) cesty.push(c); else await projdi(c); }
      if (data.length < 1000) break;
    }
  };
  await projdi("");
  return new Response(JSON.stringify({ vytvoreno: new Date().toISOString(), tabulky, soubory: cesty }), { headers: { "content-type": "application/json" } });
});
