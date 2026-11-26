/* Only the public offline page and brand icon are cached. No user data or API responses. */
'use strict';
const CACHE = 'foodjun-public-20261125-v2';
const OFFLINE = new URL('offline.html', self.registration.scope).href;
const ICON = new URL('jun-orange-smile.svg', self.registration.scope).href;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([OFFLINE, ICON])));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('foodjun-public-') && key !== CACHE).map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  // Leave Firebase, sign-in, payment links, writes and all other requests to the network.
  if (request.method !== 'GET' || request.mode !== 'navigate' || !request.url.startsWith(self.registration.scope)) return;
  event.respondWith(fetch(request, {cache:'no-store'}).catch(() => caches.match(OFFLINE)));
});
