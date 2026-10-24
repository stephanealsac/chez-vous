#!/usr/bin/env node
// Génère site/sw.js : service worker qui met tout le site en cache (fonctionne ensuite hors-ligne).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const SITE = process.argv[2] || '../site';
const files = [];
function walk(dir, rel = '') {
  for (const e of fs.readdirSync(path.join(SITE, dir), { withFileTypes: true })) {
    const r = path.posix.join(rel, e.name);
    if (e.isDirectory()) walk(path.join(dir, e.name), r);
    else if (e.name !== 'sw.js' && !e.name.startsWith('.')) files.push(r);
  }
}
walk('.');
const hash = crypto.createHash('sha1');
for (const f of files.sort()) hash.update(f).update(fs.readFileSync(path.join(SITE, f)));
const version = hash.digest('hex').slice(0, 10);
const list = files.map(f => (f === 'index.html' ? './' : './' + f));

const sw = `/* généré par gen_sw.mjs — ne pas modifier à la main */
const VERSION = '${version}';
const CACHE = 'alsac-chezvous-' + VERSION;
const ASSETS = ${JSON.stringify(list, null, 0)};

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // index + catalogue : réseau d'abord (mise à jour), cache en secours ; le reste : cache d'abord
  const networkFirst = /\\/(catalogue\\.json)?$/.test(new URL(req.url).pathname) || req.mode === 'navigate';
  if (networkFirst) {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./'))));
  } else {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })));
  }
});
`;
fs.writeFileSync(path.join(SITE, 'sw.js'), sw);
const total = files.reduce((n, f) => n + fs.statSync(path.join(SITE, f)).size, 0);
console.log(`sw.js : ${files.length} fichiers, ${(total / 1048576).toFixed(1)} Mo, version ${version}`);
