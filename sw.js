const CACHE = 'mis-tickets-v6';
const BASE = ['./', 'index.html', 'analizar.js', 'barras.js', 'manifest.json', 'icono-180.png', 'icono-192.png', 'icono-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.hostname.includes('script.google')) return;
  const propio = u.origin === location.origin, fuente = /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (!propio && !fuente) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: propio }).then(c => {
    const red = fetch(propio ? new Request(e.request, { cache: 'no-cache' }) : e.request).then(r => { if (r.ok || r.type === 'opaque') { const cp = r.clone(); caches.open(CACHE).then(x => x.put(e.request, cp)); } return r; }).catch(() => c);
    return c || red;
  }));
});
