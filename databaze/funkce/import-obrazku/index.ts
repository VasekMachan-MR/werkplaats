// Jednorázový import obrázků z Apple Poznámek do „Ostatních dokumentů“ zakázek (Vašek 30.10.2026). Po importu se vypne (410).
// Pustí jen s klíčem zálohy (v kódu jen otisk). Tělo: { zakazka_id, nazev, mime, data (base64) }. Stejný název u téže zakázky se nenahraje podruhé.
import { createClient } from "jsr:@supabase/supabase-js@2";
const OTISK = "81f89862ecb5b10711c83ca2d0d2c64e407a8aa6de7db077389e97cb504ccbad";
const MIME: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic" };
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
const odp = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
Deno.serve(async req => {
  if (hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(req.headers.get("x-zaloha") || ""))) !== OTISK) return odp(403, { chyba: "zakázáno" });
  const { zakazka_id, nazev, mime, data } = await req.json().catch(() => ({}));
  if (!zakazka_id || !nazev || !MIME[mime] || !data) return odp(400, { chyba: "chybí údaje" });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: z } = await sb.from("zakazky").select("id,cislo,vozidlo_id").eq("id", zakazka_id).single();
  if (!z) return odp(404, { chyba: "zakázka nenalezena" });
  const { data: uz } = await sb.from("soubory").select("id").eq("zakazka_id", z.id).eq("druh", "archiv").eq("nazev", nazev).is("smazano", null);
  if (uz?.length) return odp(200, { preskoceno: nazev });
  const bin = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  const klic = `archiv/${z.cislo}/${crypto.randomUUID()}.${MIME[mime]}`;
  const { error: eu } = await sb.storage.from("soubory").upload(klic, bin, { contentType: mime, upsert: false, cacheControl: "31536000" });
  if (eu) return odp(500, { chyba: eu.message });
  const { error: ei } = await sb.from("soubory").insert({ zakazka_id: z.id, vozidlo_id: z.vozidlo_id, druh: "archiv", klic, nazev, velikost: bin.length, mime, verejne: false });
  if (ei) { await sb.storage.from("soubory").remove([klic]); return odp(500, { chyba: ei.message }); }
  return odp(200, { nahrano: nazev, klic });
});
