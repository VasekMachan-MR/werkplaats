const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [tpl, dataFile, out, lang = 'cs'] = process.argv.slice(2);
  const data = require(path.resolve(dataFile));
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve(tpl));
  await p.evaluate(async ([d, l]) => { await window.render(d, l); }, [data, lang]);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  await p.pdf({ path: out, printBackground: true, preferCSSPageSize: true });
  await b.close();
})();
