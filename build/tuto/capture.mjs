// Captures iPhone (mode Safari AR) pour la vidéo tutoriel. Serveur local attendu sur :8765 (dossier site/)
import { chromium, devices } from 'playwright';
const out = new URL('.', import.meta.url).pathname;
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2, viewport: { width: 390, height: 844 }, locale: 'fr-FR' });
await ctx.addInitScript(() => { const s = DOMTokenList.prototype.supports; DOMTokenList.prototype.supports = function (t) { return t === 'ar' ? true : s.call(this, t); }; try { localStorage.setItem('ar_tuto_seen', '1'); } catch (_) {} });
const page = await ctx.newPage();
await page.goto('http://localhost:8765/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.screenshot({ path: out + 'scr-catalogue.png' });
// position de la vignette du tigre (pour l'animation du doigt)
const r = await page.$eval('a.card:nth-child(1) .ph', e => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
await page.goto('http://localhost:8765/#tableau-peinture-tigre', { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
await page.evaluate(() => window.scrollTo(0, document.querySelector('#sizes').getBoundingClientRect().top + window.scrollY - 140)); await page.waitForTimeout(300);
await page.screenshot({ path: out + 'scr-fiche.png' });
const s1 = await page.$eval('.size', e => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
const btn = await page.$eval('#ar-btn', e => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
const vp = page.viewportSize();
console.log(JSON.stringify({ vp, card: r, size: s1, btn }));
await browser.close();
