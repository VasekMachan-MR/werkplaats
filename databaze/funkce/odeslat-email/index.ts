// Automatický e-mail zákazníkovi po podpisu zakázkového listu (Vašek 31.10.2026).
// Příloha: podepsaný zakázkový list (PDF) + Všeobecné obchodní podmínky (https://werk.mercedesrestorations.cz/vop.pdf).
// Odesílá přes Resend z info@mercedesrest.cz, odpověď a skrytá kopie na info@mercedesrest.cz. Záznam o odeslání v tabulce emaily.
// Volá: aplikace (přihlášený člen dílny) hned po podpisu na iPadu, funkce eserviska po podpisu z domu (tajný klíč service role).
// POST { doklad_id } nebo { cislo }  →  { ok, komu, stav, chyba? }
// Nastavení (Supabase → Edge Functions → Secrets): RESEND_API_KEY. Bez něj se nic neodešle, jen se zapíše stav „chyba“.
import { createClient } from "jsr:@supabase/supabase-js@2";

const POVOLENE = [/^https:\/\/werk\.mercedesrestorations\.cz$/, /^https:\/\/([\w-]+\.)?werkplaats\.pages\.dev$/, /^http:\/\/localhost(:\d+)?$/];
const FIRMA = "info@mercedesrest.cz";
const OD = "Mercedes Restorations <info@mercedesrest.cz>";
const VOP_PDF = "https://werk.mercedesrestorations.cz/vop.pdf";
const PODPIS_FIRMY = "Mercedes Restorations s.r.o.\n+420 732 518 016\ninfo@mercedesrest.cz\nwww.mercedesrestorations.cz";   // každý údaj na vlastním řádku (Vašek 31.10.2026)

function hlavicky(origin: string | null) {
  const h: Record<string, string> = { "content-type": "application/json; charset=utf-8", "vary": "Origin" };
  if (origin && POVOLENE.some(r => r.test(origin))) {
    h["access-control-allow-origin"] = origin; h["access-control-allow-methods"] = "POST, OPTIONS";
    h["access-control-allow-headers"] = "authorization, x-client-info, apikey, content-type";
  }
  return h;
}
const b64 = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

// text e-mailu schválený Vaškem 31.10.2026 (CZ „my“, bez oslovení jménem; EN stejně)
function textEmailu(en: boolean, x: { cislo: string; model: string; spz: string; odkaz: string; jmeno: string }) {
  const auto = x.spz ? `${x.model} (${x.spz})` : x.model;
  if (en) return {
    predmet: `Work order ${x.cislo} – ${x.model} – Mercedes Restorations`,
    text: `Hello,\n\nthank you for your trust and for signing the work order for your ${auto}. Attached you will find work order no. ${x.cislo} and our General Terms and Conditions.\n\nYou can follow the work, see photos and the service history of your car in its E-serviska:\n${x.odkaz}\n\nWe will keep you updated by WhatsApp or e-mail. If you have any questions, we are happy to help.\n\nBest regards,\n\n${x.jmeno}\n${PODPIS_FIRMY}`
  };
  return {
    predmet: `Zakázkový list ${x.cislo} – ${x.model} – Mercedes Restorations`,
    text: `Dobrý den,\n\nděkujeme za důvěru a za podpis zakázkového listu k vašemu vozu ${auto}. V příloze zasíláme zakázkový list č. ${x.cislo} a Všeobecné obchodní podmínky.\n\nPrůběh prací, fotografie a historii servisu najdete v E-servisce vašeho vozu:\n${x.odkaz}\n\nO dalším postupu vás budeme informovat přes WhatsApp nebo e-mailem. Kdybyste měli jakýkoli dotaz, jsme k dispozici.\n\nS pozdravem,\n\n${x.jmeno}\n${PODPIS_FIRMY}`
  };
}
// odkaz do E-servisky jako výrazné tlačítko na vlastním řádku (Vašek 31.10.2026: modrý odkaz v textu byl špatně vidět)
const naHtml = (t: string, odkaz: string, en: boolean) => `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#092b50">` +
  t.split("\n\n").map(p => p.endsWith("\n" + odkaz)
    ? `<p style="margin:0 0 8px">${esc(p.slice(0, -odkaz.length - 1))}</p><p style="margin:0 0 18px"><a href="${esc(odkaz)}" style="display:inline-block;background:#092b50;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;padding:7px 14px">${en ? "Open E-serviska" : "Otevřít E-servisku"} &rarr;</a></p>`
    : `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br>")}</p>`).join("") + `</div>`;

