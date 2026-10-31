// Odkaz na E-servisku s náhledem v chatu (Vašek 31.10.2026): werk.mercedesrestorations.cz/s/<tajný kód>
// WhatsApp / iMessage / Messenger si načtou název auta a profilovou fotku (og:*), člověka stránka hned přesměruje do E-servisky.
// Nikde se neindexuje (X-Robots-Tag + meta robots); kód auta zůstává tajný jako dosud.
const API = "https://yokbljdjcvwbadbcwmgx.supabase.co/functions/v1/eserviska";
// roboti, kteří načítají náhled odkazu (WhatsApp, iMessage = facebookexternalhit/Twitterbot, Messenger, Telegram, Signal, Slack, Discord, LinkedIn, Viber, Skype…)
const ROBOT = /bot\b|bot\/|crawler|spider|facebookexternalhit|facebot|whatsapp|telegram|slack|discord|linkedin|skype|viber|signal|preview|embed|pinterest|vkshare|redditbot|google|bing|yandex|applebot|curl|wget/i;
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
  // člověk (prohlížeč) → rovnou přesměrovat, bez mezistránky (Vašek 31.10.2026: „na sekundu se objeví okno“); náhled dostanou jen roboti náhledů
  const ua = request.headers.get("user-agent") || "";
  if (!ROBOT.test(ua)) return new Response(null, { status: 302, headers: { location: cil, "x-robots-tag": "noindex, nofollow, noarchive", "cache-control": "no-store", "referrer-policy": "no-referrer" } });
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
<body style="margin:0;background:#fff"><noscript><p style="font-family:sans-serif;padding:20px"><a href="${esc(cil)}">${esc(titul)}</a></p></noscript></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex, nofollow, noarchive", "cache-control": "private, max-age=300", "referrer-policy": "no-referrer" } });
}
