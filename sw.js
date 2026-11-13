// Offline support: keeps a copy of Vestora on the device after the first online launch.
// Pages and prices load network-first (fresh when online), everything else comes from the cache.
// Raise the number in CACHE every time you change a file, so phones pick up the change.
const CACHE = 'vestora-v35';
const CORE = [
  './', './index.html', './manifest.webmanifest', './privacy.html', './terms.html',
  './icons/icon-192.png', './icons/icon-512.png', './wallet.bundle.js', './data/history.json',
  './fonts/commissioner-greek-400-normal.woff2', './fonts/commissioner-greek-600-normal.woff2', './fonts/commissioner-greek-800-normal.woff2',
  './fonts/commissioner-latin-400-normal.woff2', './fonts/commissioner-latin-600-normal.woff2', './fonts/commissioner-latin-800-normal.woff2'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;   // prices from Jupiter and wallet checks always go to the network
  const fresh = req.mode === 'navigate' || /\/data\/(history|latest)\.json$/.test(url.pathname);
  if (fresh) {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
  } else {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })));
  }
});