Deno.serve(async req => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: hlavicky(origin) });
  const odp = (s: number, o: unknown) => new Response(JSON.stringify(o), { status: s, headers: hlavicky(origin) });
  if (req.method !== "POST") return odp(405, { chyba: "jen POST" });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // kdo volá: funkce eserviska (service role) nebo přihlášený aktivní člen dílny
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const interni = req.headers.get("x-werk-interni") === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!interni) {
    const { data: u } = await sb.auth.getUser(token);
    if (!u?.user) return odp(401, { chyba: "neprihlasen" });
    const { data: clen } = await sb.from("uzivatele").select("id,aktivni").eq("id", u.user.id).maybeSingle();
    if (!clen?.aktivni) return odp(403, { chyba: "nepovoleno" });
  }

  let b: any; try { b = await req.json(); } catch { return odp(400, { chyba: "spatny-pozadavek" }); }
  let q = sb.from("doklady").select("id,cislo,druh,jazyk,zamceno,zakazka_id,data,pdf_soubor_id,soubory!doklady_pdf_soubor_id_fkey(klic),podpisy(role,jmeno),dalkove_podpisy!dalkove_podpisy_doklad_id_fkey(id),zakazky!inner(id,cislo,zakaznici(email,jazyk),vozidla(model,typ,spz,vin,eserviska_kod))");
  q = b?.doklad_id ? q.eq("id", String(b.doklad_id)) : q.eq("cislo", String(b?.cislo || ""));
  const { data: d } = await q.maybeSingle();
  if (!d || d.druh !== "zakazkovy_list" || !d.zamceno) return odp(404, { chyba: "nenalezeno" });
  const podepsano = (d.podpisy || []).some((x: any) => x.role === "zakaznik") || (Array.isArray(d.dalkove_podpisy) ? d.dalkove_podpisy.length > 0 : !!d.dalkove_podpisy);
  if (!podepsano) return odp(409, { chyba: "nepodepsano" });

  const komu = String(d.zakazky?.zakaznici?.email || "").trim();
  const zapis = async (o: Record<string, unknown>) => {
    const { data: r } = await sb.from("emaily").insert({ doklad_id: d.id, zakazka_id: d.zakazka_id, komu: komu || "–", ucel: "zakazkovy_list", ...o, zmeneno: new Date().toISOString() }).select("id").single();
    return r?.id;
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(komu)) { await zapis({ stav: "chyba", chyba: "Zákazník nemá platný e-mail." }); return odp(200, { ok: false, stav: "chyba", chyba: "Zákazník nemá platný e-mail." }); }

  const en = (d.jazyk || d.zakazky?.zakaznici?.jazyk) === "en";
  const v = d.zakazky?.vozidla || {};
  const model = [v.typ, v.model].filter(Boolean).join(" ") || "Mercedes-Benz";
  const odkaz = v.eserviska_kod ? "https://www.mercedesrestorations.cz/e-serviska?k=" + encodeURIComponent(v.eserviska_kod)
    : "https://www.mercedesrestorations.cz/e-serviska?vin=" + encodeURIComponent(String(v.vin || "").toUpperCase().replace(/[^A-Z0-9]/g, ""));
  const jmeno = (d.podpisy || []).find((x: any) => x.role === "vyhotovil")?.jmeno || "Václav Macháň";
  const { predmet, text } = textEmailu(en, { cislo: d.cislo, model, spz: v.spz || "", odkaz, jmeno: en ? jmeno.normalize("NFD").replace(/[̀-ͯ]/g, "") : jmeno });

  const klic = Deno.env.get("RESEND_API_KEY");
  if (!klic) { await zapis({ predmet, stav: "chyba", chyba: "Odesílání e-mailů ještě není nastavené (chybí RESEND_API_KEY)." }); return odp(200, { ok: false, komu, stav: "chyba", chyba: "Odesílání e-mailů ještě není nastavené." }); }

  // přílohy
  const pril: { filename: string; content: string }[] = [];
  try {
    if (!d.soubory?.klic) throw new Error("PDF zakázkového listu chybí");
    const { data: pdf, error } = await sb.storage.from("soubory").download(d.soubory.klic);
    if (error || !pdf) throw new Error("PDF zakázkového listu se nepodařilo načíst");
    pril.push({ filename: `${en ? "Work_order" : "Zakazkovy_list"}_${d.cislo}.pdf`, content: b64(new Uint8Array(await pdf.arrayBuffer())) });
    const r = await fetch(VOP_PDF);
    if (!r.ok) throw new Error("PDF obchodních podmínek se nepodařilo načíst");
    pril.push({ filename: en ? "General_Terms_Mercedes_Restorations.pdf" : "VOP_Mercedes_Restorations.pdf", content: b64(new Uint8Array(await r.arrayBuffer())) });
  } catch (e) {
    const chyba = String((e as Error).message || e);
    await zapis({ predmet, stav: "chyba", chyba }); return odp(200, { ok: false, komu, stav: "chyba", chyba });
  }

  const id = await zapis({ predmet, stav: "odesilam" });
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "authorization": `Bearer ${klic}`, "content-type": "application/json", "idempotency-key": `zl-${d.id}-${id}` },
    body: JSON.stringify({ from: OD, to: [komu], bcc: [FIRMA], reply_to: FIRMA, subject: predmet, text, html: naHtml(text, odkaz, en), attachments: pril,
      tags: [{ name: "doklad", value: String(d.cislo).replace(/[^\w-]/g, "_") }] })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.id) {
    const chyba = `Odeslání se nepodařilo (${r.status}): ${j?.message || j?.name || "neznámá chyba"}`;
    await sb.from("emaily").update({ stav: "chyba", chyba, zmeneno: new Date().toISOString() }).eq("id", id);
    return odp(200, { ok: false, komu, stav: "chyba", chyba });
  }
  await sb.from("emaily").update({ stav: "odeslano", zprava_id: j.id, odeslano: new Date().toISOString(), zmeneno: new Date().toISOString() }).eq("id", id);
  return odp(200, { ok: true, komu, stav: "odeslano" });
});
