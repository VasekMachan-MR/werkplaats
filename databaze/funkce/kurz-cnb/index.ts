// Kurzy ČNB (denní kurz devizového trhu) pro přepočet dílů nakoupených v cizí měně. Jen pro přihlášené (verify_jwt).
// Vrací { kurz (EUR – kvůli starším verzím aplikace), datum, kurzy: { KÓD: Kč za 1 jednotku } }.
const POVOLENE = [/^https:\/\/werk\.mercedesrestorations\.cz$/, /^https:\/\/([\w-]+\.)?werkplaats\.pages\.dev$/, /^http:\/\/localhost(:\d+)?$/];
let mezipamet: { kurz: number; datum: string; kurzy: Record<string, number>; cas: number } | null = null;

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
      const kurzy: Record<string, number> = {};
      for (const l of t.split("\n").slice(2)) {
        const [, , mnozstvi, kod, kurz] = l.trim().split("|");
        const k = Number(String(kurz || "").replace(",", ".")) / Number(mnozstvi);
        if (/^[A-Z]{3}$/.test(kod || "") && Number.isFinite(k) && k > 0) kurzy[kod] = k;
      }
      if (!kurzy.EUR) throw new Error("EUR v kurzovním lístku chybí");
      mezipamet = { kurz: kurzy.EUR, datum, kurzy, cas: Date.now() };
    }
    return new Response(JSON.stringify({ kurz: mezipamet.kurz, datum: mezipamet.datum, kurzy: mezipamet.kurzy }), { headers: h });
  } catch (e) {
    return new Response(JSON.stringify({ chyba: String((e as Error).message || e) }), { status: 502, headers: h });
  }
});
