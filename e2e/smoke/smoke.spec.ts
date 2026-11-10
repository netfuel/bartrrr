/// <reference lib="dom" />
/**
 * Layer 8: read-only production smoke. Never signs in, never writes.
 *
 * Runs against SMOKE_URL (default https://bartrrr.app). Against a local
 * `vite preview` of the build, checks that depend on Cloudflare
 * (_headers, the www redirect, the real share-tag host) skip themselves.
 */
import { test, expect, type Page } from '@playwright/test'

const BASE = (process.env.SMOKE_URL ?? 'https://bartrrr.app').replace(/\/+$/, '')
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/.test(BASE)
const PROD_ORIGIN = 'https://bartrrr.app'

const PUBLIC_ROUTES: { path: string; title: RegExp; status?: number }[] = [
  { path: '/', title: /^Bartrrr: Trade, don't buy$/ },
  { path: '/auth/login', title: /^Log in \| Bartrrr$/ },
  { path: '/auth/signup', title: /^Join \| Bartrrr$/ },
  { path: '/auth/forgot-password', title: /\| Bartrrr$/ },
  { path: '/privacy', title: /^Privacy policy \| Bartrrr$/ },
  { path: '/terms', title: /\| Bartrrr$/ },
  { path: '/this-page-does-not-exist', title: /^Page not found \| Bartrrr$/ },
]

/** Collect page errors and CSP violations from the first byte. */
async function watch(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] }
    w.__csp = []
    document.addEventListener('securitypolicyviolation', (e) => {
      w.__csp.push(`${e.violatedDirective} blocked ${e.blockedURI || '(inline)'}`)
    })
  })
  return {
    errors,
    csp: () => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp ?? []),
  }
}

test.describe('W-01 public routes load', () => {
  for (const r of PUBLIC_ROUTES) {
    test(r.path, async ({ page }) => {
      const w = await watch(page)
      const res = await page.goto(BASE + r.path)
      expect(res?.status(), 'served (SPA routes answer 200)').toBe(200)
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 20_000 })
      await expect(page).toHaveTitle(r.title)
      // Not the "missing configuration" screen of a build without env vars
      await expect(page.getByText(/Missing required environment|VITE_SUPABASE/i)).toHaveCount(0)
      await page.waitForTimeout(500)
      expect(w.errors, 'no uncaught page errors').toEqual([])
      expect(await w.csp(), 'S-05 no CSP violations').toEqual([])
    })
  }
})

/** Width and height from a JPEG's SOF marker, or a PNG's IHDR. */
function imageSize(buf: Buffer): { width: number; height: number } | null {
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  }
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null
  let i = 2
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null
    const marker = buf[i + 1]
    const len = buf.readUInt16BE(i + 2)
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
    }
    i += 2 + len
  }
  return null
}

