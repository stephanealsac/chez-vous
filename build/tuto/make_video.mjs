// Vidéo tutoriel : rend tuto.html image par image dans Chromium, puis encode en MP4 (H.264) + affiche (poster).
// Usage : node tuto/make_video.mjs [fps]      → site/tuto.mp4, site/tuto-poster.jpg
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const here = path.dirname(new URL(import.meta.url).pathname);
const site = path.resolve(here, '../../site');
const fps = Number(process.argv[2] || 30);
const frames = path.join(here, 'frames'); fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto('file://' + path.join(here, 'tuto.html'), { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const duration = await page.evaluate(() => window.DURATION);
const n = Math.round(duration * fps);
let poster = null;
for (let i = 0; i < n; i++) {
  const t = i / fps;
  await page.evaluate(t => window.render(t), t);
  const f = path.join(frames, `f${String(i).padStart(5, '0')}.jpg`);
  await page.screenshot({ path: f, type: 'jpeg', quality: 92 });
  if (!poster && t >= 14.6) poster = f;
  if (i % (fps * 2) === 0) process.stdout.write(`\r${t.toFixed(1)} s / ${duration} s`);
}
console.log('\nimages :', n);
await browser.close();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(frames, 'f%05d.jpg'),
  '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p', '-crf', '22', '-preset', 'slow',
  '-movflags', '+faststart', '-an', path.join(site, 'tuto.mp4')]);
execFileSync('convert', [poster, '-quality', '82', path.join(site, 'tuto-poster.jpg')]);
fs.rmSync(frames, { recursive: true, force: true });
const mb = (fs.statSync(path.join(site, 'tuto.mp4')).size / 1e6).toFixed(2);
console.log(`tuto.mp4 : ${mb} Mo, ${duration} s, ${fps} i/s — poster : tuto-poster.jpg`);
