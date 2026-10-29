// Kurz EUR podle ČNB (denní kurz devizového trhu) pro přepočet dílů nakoupených v eurech. Jen pro přihlášené (verify_jwt).
const POVOLENE = [/^https:\/\/werk\.mercedesrestorations\.cz$/, /^https:\/\/([\w-]+\.)?werkplaats\.pages\.dev$/, /^http:\/\/localhost(:\d+)?$/];
let mezipamet: { kurz: number; datum: string; cas: number } | null = null;

Deno.serve(async req => {
  const origin = req.headers.get("origin");
  const h: Record<string, string> = { "content-type": "application/json; charset=utf-8", "vary": "Origin" };
  if (origin && POVOLENE.some(r => r.test(origin))) {
    h["access-control-allow-origin"] = origin; h["access-control-allow-methods"] = "GET, POST, OPTIONS";
    h["access-control-allow-headers"] = "authorization, x-client-info, apikey, content-type";
  }
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  try {
    if (!mezipamet || Date.now() - mezipamet.cas > 3 * 3600 * 1000) {
      const r = await fetch("https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt");
      if (!r.ok) throw new Error("ČNB " + r.status);
      const t = await r.text();
      const datum = (t.match(/^(\d{2}\.\d{2}\.\d{4})/) || [])[1] || "";
      const radek = t.split("\n").find(l => l.split("|")[3] === "EUR");
      if (!radek) throw new Error("EUR v kurzovním lístku chybí");
      const [, , mnozstvi, , kurz] = radek.split("|");
      mezipamet = { kurz: Number(kurz.replace(",", ".")) / Number(mnozstvi), datum, cas: Date.now() };
    }
    return new Response(JSON.stringify({ kurz: mezipamet.kurz, datum: mezipamet.datum }), { headers: h });
  } catch (e) {
    return new Response(JSON.stringify({ chyba: String((e as Error).message || e) }), { status: 502, headers: h });
  }
});
