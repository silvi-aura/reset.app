/* RESET 21 — service worker
   HTML: red primero (así los cambios de contenido llegan al celular).
   Resto: cache primero + actualización en segundo plano. */
const VERSION = 'reset21-v2.0.0';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/icon-180.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.allSettled(CORE.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const esHTML = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html');

  // 1) HTML → red primero, cache de respaldo
  if (esHTML) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copia = res.clone();
          caches.open(VERSION).then(c => c.put('./index.html', copia));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // 2) Tipografías de Google → cache primero, se actualiza atrás
  const fuentes = url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com');

  // 3) Todo lo demás del mismo origen + fuentes → cache primero
  if (url.origin === self.location.origin || fuentes) {
    e.respondWith(
      caches.match(req).then(cacheado => {
        const red = fetch(req).then(res => {
          if (res && (res.status === 200 || res.type === 'opaque')) {
            const copia = res.clone();
            caches.open(VERSION).then(c => c.put(req, copia));
          }
          return res;
        }).catch(() => cacheado);
        return cacheado || red;
      })
    );
  }
});
