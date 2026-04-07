const CACHE_NAME = 'nexus-engine-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Ignora requisições de API ou extensões
  if (event.request.url.includes('/api/') || !event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(fetch(event.request));
});
