// D1: smazání souborů z úložiště spolu se záznamem (fotky, archiv, PDF dokladů, podpisy). Jen pro majitele.
// Smaže jen soubory, na které už neodkazuje žádný záznam v tabulce soubory (nic živého tím nejde smazat).
//  { klice: [...] }   – konkrétní soubory (např. smazaná fotka)
//  { slozky: [...] }  – celé složky vystavení dokladu (zakazky/7377/xxxx/)
//  { uklid: true }    – osiřelé soubory dokladů a archivu starší než 1 hodina
import { createClient } from "jsr:@supabase/supabase-js@2";

const POVOLENE = [/^https:\/\/werk\.mercedesrestorations\.cz$/, /^https:\/\/([\w-]+\.)?werkplaats\.pages\.dev$/, /^http:\/\/localhost(:\d+)?$/];

Deno.serve(async req => {
  const origin = req.headers.get("origin");
  const h: Record<string, string> = { "content-type": "application/json; charset=utf-8", "vary": "Origin" };
  if (origin && POVOLENE.some(r => r.test(origin))) {
    h["access-control-allow-origin"] = origin; h["access-control-allow-methods"] = "POST, OPTIONS";
    h["access-control-allow-headers"] = "authorization, x-client-info, apikey, content-type";
  }
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  const odp = (s: number, o: unknown) => new Response(JSON.stringify(o), { status: s, headers: h });
  if (req.method !== "POST") return odp(405, { chyba: "jen POST" });

  const url = Deno.env.get("SUPABASE_URL")!, sluzba = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await sluzba.auth.getUser(token);
  if (!u?.user) return odp(401, { chyba: "nepřihlášen" });
  const { data: clen } = await sluzba.from("uzivatele").select("role,aktivni").eq("id", u.user.id).maybeSingle();
  if (!clen || !clen.aktivni || clen.role !== "majitel") return odp(403, { chyba: "jen majitel" });

  let telo: { klice?: string[]; slozky?: string[]; uklid?: boolean } = {};
  try { telo = await req.json(); } catch { /* prázdné tělo */ }
  const kandidati = new Set<string>((telo.klice || []).filter(k => typeof k === "string" && k.length > 3 && !k.includes("..")));
  for (const sl of (telo.slozky || []).filter(s => /^zakazky\/\d+\/[\w-]+\/?$/.test(s))) {
    const prefix = sl.replace(/\/?$/, "/");
    const { data } = await sluzba.storage.from("soubory").list(prefix.slice(0, -1), { limit: 100 });
    (data || []).forEach(o => o.name && kandidati.add(prefix + o.name));
  }
  if (telo.uklid) {
    const { data } = await sluzba.rpc("osirele_soubory", { p_prefixy: ["zakazky/", "archiv/"], p_starsi_nez: "1 hour" });
    (data || []).forEach((r: { klic: string }) => kandidati.add(r.klic));
  }
  if (!kandidati.size) return odp(200, { smazano: 0 });
  // nikdy nesmazat soubor, na který ještě něco odkazuje
  const { data: zive } = await sluzba.from("soubory").select("klic").in("klic", [...kandidati]);
  (zive || []).forEach(r => kandidati.delete(r.klic));
  if (!kandidati.size) return odp(200, { smazano: 0 });
  const { data: pryc, error } = await sluzba.storage.from("soubory").remove([...kandidati]);
  if (error) return odp(500, { chyba: error.message });
  return odp(200, { smazano: (pryc || []).length });
});
