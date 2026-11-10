/// <reference lib="dom" />
import { deflateSync } from 'node:zlib'
import { mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import type { Page, TestInfo } from '@playwright/test'

/**
 * Helpers for the core demo end-to-end specs (account, onboarding, profile,
 * listings, discovery, deletion, public pages).
 *
 * Demo mode keeps every store in memory (only the demo login survives a
 * reload), so tests move around with in-app navigation after logging in.
 */

/** Where failure screenshots for bugs found by these specs go. */
export const BUG_SHOTS_DIR =
  process.env.BUG_SHOTS_DIR ??
  '/tmp/claude-0/-home-claude/87739abf-99bf-5cc0-842e-f54964f93487/scratchpad/regression/core'

/** Save a screenshot named after the test, for the bug report. */
export async function bugShot(page: Page, testInfo: TestInfo, name: string) {
  try {
    mkdirSync(BUG_SHOTS_DIR, { recursive: true })
    await page.screenshot({ path: `${BUG_SHOTS_DIR}/${name}-${testInfo.project.name}.png`, fullPage: false })
  } catch {
    // A screenshot is a nice-to-have; never fail the test over it
  }
}

/**
 * After each test marked test.fail (a known app bug), save a screenshot of
 * the state the failing assertion saw, for the bug report.
 */
export function captureBugShots(t: {
  afterEach: (fn: (args: { page: Page }, info: TestInfo) => Promise<void>) => void
  beforeEach: (fn: (args: object, info: TestInfo) => Promise<void> | void) => void
}) {
  // Shared sandbox runs several suites at once; give each test headroom
  // eslint-disable-next-line no-empty-pattern
  t.beforeEach(({}, info) => {
    info.setTimeout(Math.max(info.timeout, 60_000))
  })
  t.afterEach(async ({ page }, info) => {
    if (info.expectedStatus !== 'failed' || info.status !== 'failed') return
    const slug = `${info.titlePath.slice(1).join('-')}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 90)
    await bugShot(page, info, slug)
  })
}

/**
 * Sample photos, avatars and web fonts are blocked by the sandbox proxy
 * anyway; failing them at once keeps each page load fast instead of
 * waiting on the proxy to refuse them.
 */
export async function blockExternalMedia(page: Page) {
  await page.context().route(/^https:\/\/(images\.unsplash\.com|picsum\.photos|fonts\.(googleapis|gstatic)\.com)\//, (route) =>
    route.abort('blockedbyclient'),
  )
}

export type Neighbor = 'Jamie' | 'Maria' | 'Alex' | 'Priya' | 'Jordan' | 'Sam' | 'Nina' | 'Dave'

/**
 * Demo login through the picker. Unlike fixtures.loginAs, it matches the
 * neighbor anywhere in the button name: once a blocked avatar falls back to
 * initials the name reads "JO Jamie Oakley …", not "Jamie Oakley …".
 * Resolves once the app shell is on screen.
 */
export async function login(page: Page, name: Neighbor = 'Jamie', to = '/auth/login') {
  await serveMapAssets(page)
  await blockExternalMedia(page)
  await page.goto(to)
  await page
    .getByRole('group', { name: /pick a sample neighbor/i })
    .getByRole('button', { name: new RegExp(`\\b${name}\\b`) })
    .click()
  await page.getByRole('button', { name: `Log in as ${name}` }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/'))
  // The picker's own navigate() lands right after the redirect: wait for the shell
  await page.getByRole('searchbox', { name: 'Search listings' }).waitFor()
}

/**
 * Client-side navigation (no reload), so in-memory demo data survives.
 * React Router's BrowserRouter listens for popstate.
 */
export async function goInApp(page: Page, path: string, opts: { redirects?: boolean } = {}) {
  const before = await page.title()
  await page.evaluate((p) => {
    window.history.pushState({}, '', p)
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }))
  }, path)
  if (!opts.redirects) await page.waitForURL((url) => `${url.pathname}${url.search}`.startsWith(path.split('#')[0]))
  // Route changes run in a transition: the old page stays up until the new
  // lazy page renders and sets its title. Wait for that (best effort: two
  // pages can share a title).
  await page.waitForFunction((t) => document.title !== t, before, { timeout: 5000 }).catch(() => {})
}

type StoreName =
  | 'users-store'
  | 'listings-store'
  | 'auth-store'
  | 'offers-store'
  | 'agreements-store'

const STORE_EXPORT: Record<StoreName, string> = {
  'users-store': 'useUsersStore',
  'listings-store': 'useListingsStore',
  'auth-store': 'useAuthStore',
  'offers-store': 'useOffersStore',
  'agreements-store': 'useAgreementsStore',
}

/**
 * Read a zustand store's state from the running app. The dev server serves
 * each module once per URL, so this is the same instance the app uses.
 * `pick` runs in the page and must be serializable.
 */
export async function readStore<T>(page: Page, store: StoreName, pick: string): Promise<T> {
  return page.evaluate(
    async ({ store, exportName, pick }) => {
      const mod = await import(/* @vite-ignore */ `/src/stores/${store}.ts`)
      const state = mod[exportName].getState()
       
      return new Function('state', `return (${pick})(state)`)(state)
    },
    { store, exportName: STORE_EXPORT[store], pick },
  )
}

/** Run `mutate(state, store)` inside the page against a store. */
export async function writeStore(page: Page, store: StoreName, mutate: string, arg?: unknown) {
  await page.evaluate(
    async ({ store, exportName, mutate, arg }) => {
      const mod = await import(/* @vite-ignore */ `/src/stores/${store}.ts`)
      const s = mod[exportName]
       
      new Function('store', 'arg', `return (${mutate})(store, arg)`)(s, arg)
    },
    { store, exportName: STORE_EXPORT[store], mutate, arg },
  )
}

/** The signed-in demo user's id. */
export async function currentUserId(page: Page): Promise<string> {
  return readStore<string>(page, 'auth-store', 's => s.currentUserId')
}

// ── Generated images ────────────────────────────────────────────────────────

function crc32(buf: Buffer): number {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

/**
 * A real PNG of the given size: a color field with a diagonal stripe, so
 * crops and orientation are visible in screenshots.
 */
export function makePng(width: number, height: number, rgb: [number, number, number] = [156, 91, 60]): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1)
    raw[row] = 0 // filter: none
    for (let x = 0; x < width; x++) {
      const stripe = Math.abs(x * height - y * width) < Math.max(width, height) * 4
      const o = row + 1 + x * 3
      raw[o] = stripe ? 246 : rgb[0]
      raw[o + 1] = stripe ? 241 : rgb[1]
      raw[o + 2] = stripe ? 235 : rgb[2]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // truecolor
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const PALETTE: [number, number, number][] = [
  [156, 91, 60],
  [77, 106, 98],
  [134, 102, 42],
  [95, 101, 50],
  [64, 58, 52],
  [180, 140, 100],
  [120, 60, 90],
]

/** n distinct PNG files for setInputFiles. */
export function photoFiles(n: number, size = 96) {
  return Array.from({ length: n }, (_, i) => ({
    name: `photo-${i + 1}.png`,
    mimeType: 'image/png',
    buffer: makePng(size + i, size, PALETTE[i % PALETTE.length]),
  }))
}

export const notAPhoto = {
  name: 'notes.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from('This is not a photo.'),
}

/** Natural size of an image URL (blob: or data:) as the page sees it. */
export async function imageSize(page: Page, url: string) {
  return page.evaluate(
    (src) =>
      new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
        img.onerror = () => reject(new Error(`could not load ${src}`))
        img.src = src
      }),
    url,
  )
}

// ── Map ────────────────────────────────────────────────────────────────────

const maplibreDist = path.dirname(
  createRequire(path.join(process.cwd(), 'package.json')).resolve('maplibre-gl/dist/maplibre-gl.css'),
)

/**
 * Agent worktrees (.claude/worktrees/*) share the main checkout's
 * node_modules, which sits outside the dev server's fs.allow list, so the
 * map's `?url` worker import and its CSS come back 403 and MapLibre throws
 * "e.endsWith is not a function" when it starts its workers. Serve those
 * files from disk. Harmless (a pass-through) in a normal checkout.
 */
export async function serveMapAssets(page: Page) {
  await page.context().route(/\/maplibre-gl\/dist\/maplibre-gl-worker\.mjs\?url/, (route) =>
    route.fulfill({ contentType: 'text/javascript', body: 'export default "/__pw-maplibre/maplibre-gl-worker.mjs"' }),
  )
  await page.context().route(/\/maplibre-gl\/dist\/maplibre-gl\.css/, (route) => {
    const css = readFileSync(path.join(maplibreDist, 'maplibre-gl.css'), 'utf8')
    return route.fulfill({
      contentType: 'text/javascript',
      body: `const s=document.createElement('style');s.textContent=${JSON.stringify(css)};document.head.appendChild(s);export default {}`,
    })
  })
  await page.context().route(/\/__pw-maplibre\/maplibre-gl-worker\.mjs/, (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: readFileSync(path.join(maplibreDist, 'maplibre-gl-worker.mjs'), 'utf8'),
    }),
  )
}

/**
 * The basemap (OpenFreeMap) is blocked in the sandbox. Serve a minimal,
 * tile-less style so MapLibre loads and the app can place its pins.
 */
export async function stubMapStyle(page: Page) {
  await page.route('https://tiles.openfreemap.org/**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        version: 8,
        name: 'test',
        sources: {},
        layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f6f1eb' } }],
      }),
    }),
  )
}

/** Fail the map style outright, like an offline device or a host outage. */
export async function blockMapStyle(page: Page) {
  await page.route('https://tiles.openfreemap.org/**', (route) => route.abort('failed'))
}

/** Is the viewport the phone project? */
export const isMobile = (testInfo: TestInfo) => testInfo.project.name === 'mobile'
