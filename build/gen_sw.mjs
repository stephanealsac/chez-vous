#!/usr/bin/env node
// Génère site/sw.js : service worker.
//  - précache le « squelette » (page, catalogue, polices, scripts, icônes, vignettes) ≈ 2 Mo
//  - images HD et modèles 3D : mis en cache à la demande, dans un cache séparé au nom stable
//    (ils ne sont pas re-téléchargés à chaque déploiement)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const SITE = process.argv[2] || '../site';
const shell = ['index.html', 'catalogue.json', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png'];
for (const d of ['fonts', 'vendor']) for (const f of fs.readdirSync(path.join(SITE, d))) shell.push(`${d}/${f}`);
for (const f of fs.readdirSync(path.join(SITE, 'img'))) if (f.endsWith('-thumb.jpg')) shell.push(`img/${f}`);

const hash = crypto.createHash('sha1');
for (const f of shell.sort()) hash.update(f).update(fs.readFileSync(path.join(SITE, f)));
const version = hash.digest('hex').slice(0, 10);
const list = shell.map(f => (f === 'index.html' ? './' : './' + f));

const sw = `/* généré par gen_sw.mjs — ne pas modifier à la main */
const VERSION = '${version}';
const SHELL = 'alsac-chezvous-shell-' + VERSION;
const MEDIA = 'alsac-chezvous-media';              // images HD + modèles 3D, nom stable
const ASSETS = ${JSON.stringify(list)};

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== MEDIA).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const isMedia = /^\\/(models|img)\\//.test(url.pathname) && !/-thumb\\.jpg$/.test(url.pathname);
  const networkFirst = req.mode === 'navigate' || /\\/(catalogue\\.json)?$/.test(url.pathname);
  if (networkFirst) {
    // page et catalogue : réseau d'abord (toujours à jour), cache en secours hors-ligne
    e.respondWith(fetch(req).then(r => {
      if (r.ok) e.waitUntil(caches.open(SHELL).then(c => c.put(req, r.clone())));
      return r;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./'))));
  } else {
    // le reste : cache d'abord, puis réseau (et on garde une copie si la réponse est bonne)
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(r => {
      if (r.ok) e.waitUntil(caches.open(isMedia ? MEDIA : SHELL).then(c => c.put(req, r.clone())));
      return r;
    })));
  }
});
`;
fs.writeFileSync(path.join(SITE, 'sw.js'), sw);
const total = shell.reduce((n, f) => n + fs.statSync(path.join(SITE, f)).size, 0);
console.log(`sw.js : squelette ${shell.length} fichiers, ${(total / 1048576).toFixed(1)} Mo, version ${version}`);
