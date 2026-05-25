// Service Worker — 静的ファイルをキャッシュしてオフライン対応
// 開発（localhost）では network-first、本番では cache-first
const CACHE = 'calorie-pwa-v22';
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // http/https 以外（chrome-extension など）はスキップ
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.hostname.includes('script.google.com')) return;
  if (e.request.method !== 'GET') return;

  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  if (isLocal) {
    // 開発: 常に最新を取りに行き、失敗時のみキャッシュ
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // 本番: キャッシュ優先、無ければ取得
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => cached)
    )
  );
});
