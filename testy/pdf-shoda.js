/* Kontrola: PDF vytvořené v prohlížeči (do-pdf.js, jako na iPadu) musí vypadat stejně jako PDF z Chromia (ověřené 1:1 s originály). */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const VYSTUP = process.argv[2] || 'testy/vystup';
fs.mkdirSync(VYSTUP, { recursive: true });
const sablony = path.resolve('dokumenty/sablony');
const pripady = fs.readdirSync('dokumenty/testovaci-data').filter(f => f.endsWith('.json')).map(f => ({
  jmeno: f.replace('.json', ''),
  sablona: /^(faktura|nabidka)/.test(f) ? 'faktura.html' : /^parts-list/.test(f) ? 'parts-list.html' : 'zakazkovy-list.html',
  jazyk: /-en/.test(f) ? 'en' : 'cs',
  data: JSON.parse(fs.readFileSync(path.join('dokumenty/testovaci-data', f)))
}));
// zkušební podpisy (smyšlené)
const podpisZak = 'data:image/png;base64,' + fs.readFileSync('testy/podpis-test.png').toString('base64');
// malý místní server (fetch nefunguje přes file://)
const http = require('http');
const TYPY = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.jpg': 'image/jpeg' };
const KOREN = path.resolve('.');
const server = http.createServer((q, r) => {
  const f = path.join(KOREN, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(KOREN) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPY[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
(async () => {
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  const URL0 = `http://127.0.0.1:${server.address().port}/dokumenty/sablony/`;
  const b = await chromium.launch(); let chyba = false;
  for (const c of pripady) {
    const d = { ...c.data, podpisZakaznik: podpisZak, podpisVyhotovil: fs.existsSync(path.join(sablony, 'assets/podpis.png')) ? true : undefined };
    const p = await b.newPage();
    await p.goto(URL0 + c.sablona);
    for (const s of ['../../node_modules/pdf-lib/dist/pdf-lib.min.js', '../../node_modules/@pdf-lib/fontkit/dist/fontkit.umd.min.js', 'do-pdf.js'])
      await p.addScriptTag({ url: URL0 + s });
    await p.evaluate(async ([d, l]) => { await window.render(d, l); }, [d, c.jazyk]);
    const ref = path.join(VYSTUP, `${c.jmeno}-chromium.pdf`), nove = path.join(VYSTUP, `${c.jmeno}-ipad.pdf`);
    await p.pdf({ path: ref, printBackground: true, preferCSSPageSize: true });
    const bytes = await p.evaluate(async () => Array.from(await window.dokumentDoPdf(document)));
    fs.writeFileSync(nove, Buffer.from(bytes));
    await p.close();

    const out = execFileSync('python3', ['testy/porovnej.py', ref, nove]).toString().trim();
    console.log(c.jmeno.padEnd(12), (fs.statSync(nove).size / 1024).toFixed(0).padStart(5) + ' kB', out);
    if (/ROZDÍL/.test(out)) chyba = true;
  }
  await b.close(); server.close(); process.exit(chyba ? 1 : 0);
})();
