import { chromium, devices } from 'playwright';
const out = new URL('.', import.meta.url).pathname;
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2, viewport: { width: 390, height: 844 }, locale: 'fr-FR' });
await ctx.addInitScript(() => { const s = DOMTokenList.prototype.supports; DOMTokenList.prototype.supports = function (t) { return t === 'ar' ? true : s.call(this, t); }; try { localStorage.setItem('ar_tuto_seen', '1'); } catch (_) {} });
const page = await ctx.newPage();
await page.goto('http://localhost:8765/', { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
await page.screenshot({ path: out + 'full-catalogue.png', fullPage: true });
const card = await page.$eval('a.card:nth-child(1) .ph', e => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + window.scrollY + b.height / 2 }; });
await page.goto('http://localhost:8765/#tableau-peinture-tigre', { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
// la fiche : on retire la barre collante pour la capture longue, puis on la recapture seule
const sizeRow = await page.$eval('.size', e => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + window.scrollY + b.height / 2 }; });
const docH = await page.evaluate(() => document.documentElement.scrollHeight);
await page.evaluate(() => { document.querySelector('.actions').style.position = 'static'; });
await page.screenshot({ path: out + 'full-fiche.png', fullPage: true });
const btn = await page.$eval('#ar-btn', e => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + window.scrollY + b.height / 2, w: b.width, h: b.height, top: b.y + window.scrollY, left: b.x }; });
const buy = await page.$eval('#buy', e => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + window.scrollY + b.height / 2 }; });
console.log(JSON.stringify({ card, sizeRow, btn, buy, docH }));
await browser.close();
