/* généré par gen_sw.mjs — ne pas modifier à la main */
const VERSION = 'ef790b45e4';
const CACHE = 'alsac-chezvous-' + VERSION;
const ASSETS = ["./catalogue.json","./fonts/CormorantGaramond-italic-300-latin-ext.woff2","./fonts/CormorantGaramond-italic-300-latin.woff2","./fonts/CormorantGaramond-normal-300-latin-ext.woff2","./fonts/CormorantGaramond-normal-300-latin.woff2","./fonts/Raleway-normal-200-latin-ext.woff2","./fonts/Raleway-normal-200-latin.woff2","./fonts/fonts.css","./icon-180.png","./icon-512.png","./img/tableau-eland-derby-thumb.jpg","./img/tableau-eland-derby.jpg","./img/tableau-gorille-jungle-thumb.jpg","./img/tableau-gorille-jungle.jpg","./img/tableau-gorille-thumb.jpg","./img/tableau-gorille.jpg","./img/tableau-leopard-thumb.jpg","./img/tableau-leopard.jpg","./img/tableau-peinture-ibex-thumb.jpg","./img/tableau-peinture-ibex.jpg","./img/tableau-peinture-leopard-branche-thumb.jpg","./img/tableau-peinture-leopard-branche.jpg","./img/tableau-peinture-loup-noir-thumb.jpg","./img/tableau-peinture-loup-noir.jpg","./img/tableau-peinture-tigre-thumb.jpg","./img/tableau-peinture-tigre.jpg","./img/tableau-realiste-lievre-thumb.jpg","./img/tableau-realiste-lievre.jpg","./","./manifest.webmanifest","./models/tableau-eland-derby-classique.glb","./models/tableau-eland-derby-classique.usdz","./models/tableau-eland-derby-geant.glb","./models/tableau-eland-derby-geant.usdz","./models/tableau-eland-derby-grand.glb","./models/tableau-eland-derby-grand.usdz","./models/tableau-gorille-classique.glb","./models/tableau-gorille-classique.usdz","./models/tableau-gorille-grand.glb","./models/tableau-gorille-grand.usdz","./models/tableau-gorille-jungle-geant.glb","./models/tableau-gorille-jungle-geant.usdz","./models/tableau-gorille-jungle-grand.glb","./models/tableau-gorille-jungle-grand.usdz","./models/tableau-gorille-jungle-monumental.glb","./models/tableau-gorille-jungle-monumental.usdz","./models/tableau-leopard-classique.glb","./models/tableau-leopard-classique.usdz","./models/tableau-leopard-geant.glb","./models/tableau-leopard-geant.usdz","./models/tableau-leopard-grand.glb","./models/tableau-leopard-grand.usdz","./models/tableau-peinture-ibex-classique.glb","./models/tableau-peinture-ibex-classique.usdz","./models/tableau-peinture-ibex-grand.glb","./models/tableau-peinture-ibex-grand.usdz","./models/tableau-peinture-leopard-branche-classique.glb","./models/tableau-peinture-leopard-branche-classique.usdz","./models/tableau-peinture-loup-noir-geant.glb","./models/tableau-peinture-loup-noir-geant.usdz","./models/tableau-peinture-loup-noir-grand.glb","./models/tableau-peinture-loup-noir-grand.usdz","./models/tableau-peinture-tigre-classique.glb","./models/tableau-peinture-tigre-classique.usdz","./models/tableau-realiste-lievre-classique.glb","./models/tableau-realiste-lievre-classique.usdz","./vendor/model-viewer.min.js","./vendor/qrcode.min.js"];

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
  const networkFirst = /\/(catalogue\.json)?$/.test(new URL(req.url).pathname) || req.mode === 'navigate';
  if (networkFirst) {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./'))));
  } else {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })));
  }
});
