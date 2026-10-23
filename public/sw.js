// Bartrrr Service Worker — Web Push notifications + asset caching
//
// Deploy safety:
//  - sw.js is served with Cache-Control: no-cache (public/_headers) and
//    registered with updateViaCache: 'none', so browsers always see a new
//    deploy's worker.
//  - Navigations (HTML) are network-first and never served stale while
//    online. The cached shell is only an offline fallback.
//  - Hashed /assets/* are cache-first (immutable); a miss falls through to
//    the network, and HTML is never cached under an /assets/ URL, so a
//    stale index.html can't pin a deleted chunk.
//  - Bump CACHE_VERSION to drop all caches on the next activation.

const CACHE_VERSION = 'bartrrr-v2'
const SHELL_URL = '/index.html'
const PRECACHE_URLS = [SHELL_URL, '/manifest.webmanifest', '/icon.svg', '/favicon.svg']
const MAX_RUNTIME_ENTRIES = 120

// Never interfere with local development (Vite HMR serves live modules)
const IS_DEV = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
  if (IS_DEV) return
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS.map((u) => new Request(u, { cache: 'reload' }))))
      .catch(() => {
        /* precache is best-effort; never block activation */
      }),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Drop caches from older service worker versions
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
      ),
    ]),
  )
})

async function trimCache(cache) {
  const keys = await cache.keys()
  if (keys.length <= MAX_RUNTIME_ENTRIES) return
  await Promise.all(keys.slice(0, keys.length - MAX_RUNTIME_ENTRIES).map((k) => cache.delete(k)))
}

function isHtml(response) {
  return (response.headers.get('content-type') || '').includes('text/html')
}

self.addEventListener('fetch', (event) => {
  if (IS_DEV) return
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Only same-origin. Supabase, Mapbox and fonts go straight to the network.
  if (url.origin !== self.location.origin) return
  // Videos use range requests and are huge — let the network handle them
  if (url.pathname.endsWith('.mp4') || request.headers.has('range')) return
  // Always fetch the worker, manifest-adjacent metadata and SEO files fresh
  if (url.pathname === '/sw.js' || url.pathname === '/robots.txt' || url.pathname === '/sitemap.xml') return

  // App navigations → network-first; cached shell only when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && isHtml(response)) {
            const copy = response.clone()
            caches.open(CACHE_VERSION).then((cache) => cache.put(SHELL_URL, copy))
          }
          return response
        })
        .catch(async () => (await caches.match(SHELL_URL)) || Response.error()),
    )
    return
  }

  // Hashed build assets are immutable → cache-first
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached
        const response = await fetch(request)
        // A missing chunk can come back as the SPA's index.html; never cache that
        if (response.ok && !isHtml(response)) {
          cache.put(request, response.clone())
          trimCache(cache)
        }
        return response
      }),
    )
    return
  }

  // Other same-origin static files (images, icons) → stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(request)
      const network = fetch(request)
        .then((response) => {
          if (response.ok && !isHtml(response)) {
            cache.put(request, response.clone())
            trimCache(cache)
          }
          return response
        })
        .catch(() => cached || Response.error())
      return cached || network
    }),
  )
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: 'Bartrrr', body: event.data.text() }
  }

  const title = typeof data.title === 'string' ? data.title.slice(0, 120) : 'Bartrrr'
  const options = {
    body: typeof data.body === 'string' ? data.body.slice(0, 300) : '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: data.tag || 'bartrrr-notification',
    data: data.data || {},
    requireInteraction: false,
    silent: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  // Only ever open same-origin paths
  const raw = event.notification.data && event.notification.data.url
  const path = typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
  const target = new URL(path, self.location.origin).href

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open, focus it and navigate
        for (const client of clientList) {
          if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
            return client.focus().then((c) => (c && 'navigate' in c ? c.navigate(target) : undefined))
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(target)
        }
      }),
  )
})
