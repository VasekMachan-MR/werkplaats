// Odkaz na E-servisku s náhledem v chatu (Vašek 31.10.2026): werk.mercedesrestorations.cz/s/<tajný kód>
// WhatsApp / iMessage / Messenger si načtou název auta a profilovou fotku (og:*), člověka stránka hned přesměruje do E-servisky.
// Nikde se neindexuje (X-Robots-Tag + meta robots); kód auta zůstává tajný jako dosud.
const API = "https://yokbljdjcvwbadbcwmgx.supabase.co/functions/v1/eserviska";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TEXTY = {
  cs: { titul: n => `E-serviska – Mercedes-Benz ${n}`, popis: "Servisní knížka vašeho vozu u Mercedes Restorations: historie servisu, fotky, doklady a co je příště na řadě.", jdu: "Otevírám E-servisku…" },
  en: { titul: n => `E-service book – Mercedes-Benz ${n}`, popis: "The service book of your car at Mercedes Restorations: service history, photos, documents and what is due next.", jdu: "Opening the e-service book…" },
  nl: { titul: n => `E-serviceboekje – Mercedes-Benz ${n}`, popis: "Het serviceboekje van uw auto bij Mercedes Restorations: onderhoudshistorie, foto's, documenten en wat er hierna moet gebeuren.", jdu: "E-serviceboekje wordt geopend…" }
};
export async function onRequestGet({ params, request }) {
  const kod = String(params.kod || "").replace(/[^0-9a-zA-Z_-]/g, "");
  const url = new URL(request.url), lang = TEXTY[url.searchParams.get("l")] ? url.searchParams.get("l") : "cs", t = TEXTY[lang];
  const cil = "https://www.mercedesrestorations.cz/e-serviska?k=" + encodeURIComponent(kod) + (lang !== "cs" ? "&lang=" + lang : "");
  let nazev = "";
  if (kod.length >= 16 && kod.length <= 40) {
    try { const r = await fetch(`${API}?jen=nahled&k=${encodeURIComponent(kod)}`, { cf: { cacheTtl: 300 } }); if (r.ok) nazev = (await r.json()).nazev || ""; } catch (e) { /* bez názvu */ }
  }
  const titul = nazev ? t.titul(nazev) : "E-serviska – Mercedes Restorations", obr = `${url.origin}/s/${kod}/foto`;
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titul)}</title><meta name="robots" content="noindex, nofollow, noarchive">
<meta property="og:type" content="website"><meta property="og:site_name" content="Mercedes Restorations">
<meta property="og:title" content="${esc(titul)}"><meta property="og:description" content="${esc(t.popis)}">
<meta property="og:image" content="${esc(obr)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="${esc(url.origin + url.pathname)}"><meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${esc(cil)}"><link rel="canonical" href="${esc(cil)}"></head>
<body style="font-family:-apple-system,system-ui,sans-serif;padding:40px 20px;color:#092b50"><p>${esc(t.jdu)} <a href="${esc(cil)}">${esc(titul)}</a></p></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex, nofollow, noarchive", "cache-control": "private, max-age=300", "referrer-policy": "no-referrer" } });
}
