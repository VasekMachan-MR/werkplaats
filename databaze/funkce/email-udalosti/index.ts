// Zpětná vazba od Resend (webhook): doručeno / nedoručeno / označeno jako spam → stav v tabulce emaily.
// Když e-mail zákazníkovi nedorazí (zakázkový list, list k podpisu, cenová nabídka), přijde upozornění na info@mercedesrest.cz (Vašek 31.10.2026: „potřebuji feedback, kdyby e-mail nedorazil“).
// verify_jwt = false – pravost zprávy se ověřuje podpisem Svix (Secrets: RESEND_WEBHOOK_SECRET „whsec_…“).
import { createClient } from "jsr:@supabase/supabase-js@2";

const FIRMA = "info@mercedesrest.cz";
const STAVY: Record<string, string> = { "email.delivered": "doruceno", "email.bounced": "nedoruceno", "email.complained": "spam", "email.failed": "nedoruceno", "email.delivery_delayed": "zpozdeno" };

async function overPodpis(req: Request, telo: string): Promise<boolean> {
  const tajne = Deno.env.get("RESEND_WEBHOOK_SECRET") || "";
  const id = req.headers.get("svix-id"), cas = req.headers.get("svix-timestamp"), pod = req.headers.get("svix-signature");
  if (!tajne || !id || !cas || !pod) return false;
  if (Math.abs(Date.now() / 1000 - Number(cas)) > 600) return false;          // starší než 10 minut → odmítnout (opakované přehrání)
  const klic = Uint8Array.from(atob(tajne.replace(/^whsec_/, "")), c => c.charCodeAt(0));
  const k = await crypto.subtle.importKey("raw", klic, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${id}.${cas}.${telo}`)));
  const ocekavany = btoa(String.fromCharCode(...sig));
  return pod.split(" ").some(p => p.split(",")[1] === ocekavany);
}

// chyba → notifikace majiteli na telefon (Vašek 31.10.2026: „hlídání chyb“) – na pozadí, nikdy nic nezastaví
function hlasitChybu(titulek: string, text: string, zakazka_id?: string | null) {
  const p = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notifikace`, {
    method: "POST", headers: { "content-type": "application/json", "x-werk-interni": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! },
    body: JSON.stringify({ udalost: "chyba", titulek, text: String(text).slice(0, 300), zakazka_id: zakazka_id || null })
  }).catch(() => {});
  // @ts-ignore EdgeRuntime existuje jen v Supabase
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(p);
}
Deno.serve(async req => {
  if (req.method !== "POST") return new Response("jen POST", { status: 405 });
  const telo = await req.text();
  if (!(await overPodpis(req, telo))) return new Response("neplatny podpis", { status: 401 });
  let u: any; try { u = JSON.parse(telo); } catch { return new Response("spatny json", { status: 400 }); }
  const stav = STAVY[u?.type]; const zid = u?.data?.email_id;
  if (!stav || !zid) return new Response("ok");                                   // ostatní události (odesláno, otevřeno…) nás nezajímají
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: e } = await sb.from("emaily").select("id,stav,komu,predmet,zakazka_id,doklady(cislo),zakazky(cislo)").eq("zprava_id", zid).maybeSingle();
  if (!e) return new Response("ok");
  if (e.stav === "nedoruceno" || e.stav === "spam" || (e.stav === "doruceno" && stav === "zpozdeno")) return new Response("ok");   // horší stav nepřepisovat
  const chyba = stav === "nedoruceno" ? String(u?.data?.bounce?.message || u?.data?.bounce?.subType || "e-mail se nepodařilo doručit").slice(0, 500)
    : stav === "spam" ? "zákazník označil e-mail jako spam" : null;
  await sb.from("emaily").update({ stav, chyba, zmeneno: new Date().toISOString() }).eq("id", e.id);
  if (stav === "nedoruceno" || stav === "spam") hlasitChybu(stav === "spam" ? "⚠️ Zákazník označil e-mail jako spam" : "⚠️ E-mail zákazníkovi nedošel",
    `${e.predmet || "E-mail"} → ${e.komu}${chyba ? ": " + chyba : ""}`, (e as any).zakazka_id);

  if (stav === "nedoruceno" && Deno.env.get("RESEND_API_KEY")) {
    const zak = e.zakazky?.cislo ? `zakázka ${e.zakazky.cislo}` : "zakázka";
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "content-type": "application/json", "idempotency-key": `nedoruceno-${e.id}` },
      body: JSON.stringify({ from: "Werkplaats <info@mercedesrest.cz>", to: [FIRMA],
        subject: `⚠️ E-mail zákazníkovi nedorazil – ${zak}`,
        text: `Dobrý den,\n\ne-mail „${e.predmet || "doklad " + (e.doklady?.cislo || "")}“ se nepodařilo doručit na adresu ${e.komu}.\n\nDůvod: ${chyba}\n\nZkontrolujte prosím e-mail zákazníka ve Werkplaats a pošlete doklad znovu (v detailu zakázky „Poslat znovu“).\n\nWerkplaats` })
    }).catch(() => {});
  }
  return new Response("ok");
});
