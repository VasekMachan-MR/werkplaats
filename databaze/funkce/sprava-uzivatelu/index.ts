// Werkplaats – správa uživatelů dílny (jen pro majitele).
// Přidání mechanika (e-mail + dočasné heslo), nové heslo, zablokování / odblokování, změna role.
// Běží na serveru Supabase (Edge Function) – jen tady je tajný klíč, který smí zakládat účty.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const POVOLENE_ADRESY = [
  /^https:\/\/werk\.mercedesrestorations\.cz$/,
  /^https:\/\/([a-z0-9-]+\.)?werkplaats\.pages\.dev$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];

function hlavicky(origin: string) {
  const ok = POVOLENE_ADRESY.some((r) => r.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin : "https://werk.mercedesrestorations.cz",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function tajnyKlic(): string {
  try {
    const k = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    if (k.default) return k.default;
  } catch (_) { /* starší projekt */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

Deno.serve(async (req) => {
  const h = hlavicky(req.headers.get("Origin") ?? "");
  const odpoved = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: h });
  if (req.method === "OPTIONS") return new Response(null, { headers: h });
  if (req.method !== "POST") return odpoved({ chyba: "Povolený je jen POST" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, tajnyKlic(), { auth: { persistSession: false, autoRefreshToken: false } });

  // kdo volá? jen přihlášený aktivní majitel
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: kdo } = await admin.auth.getUser(token);
  if (!kdo?.user) return odpoved({ chyba: "Nepřihlášený uživatel" }, 401);
  const { data: ja } = await admin.from("uzivatele").select("id, role, aktivni").eq("id", kdo.user.id).maybeSingle();
  if (!ja || ja.role !== "majitel" || !ja.aktivni) return odpoved({ chyba: "Tohle smí jen majitel" }, 403);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch (_) { return odpoved({ chyba: "Neplatný požadavek" }, 400); }
  const akce = String(b.akce ?? "");
  const id = String(b.id ?? "");
  const heslo = String(b.heslo ?? "");
  const role = String(b.role ?? "mechanik");
  if (heslo && heslo.length < 10) return odpoved({ chyba: "Heslo musí mít aspoň 10 znaků" }, 400);
  if (b.role !== undefined && !["majitel", "mechanik"].includes(role)) return odpoved({ chyba: "Neznámá role" }, 400);

  if (akce === "pridat") {
    const email = String(b.email ?? "").trim().toLowerCase();
    const jmeno = String(b.jmeno ?? "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return odpoved({ chyba: "Neplatný e-mail" }, 400);
    if (jmeno.length < 2) return odpoved({ chyba: "Vyplňte jméno" }, 400);
    if (!heslo) return odpoved({ chyba: "Vyplňte dočasné heslo" }, 400);
    const { data: novy, error } = await admin.auth.admin.createUser({ email, password: heslo, email_confirm: true, user_metadata: { jmeno } });
    if (error || !novy.user) {
      const m = /already|registered|exists/i.test(error?.message ?? "") ? "Účet s tímto e-mailem už existuje" : (error?.message ?? "Účet se nepodařilo založit");
      return odpoved({ chyba: m }, 400);
    }
    const { error: e2 } = await admin.from("uzivatele").insert({ id: novy.user.id, jmeno, role, email });
    if (e2) { await admin.auth.admin.deleteUser(novy.user.id); return odpoved({ chyba: e2.message }, 400); }
    return odpoved({ ok: true, id: novy.user.id });
  }

  if (!/^[0-9a-f-]{36}$/.test(id)) return odpoved({ chyba: "Chybí uživatel" }, 400);
  if (id === ja.id && akce !== "heslo") return odpoved({ chyba: "Sám sobě roli ani přístup měnit nejde" }, 400);

  if (akce === "heslo") {
    if (!heslo) return odpoved({ chyba: "Vyplňte nové heslo" }, 400);
    const { error } = await admin.auth.admin.updateUserById(id, { password: heslo });
    return error ? odpoved({ chyba: error.message }, 400) : odpoved({ ok: true });
  }
  if (akce === "aktivni") {
    const aktivni = b.aktivni === true;
    const { error } = await admin.from("uzivatele").update({ aktivni }).eq("id", id);
    if (error) return odpoved({ chyba: error.message }, 400);
    await admin.auth.admin.updateUserById(id, { ban_duration: aktivni ? "none" : "876000h" });   // zablokovaný se nepřihlásí
    return odpoved({ ok: true });
  }
  if (akce === "role") {
    const { error } = await admin.from("uzivatele").update({ role }).eq("id", id);
    return error ? odpoved({ chyba: error.message }, 400) : odpoved({ ok: true });
  }
  return odpoved({ chyba: "Neznámá akce" }, 400);
});
