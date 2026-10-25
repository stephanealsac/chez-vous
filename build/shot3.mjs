// Parcours complet sur le site en ligne, émulation iPhone : catalogue → œuvre → format → clic « Voir sur mon mur »
import { chromium, devices } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'fr-FR' });
await ctx.addInitScript(() => { DOMTokenList.prototype.supports = function(t){ return t === 'ar'; }; });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const failed = []; page.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
await page.goto('https://chez-vous.stephane-alsac.com/', { waitUntil: 'networkidle' });
console.log('titre:', await page.title(), '| cartes:', await page.locator('a.card').count());
const tutoOpen = await page.evaluate(() => document.querySelector('#tuto').classList.contains('open'));
const videoOk = await page.evaluate(() => new Promise(res => { const v = document.querySelector('#tuto-video'); if (v.readyState >= 1) return res(true); v.addEventListener('loadedmetadata', () => res(true), { once: true }); setTimeout(() => res(false), 15000); }));
console.log('tutoriel 1re visite:', tutoOpen, '| vidéo chargée:', videoOk);
if (tutoOpen) { await page.click('#tuto-close'); await page.waitForTimeout(300); }
await page.click('a.card:nth-child(8)'); await page.waitForTimeout(800);   // 8 = Corne de Brume (2 formats)
console.log('fiche:', await page.locator('#w-title').textContent(), '| formats:', await page.locator('.size').count(), '| hash', await page.evaluate(() => location.hash));
await page.click('.size:nth-child(2)'); await page.waitForTimeout(300);
console.log('format 2 → hash', await page.evaluate(() => location.hash), '| dims:', (await page.locator('#dims').textContent()).trim());
// simule Safari iOS : relList.supports('ar') = true
const href = await page.evaluate(() => new Promise(res => { const a = document.querySelector('#ql'); const orig = a.click.bind(a); a.click = () => res(a.getAttribute('href')); document.querySelector('#ar-btn').click(); setTimeout(() => res('PAS DE CLIC'), 2000); }));
console.log('lien AR déclenché:', href);
await page.waitForTimeout(1500); const sw = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()) ? 'enregistré' : 'absent');
const pre = await page.evaluate(() => performance.getEntriesByType('resource').filter(e => e.name.endsWith('.usdz')).map(e => e.name.split('/').pop()));
console.log('usdz préchargés:', pre);
console.log('service worker:', sw);
console.log('réponses en erreur:', failed.length ? failed : 'aucune');
console.log('erreurs JS:', errs.length ? errs : 'aucune');
await browser.close();