test.describe('W-02 sharing and crawlers', () => {
  test('og and twitter tags use absolute URLs; the image is 1200x630', async ({ page, request }) => {
    await page.goto(BASE + '/')
    const meta = await page.evaluate(() => {
      const get = (sel: string) => document.querySelector<HTMLMetaElement>(sel)?.content ?? null
      return {
        ogTitle: get('meta[property="og:title"]'),
        ogDesc: get('meta[property="og:description"]'),
        ogUrl: get('meta[property="og:url"]'),
        ogImage: get('meta[property="og:image"]'),
        ogW: get('meta[property="og:image:width"]'),
        ogH: get('meta[property="og:image:height"]'),
        twCard: get('meta[name="twitter:card"]'),
        twImage: get('meta[name="twitter:image"]'),
        twTitle: get('meta[name="twitter:title"]'),
        canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? null,
      }
    })
    expect(meta.ogTitle).toBeTruthy()
    expect(meta.ogDesc).toBeTruthy()
    expect(meta.twTitle).toBeTruthy()
    expect(meta.twCard).toBe('summary_large_image')
    for (const key of ['ogUrl', 'ogImage', 'twImage'] as const) {
      expect(meta[key], `${key} is an absolute https URL`).toMatch(/^https:\/\//)
    }
    expect(meta.ogW).toBe('1200')
    expect(meta.ogH).toBe('630')
    if (!IS_LOCAL) {
      // Real share tags point at the live site
      expect(new URL(meta.ogUrl!).origin).toBe(PROD_ORIGIN)
      expect(new URL(meta.ogImage!).origin).toBe(PROD_ORIGIN)
      expect(meta.canonical).toBe(`${PROD_ORIGIN}/`)
    }

    // Locally the tags still name bartrrr.app; fetch the same path from the preview
    const imageUrl = IS_LOCAL ? BASE + new URL(meta.ogImage!).pathname : meta.ogImage!
    const res = await request.get(imageUrl)
    expect(res.status(), `${imageUrl} answers 200`).toBe(200)
    expect(res.headers()['content-type']).toMatch(/^image\//)
    expect(imageSize(await res.body())).toEqual({ width: 1200, height: 630 })
    if (meta.twImage !== meta.ogImage) {
      const tw = await request.get(IS_LOCAL ? BASE + new URL(meta.twImage!).pathname : meta.twImage!)
      expect(tw.status()).toBe(200)
    }
  })

  test('sitemap.xml lists the public pages with absolute URLs', async ({ request }) => {
    const res = await request.get(BASE + '/sitemap.xml')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toMatch(/xml/)
    const xml = await res.text()
    expect(xml).toContain('<urlset')
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    expect(locs.length).toBeGreaterThan(0)
    for (const loc of locs) expect(loc).toMatch(/^https:\/\/bartrrr\.app\//)
    expect(locs).toContain('https://bartrrr.app/')
    // Nothing private is advertised
    for (const loc of locs) expect(loc).not.toMatch(/\/(dashboard|offers|agreements|settings|onboarding)/)
  })

  test('robots.txt allows the site, keeps private pages out, points to the sitemap', async ({ request }) => {
    const res = await request.get(BASE + '/robots.txt')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toMatch(/text\/plain/)
    const txt = await res.text()
    expect(txt).toMatch(/User-agent: \*/)
    expect(txt).toMatch(/Disallow: \/dashboard/)
    expect(txt).toMatch(/Sitemap: https:\/\/bartrrr\.app\/sitemap\.xml/)
  })
})

test.describe('W-03 www redirect', () => {
  test.skip(IS_LOCAL, 'www → apex is a Cloudflare Redirect Rule: production only')

  test('www keeps the path and query', async ({ request }) => {
    const host = new URL(BASE).host
    const res = await request.get(`https://www.${host}/privacy?utm_source=smoke&x=1`, { maxRedirects: 0 })
    expect([301, 308]).toContain(res.status())
    expect(res.headers()['location']).toBe(`https://${host}/privacy?utm_source=smoke&x=1`)
  })

  test('legacy /login redirects to /auth/login', async ({ request }) => {
    const res = await request.get(BASE + '/login', { maxRedirects: 0 })
    expect(res.status()).toBe(301)
    expect(new URL(res.headers()['location'], BASE).pathname).toBe('/auth/login')
  })
})

test.describe('S-05 security headers', () => {
  test.skip(IS_LOCAL, 'headers come from Cloudflare Pages (public/_headers): production only')

  for (const r of PUBLIC_ROUTES) {
    test(r.path, async ({ request }) => {
      const res = await request.get(BASE + r.path)
      const h = res.headers()
      const csp = h['content-security-policy'] ?? ''
      expect(csp, 'CSP is set').toContain("default-src 'self'")
      expect(csp).toContain("frame-ancestors 'none'")
      expect(csp).toContain("object-src 'none'")
      expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/)
      expect(h['strict-transport-security']).toMatch(/max-age=\d{7,}/)
      expect(h['x-frame-options']).toBe('DENY')
      expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
      expect(h['x-content-type-options']).toBe('nosniff')
      // Each header set once (overlapping _headers rules would comma-join them)
      expect(h['x-frame-options']).not.toContain(',')
    })
  }

  test('hashed assets are immutable; sw.js is never cached', async ({ request, page }) => {
    await page.goto(BASE + '/')
    const asset = await page.evaluate(() => document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src)
    expect(asset).toBeTruthy()
    const a = await request.get(asset!)
    expect(a.headers()['cache-control']).toMatch(/immutable/)
    const sw = await request.get(BASE + '/sw.js')
    expect(sw.headers()['cache-control']).toMatch(/no-cache|no-store/)
  })
})

test.describe('W-04 PWA', () => {
  test('the manifest is valid and its icons load', async ({ request }) => {
    const res = await request.get(BASE + '/manifest.webmanifest')
    expect(res.status()).toBe(200)
    if (!IS_LOCAL) expect(res.headers()['content-type']).toMatch(/application\/manifest\+json/)
    const m = await res.json()
    expect(m.name).toBeTruthy()
    expect(m.short_name).toBeTruthy()
    expect(m.start_url).toBe('/')
    expect(['standalone', 'fullscreen', 'minimal-ui']).toContain(m.display)
    expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i)
    expect(m.background_color).toMatch(/^#[0-9a-f]{6}$/i)
    expect(Array.isArray(m.icons) && m.icons.length).toBeTruthy()
    expect(m.icons.some((i: { purpose?: string }) => /maskable/.test(i.purpose ?? ''))).toBe(true)
    for (const icon of m.icons as { src: string }[]) {
      const r = await request.get(new URL(icon.src, BASE + '/').href)
      expect(r.status(), `${icon.src} loads`).toBe(200)
    }
  })

  test('the service worker registers and controls the page', async ({ page }) => {
    await page.goto(BASE + '/')
    const scope = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return 'unsupported'
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((r) => setTimeout(() => r(null), 30_000)),
      ])
      return reg ? reg.scope : null
    })
    expect(scope, 'service worker ready').toBe(BASE + '/')
    // After a reload the worker controls the page
    await page.reload()
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15_000 })
  })
})
