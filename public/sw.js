const CACHE_NAME = 'iglesia-generosidad-v1'
const APP_ROOT = new URL('./', self.registration.scope).href
const SHELL_ASSETS = [
  APP_ROOT,
  new URL('manifest.webmanifest', APP_ROOT).href,
  new URL('favicon.png', APP_ROOT).href,
  new URL('pwa-192.png', APP_ROOT).href,
  new URL('pwa-512.png', APP_ROOT).href,
]
const STATIC_ASSET = /\.(?:js|css|png|jpe?g|svg|webp|woff2?)$/i

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('iglesia-generosidad-') && key !== CACHE_NAME)
          .map(key => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (!response.ok) return response
          return caches.open(CACHE_NAME)
            .then(cache => cache.put(APP_ROOT, response.clone()).then(() => response))
        })
        .catch(() => caches.match(APP_ROOT)),
    )
    return
  }

  if (STATIC_ASSET.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(response => {
          if (!response.ok) return response
          return caches.open(CACHE_NAME)
            .then(cache => cache.put(request, response.clone()).then(() => response))
        })
      }),
    )
  }
})
