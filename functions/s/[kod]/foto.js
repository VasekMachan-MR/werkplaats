// Obrázek do náhledu odkazu: první profilová fotka auta (1200×630, zmenšená v Supabase), jinak logo Mercedes Restorations.
const API = "https://yokbljdjcvwbadbcwmgx.supabase.co/functions/v1/eserviska";
const LOGO = "https://cdn.prod.website-files.com/6606988ce196c11b806596eb/6ae092f53e922b99a5002c5c_mr-logo-og.png";
export async function onRequestGet({ params }) {
  const kod = String(params.kod || "").replace(/[^0-9a-zA-Z_-]/g, "");
  let zdroj = LOGO;
  if (kod.length >= 16 && kod.length <= 40) {
    try { const r = await fetch(`${API}?jen=nahled&k=${encodeURIComponent(kod)}`); if (r.ok) zdroj = (await r.json()).foto || LOGO; } catch (e) { /* logo */ }
  }
  const f = await fetch(zdroj);
  if (!f.ok) return Response.redirect(LOGO, 302);
  return new Response(f.body, { headers: { "content-type": f.headers.get("content-type") || "image/jpeg", "cache-control": "public, max-age=86400", "x-robots-tag": "noindex" } });
}
