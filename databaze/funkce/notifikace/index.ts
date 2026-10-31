// Notifikace na telefon (Web Push) – Vašek 31.10.2026: „chci vědět, když zákazník podepíše dokument“.
// GET                      → veřejný klíč VAPID pro aplikaci (při prvním volání se vytvoří; soukromý klíč zůstává jen v databázi)
// POST {test:true}         → zkušební notifikace na zařízení přihlášeného uživatele (Werkplaats, tlačítko „Poslat zkušební“)
// POST {udalost:"podpis"}  → jen interně z E-servisky (hlavička x-werk-interni): notifikace všem zařízením, kde je zapnutá
import { createClient } from "jsr:@supabase/supabase-js@2";
import { novyVapid, posli } from "./webpush.ts";

const POVOLENE = [/^https:\/\/werk\.mercedesrestorations\.cz$/, /^https:\/\/werkplaats\.pages\.dev$/, /^https:\/\/[\w-]+\.werkplaats\.pages\.dev$/];
const DRUHY: Record<string, [string, string]> = {
  zakazkovy_list: ["✍️ Podepsaný zakázkový list", "Zakázkový list"],
  nabidka: ["✅ Odsouhlasená cenová nabídka", "Cenová nabídka"],
  zalohova: ["✍️ Podepsaná zálohová faktura", "Zálohová faktura"],
  faktura: ["✍️ Podepsaná faktura", "Faktura"],
  predavaci_protokol: ["✍️ Podepsaný předávací protokol", "Předávací protokol"],
  archiv: ["✍️ Podepsaný původní zakázkový list", "Původní zakázkový list"]
};

function hlavicky(origin: string | null) {
  const h: Record<string, string> = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "vary": "Origin" };
  if (origin && POVOLENE.some(r => r.test(origin))) { h["access-control-allow-origin"] = origin; h["access-control-allow-methods"] = "GET, POST, OPTIONS"; h["access-control-allow-headers"] = "authorization, content-type, apikey, x-client-info"; }
  return h;
}

async function klice(sb: any) {
  const { data } = await sb.from("push_vapid").select("verejny,soukromy").eq("id", 1).maybeSingle();
  if (data) return data;
  const n = await novyVapid();
  await sb.from("push_vapid").insert({ id: 1, verejny: n.verejny, soukromy: n.soukromy });   // dva souběžné první požadavky: vyhraje jeden, oba si pak přečtou totéž
  const { data: d2 } = await sb.from("push_vapid").select("verejny,soukromy").eq("id", 1).single();
  return d2;
}

async function rozeslat(sb: any, odbery: any[], zprava: unknown) {
  const vapid = await klice(sb);
  let doruceno = 0;
  await Promise.all(odbery.map(async o => {
    try {
      const st = await posli(o, zprava, vapid);
      if (st === 404 || st === 410) await sb.from("push_odbery").delete().eq("id", o.id);   // zařízení notifikace vypnulo / aplikaci smazalo
      else if (st >= 200 && st < 300) { doruceno++; await sb.from("push_odbery").update({ naposledy: new Date().toISOString() }).eq("id", o.id); }
      else console.error("push", st, o.endpoint.slice(0, 40));
    } catch (e) { console.error("push chyba", String(e)); }
  }));
  return doruceno;
}

Deno.serve(async req => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: hlavicky(origin) });
  const odp = (s: number, o: unknown) => new Response(JSON.stringify(o), { status: s, headers: hlavicky(origin) });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  if (req.method === "GET") return odp(200, { verejny: (await klice(sb)).verejny });
  if (req.method !== "POST") return odp(405, { chyba: "jen GET/POST" });
  let b: any; try { b = await req.json(); } catch { return odp(400, { chyba: "spatny-pozadavek" }); }

  // interně z E-servisky: zákazník podepsal / odsouhlasil
  if (req.headers.get("x-werk-interni") === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    if (b?.udalost !== "podpis") return odp(400, { chyba: "neznama-udalost" });
    const { data: z } = await sb.from("zakazky").select("id,cislo,vozidla(typ,model,spz),zakaznici(jmeno)").eq("id", String(b.zakazka_id || "")).maybeSingle();
    if (!z) return odp(404, { chyba: "nenalezeno" });
    const [titulek, nazev] = DRUHY[b.druh] || ["✍️ Podpis v E-servisce", "Doklad"];
    const auto = [z.vozidla?.model, z.vozidla?.spz].filter(Boolean).join(" · ");
    const text = `${nazev}${b.cislo ? " " + b.cislo : ""} – ${z.zakaznici?.jmeno || "zákazník"}${auto ? "\n" + auto : ""}`;
    const { data: odbery } = await sb.from("push_odbery").select("id,endpoint,p256dh,auth,uzivatele!inner(aktivni)").eq("uzivatele.aktivni", true);
    const n = await rozeslat(sb, odbery || [], { titulek, text, url: `/#/zakazka/${z.id}`, tag: `podpis-${b.druh}-${b.cislo || z.cislo}` });
    return odp(200, { ok: true, doruceno: n });
  }

  // zkušební notifikace pro přihlášeného člena dílny
  if (b?.test) {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await sb.auth.getUser(token);
    if (!u?.user) return odp(401, { chyba: "neprihlasen" });
    const { data: odbery } = await sb.from("push_odbery").select("id,endpoint,p256dh,auth").eq("uzivatel_id", u.user.id);
    if (!odbery?.length) return odp(404, { chyba: "zadne-zarizeni" });
    const n = await rozeslat(sb, odbery, { titulek: "🔔 Upozornění fungují", text: "Takhle se ozve, až zákazník v E-servisce podepíše doklad.", url: "/#/ucet", tag: "test" });
    return odp(200, { ok: true, doruceno: n });
  }
  return odp(400, { chyba: "spatny-pozadavek" });
});
