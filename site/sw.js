/* ancien service worker : se désinstalle et vide ses caches */
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))).then(() => self.registration.unregister()).then(() => self.clients.matchAll({ type: 'window' })).then(cs => cs.forEach(c => c.navigate(c.url))));
});
