import { chromium } from 'playwright';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname);
const out = '/tmp/claude-0/-home-claude/32b6d276-528f-52b6-9df0-08434b432727/scratchpad';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto('file://' + path.join(here, 'tuto.html'), { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
for (const t of process.argv.slice(2).map(Number)) { await page.evaluate(t => window.render(t), t); await page.screenshot({ path: `${out}/t${t}.jpg`, type: 'jpeg', quality: 80 }); }
await browser.close();
