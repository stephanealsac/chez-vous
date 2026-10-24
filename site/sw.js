/* généré par gen_sw.mjs — ne pas modifier à la main */
const VERSION = '6284a5c4c3';
const SHELL = 'alsac-chezvous-shell-' + VERSION;
const MEDIA = 'alsac-chezvous-media';              // images HD, nom stable
const ASSETS = ["./catalogue.json","./fonts/CormorantGaramond-italic-ext.woff2","./fonts/CormorantGaramond-italic.woff2","./fonts/CormorantGaramond-normal-ext.woff2","./fonts/CormorantGaramond-normal.woff2","./fonts/Raleway-ext.woff2","./fonts/Raleway.woff2","./fonts/fonts.css","./icon-180.png","./icon-512.png","./img/tableau-eland-derby-thumb.jpg","./img/tableau-gorille-jungle-thumb.jpg","./img/tableau-gorille-thumb.jpg","./img/tableau-leopard-thumb.jpg","./img/tableau-peinture-ibex-thumb.jpg","./img/tableau-peinture-leopard-branche-thumb.jpg","./img/tableau-peinture-loup-noir-thumb.jpg","./img/tableau-peinture-tigre-thumb.jpg","./img/tableau-realiste-lievre-thumb.jpg","./","./manifest.webmanifest","./vendor/model-viewer.min.js"];

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
  if (/^\/models\//.test(url.pathname)) return;   // modèles 3D : jamais via le SW (AR Quick Look / Scene Viewer les chargent eux-mêmes)
  const isMedia = /^\/img\//.test(url.pathname) && !/-thumb\.jpg$/.test(url.pathname);
  const networkFirst = req.mode === 'navigate' || /\/(catalogue\.json)?$/.test(url.pathname);
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
