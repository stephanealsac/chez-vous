// Captures du site pour le tutoriel, dans une langue : LANG=fr|en node tuto/capture_lang.mjs  (serveur local sur :8765 → site/)
// Écrit full-catalogue[-en].png, full-zebra[-en].png, full-zebra-grand[-en].png et affiche les positions (px CSS) utiles au film.
import { chromium, devices } from 'playwright';
const out = new URL('.', import.meta.url).pathname;
const L = process.env.LANG_TUTO || 'fr', sfx = L === 'en' ? '-en' : '';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2, viewport: { width: 390, height: 844 }, locale: L === 'en' ? 'en-US' : 'fr-FR' });
await ctx.addInitScript(() => { const s = DOMTokenList.prototype.supports; DOMTokenList.prototype.supports = function (t) { return t === 'ar' ? true : s.call(this, t); }; try { localStorage.setItem('ar_tuto_seen', '1'); localStorage.removeItem('lang'); } catch (_) {} });
const page = await ctx.newPage();
const base = 'http://localhost:8765/?lang=' + L;
await page.goto(base, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
const card = await page.$eval('a.card[href="#tableau-peinture-zebres"] .ph', e => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + window.scrollY + b.height / 2 }; });
await page.screenshot({ path: out + `full-catalogue${sfx}.png`, fullPage: true });
const res = { card };
for (const [hash, name] of [['#tableau-peinture-zebres', 'full-zebra'], ['#tableau-peinture-zebres/grand', 'full-zebra-grand']]) {
  await page.goto(base + hash, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
  res.rows = await page.$$eval('.size', es => es.map(e => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + window.scrollY + b.height / 2 }; }));
  await page.evaluate(() => { document.querySelector('.actions').style.position = 'static'; });
  await page.screenshot({ path: out + `${name}${sfx}.png`, fullPage: true });
  res.btn = await page.$eval('#ar-btn', e => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + window.scrollY + b.height / 2 }; });
}
console.log(JSON.stringify(res));
await browser.close();
