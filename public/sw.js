// Bartrrr Service Worker — Web Push notifications + asset caching

const CACHE_VERSION = 'bartrrr-v1'
const PRECACHE_URLS = ['/', '/manifest.webmanifest', '/icon.svg', '/favicon.svg']

// Never interfere with local development (Vite HMR serves live modules)
const IS_DEV = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
  if (IS_DEV) return
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      // Drop caches from older service worker versions
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
      ),
    ]),
  )
})

self.addEventListener('fetch', (event) => {
  if (IS_DEV) return
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // Videos use range requests and are huge — let the network handle them
  if (url.pathname.endsWith('.mp4')) return

  // Hashed build assets are immutable → cache-first
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached
        const response = await fetch(request)
        if (response.ok) cache.put(request, response.clone())
        return response
      }),
    )
    return
  }

  // App navigations → network-first, offline fallback to cached shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE_VERSION).then((cache) => cache.put('/', copy))
          }
          return response
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  // Everything else same-origin (images, manifest, fonts) → stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(request)
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone())
          return response
        })
        .catch(() => cached)
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

  const title = data.title || 'Bartrrr'
  const options = {
    body: data.body || '',
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

  const url = event.notification.data?.url || '/'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open, focus it and navigate
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus()
            client.navigate(url)
            return
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(url)
        }
      }),
  )
})
