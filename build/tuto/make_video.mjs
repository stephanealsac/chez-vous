// Vidéo tutoriel : rend tuto.html image par image dans Chromium, puis encode en MP4 (H.264) + affiche (poster).
// Usage : node tuto/make_video.mjs [page.html] [nom] [fps] [t_poster]   → site/<nom>.mp4, site/<nom>-poster.jpg  (défaut : tuto.html, tuto, 30)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const here = path.dirname(new URL(import.meta.url).pathname);
const site = path.resolve(here, '../../site');
const [,, pageFile = 'tuto.html', name = 'tuto', fpsArg = '30', posterT = '14.6'] = process.argv;
const fps = Number(fpsArg);
const frames = path.join(here, 'frames-' + name); fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto('file://' + path.join(here, pageFile), { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const duration = await page.evaluate(() => window.DURATION);
const n = Math.round(duration * fps);
let poster = null;
for (let i = 0; i < n; i++) {
  const t = i / fps;
  await page.evaluate(t => window.render(t), t);
  const f = path.join(frames, `f${String(i).padStart(5, '0')}.jpg`);
  await page.screenshot({ path: f, type: 'jpeg', quality: 92 });
  if (!poster && t >= Number(posterT)) poster = f;
  if (i % (fps * 2) === 0) process.stdout.write(`\r${t.toFixed(1)} s / ${duration} s`);
}
console.log('\nimages :', n);
await browser.close();
const audio = process.env.AUDIO;   // AUDIO=chemin.wav : piste son mixée dans le MP4 (AAC)
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(frames, 'f%05d.jpg'),
  ...(audio ? ['-i', audio] : []),
  '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p', '-crf', process.env.CRF || '22', '-preset', 'slow',
  ...(audio ? ['-c:a', 'aac', '-b:a', '160k', '-shortest'] : ['-an']),
  '-movflags', '+faststart', path.join(site, name + '.mp4')]);
execFileSync('convert', [poster, '-quality', '82', path.join(site, name + '-poster.jpg')]);
fs.rmSync(frames, { recursive: true, force: true });
const mb = (fs.statSync(path.join(site, name + '.mp4')).size / 1e6).toFixed(2);
console.log(`${name}.mp4 : ${mb} Mo, ${duration} s, ${fps} i/s — poster : ${name}-poster.jpg`);
