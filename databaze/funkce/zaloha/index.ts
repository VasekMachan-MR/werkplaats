// Záloha dat (Vašek 30.10.2026): všechny tabulky + seznam souborů v úložišti (fotky a PDF se zrcadlí zvlášť do Cloudflare R2).
// Denní záloha (2:00): pustí jen s klíčem zálohy. V kódu je jen jeho otisk SHA-256, samotný klíč je v souboru
// .klic-zalohy ve složce iCloud „Mercedes Restorations/Zálohy Werkplaats“ (kde jsou i zálohy samotné).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";
// noční záloha na GitHubu se prokáže tokenem GitHub OIDC – bez sdíleného hesla (jen tento repozitář, větev main, workflow zaloha.yml)
const GH_JWKS = createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));
const zGitHubu = async (t: string) => {
  try {
    const { payload: p } = await jwtVerify(t, GH_JWKS, { issuer: "https://token.actions.githubusercontent.com", audience: "werkplaats-zaloha" });
    return p.repository === "VasekMachan-MR/werkplaats" && p.ref === "refs/heads/main"
      && String(p.workflow_ref || "").startsWith("VasekMachan-MR/werkplaats/.github/workflows/zaloha.yml@");
  } catch { return false; }
};
const OTISK = "81f89862ecb5b10711c83ca2d0d2c64e407a8aa6de7db077389e97cb504ccbad";
const TABULKY = ["ciselne_rady","dalkove_podpisy","dily","dodavatele","doklady","emaily","kalendar","katalog_modely","katalog_motorizace","katalog_rady","katalog_vozu",
  "motory","nabidky","nakupni_doklady","nastaveni","podpisy","polozky","postupy","sazby","servisni_intervaly","servisni_intervaly_motoru","servisni_plan",
  "servisni_ukony","soubory","typy_motoru","uzivatele","vlastnictvi","vozidla","zakazky","zakaznici","koncepty_prijmu","sklad","sklad_pohyby","preklady"];
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
Deno.serve(async req => {
  const k = req.headers.get("x-zaloha") || "";
  const gh = req.headers.get("x-github-oidc") || "";
  const povoleno = gh ? await zGitHubu(gh) : hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(k))) === OTISK;
  if (!povoleno) return new Response("zakázáno", { status: 403 });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  // ?odkazy=1 → jen podepsané odkazy (1 h) na zadané soubory, pro zrcadlo fotek a PDF v Cloudflare R2
  if (new URL(req.url).searchParams.get("odkazy") === "1") {
    const cesty: string[] = ((await req.json().catch(() => ({}))).cesty || []).filter((c: unknown) => typeof c === "string").slice(0, 5000);
    const odkazy: Record<string, string> = {};
    for (let i = 0; i < cesty.length; i += 500) {
      const { data } = await sb.storage.from("soubory").createSignedUrls(cesty.slice(i, i + 500), 3600);
      (data || []).forEach(x => { if (x.path && x.signedUrl) odkazy[x.path] = x.signedUrl; });
    }
    return new Response(JSON.stringify({ odkazy }), { headers: { "content-type": "application/json" } });
  }
  const tabulky: Record<string, unknown> = {};
  for (const t of TABULKY) {
    const rows: unknown[] = [];
    for (let od = 0; ; od += 1000) {
      const { data, error } = await sb.from(t).select("*").range(od, od + 999);
      if (error) { tabulky[t] = { chyba: error.message }; break; }
      rows.push(...data); if (data.length < 1000) { tabulky[t] = rows; break; }
    }
  }
  // všechny soubory v úložišti (rekurzivně po složkách)
  const cesty: string[] = [];
  const projdi = async (slozka: string) => {
    for (let od = 0; ; od += 1000) {
      const { data } = await sb.storage.from("soubory").list(slozka, { limit: 1000, offset: od });
      if (!data?.length) break;
      for (const f of data) { const c = slozka ? `${slozka}/${f.name}` : f.name; if (f.id) cesty.push(c); else await projdi(c); }
      if (data.length < 1000) break;
    }
  };
  await projdi("");
  return new Response(JSON.stringify({ vytvoreno: new Date().toISOString(), tabulky, soubory: cesty }), { headers: { "content-type": "application/json" } });
});
