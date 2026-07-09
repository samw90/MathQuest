// Bump CACHE (v6 -> v7 ...) whenever you upload a new index.html so devices refresh.
// v7: the app shell (index.html / navigations) is now NETWORK-FIRST with a 3s
// timeout, so new uploads are picked up automatically when online, while the
// app still loads instantly from cache offline. Other assets stay cache-first.
const CACHE = 'mathquest-v8-1';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png', './favicon-32.png'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
function putCopy(req, resp) {
  const copy = resp.clone();
  caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
  return resp;
}
function networkWithTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then((resp) => { clearTimeout(timer); resolve(putCopy(req, resp)); },
                    (err)  => { clearTimeout(timer); reject(err); });
  });
}
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isShell = e.request.mode === 'navigate' ||
    url.pathname.endsWith('/index.html') || url.pathname.endsWith('/');
  if (isShell) {
    // Network-first: fresh builds arrive without a cache bump; cache is the offline fallback.
    e.respondWith(
      networkWithTimeout(e.request, 3000)
        .catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }
  // Everything else: cache-first with background fill.
  e.respondWith(
    caches.match(e.request).then((hit) =>
      hit || fetch(e.request).then((resp) => putCopy(e.request, resp))
        .catch(() => caches.match('./index.html'))
    )
  );
});
