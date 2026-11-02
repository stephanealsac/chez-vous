// Visuels HD pour le catalogue papier 2027 : node render.mjs  (depuis build/catalogue2027)
import { chromium } from 'playwright';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname), out = path.join(here, 'out');
const b = await chromium.launch();
async function shot(file, q, w, h, dsf, dest) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dsf });
  await p.goto('file://' + path.join(here, file) + q, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(out, dest) }); await p.close();
}
for (const l of ['fr', 'en']) await shot('ar-screen.html', '?lang=' + l, 390, 844, 1179 / 390, `ar-${l}.png`);
for (const l of ['fr', 'en']) {
  await shot('compose.html', `?mode=trio&lang=${l}`, 1800, 1270, 2, `trio-${l}.png`);
  await shot('compose.html', `?mode=wall&lang=${l}`, 1800, 1270, 2, `wall-${l}.png`);
}
await shot('compose.html', '?mode=icon', 1200, 1200, 2, 'icon.png');
await b.close();
console.log('ok');
