/* Sestaví aplikaci do složky dist/ (to nahrává Cloudflare Pages): aplikace + šablony dokladů + knihovny. */
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const DIST = path.join(__dirname, "dist");
fs.rmSync(DIST, { recursive: true, force: true });
const kopiruj = (z, kam, filtr = () => true) => {
  for (const f of fs.readdirSync(z, { withFileTypes: true })) {
    const a = path.join(z, f.name), b = path.join(kam, f.name);
    if (!filtr(a)) continue;
    if (f.isDirectory()) { fs.mkdirSync(b, { recursive: true }); kopiruj(a, b, filtr); }
    else { fs.mkdirSync(kam, { recursive: true }); fs.copyFileSync(a, b); }
  }
};
kopiruj(path.join(__dirname, "aplikace"), DIST);
// šablony – nikdy ne soubor s podpisem (ten je v databázi)
kopiruj(path.join(__dirname, "dokumenty/sablony"), path.join(DIST, "sablony"), f => !/podpis[^/]*\.png$/i.test(f));
const vendor = path.join(DIST, "vendor"); fs.mkdirSync(vendor, { recursive: true });
for (const [z, n] of [
  ["node_modules/@supabase/supabase-js/dist/umd/supabase.js", "supabase.js"],
  ["node_modules/pdf-lib/dist/pdf-lib.min.js", "pdf-lib.min.js"],
  ["node_modules/@pdf-lib/fontkit/dist/fontkit.umd.min.js", "fontkit.umd.min.js"],
  // čtení PDF faktur dodavatelů při importu dílů (načte se až při prvním PDF)
  ["node_modules/pdfjs-dist/legacy/build/pdf.min.js", "pdf.min.js"],
  ["node_modules/pdfjs-dist/legacy/build/pdf.worker.min.js", "pdf.worker.min.js"]
]) fs.copyFileSync(path.join(__dirname, z), path.join(vendor, n));
let verze = new Date().toISOString();
try { verze = execSync("git rev-parse --short HEAD", { cwd: __dirname }).toString().trim() + "-" + Date.now(); } catch (e) { /* bez gitu */ }
const sw = path.join(DIST, "sw.js");
fs.writeFileSync(sw, fs.readFileSync(sw, "utf8").replace("__VERZE__", "werkplaats-" + verze));
// každé nasazení = nové adresy skriptů a stylů → iPad/iPhone nikdy nepoužije starou verzi z mezipaměti
const ix = path.join(DIST, "index.html"), v = encodeURIComponent(verze);
fs.writeFileSync(ix, fs.readFileSync(ix, "utf8").replace(/(src|href)="((?:vendor\/)?[\w.-]+\.(?:js|css))"/g, `$1="$2?v=${v}"`));
console.log("Hotovo: dist/ (verze " + verze + ")");
