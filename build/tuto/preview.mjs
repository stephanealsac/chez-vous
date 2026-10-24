// Aperçu : node tuto/preview.mjs <fichier.html> <nom> t1 t2 ...  → planche contact dans le scratchpad
import { chromium } from 'playwright';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const [,, file, name, ...ts] = process.argv;
const here = path.dirname(new URL(import.meta.url).pathname);
const out = '/tmp/claude-0/-home-claude/32b6d276-528f-52b6-9df0-08434b432727/scratchpad';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('file://' + path.join(here, file), { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const files = [];
for (const t of ts.map(Number)) { await page.evaluate(t => window.render(t), t); const f = `${out}/${name}-${t}.jpg`; await page.screenshot({ path: f, type: 'jpeg', quality: 80 }); files.push(f); }
await browser.close();
execFileSync('montage', [...files, '-tile', '3x', '-geometry', '360x640+8+8', `${out}/${name}-sheet.jpg`]);
console.log(errs.length ? 'ERREURS: ' + errs.join(' | ') : 'ok', files.length, 'vues');
