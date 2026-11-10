/// <reference lib="dom" />
/**
 * Shared setup for the quality layer (layer 6): the route inventory, the
 * dialogs we open, network stubs that make the demo deterministic offline,
 * and a helper that saves evidence screenshots for bugs.
 */
import fs from 'node:fs'
import path from 'node:path'
import { expect, type Locator, type Page, type TestInfo } from '@playwright/test'
import { loginAs, type DemoNeighbor } from '../fixtures'

/** Where bug evidence goes (outside the repo). Override with QUALITY_BUG_DIR. */
export const BUG_DIR =
  process.env.QUALITY_BUG_DIR ??
  '/tmp/claude-0/-home-claude/87739abf-99bf-5cc0-842e-f54964f93487/scratchpad/regression/quality'

export interface RouteSpec {
  /** Short stable name, used in test titles and screenshot names */
  name: string
  path: string
  /** Signed in as Jamie (demo) before visiting */
  auth: boolean
  /** Login and signup redirect a signed-in neighbor away */
  signedOutOnly?: boolean
  /** Something that shows the page has rendered */
  ready?: (page: Page) => Locator
  /** Reach this route by doing something first (no direct URL) */
  via?: (page: Page) => Promise<void>
}

/**
 * Every route in the regression plan. IDs come from the demo data:
 * listing-003 is Dave's mixer (not Jamie's), listing-001 is Jamie's record
 * player, offer-001 is Sam's counter-offer to Jamie (Jamie's turn),
 * agreement-001 is Jamie and Dave's agreement waiting on Dave's signature.
 */
const h1 = (name: RegExp) => (page: Page) => page.getByRole('heading', { level: 1, name }).first()
const heading = (name: RegExp) => (page: Page) => page.getByRole('heading', { name }).first()

export const ROUTES: RouteSpec[] = [
  { name: 'landing', path: '/', auth: false, ready: h1(/Trade/) },
  { name: 'login', path: '/auth/login', auth: false, signedOutOnly: true, ready: h1(/Welcome back/) },
  { name: 'signup', path: '/auth/signup', auth: false, signedOutOnly: true, ready: h1(/Join your neighbors/) },
  { name: 'privacy', path: '/privacy', auth: false, ready: h1(/What we keep/) },
  { name: 'terms', path: '/terms', auth: false, ready: h1(/./) },
  { name: 'not-found', path: '/this-page-does-not-exist', auth: false, ready: h1(/wandered off/) },
  { name: 'goodbye', path: '/goodbye', auth: true, ready: h1(/Thanks for trading/), via: viaDeleteAccount },
  { name: 'onboarding', path: '/onboarding', auth: true, ready: h1(/Welcome, Jamie/) },
  { name: 'browse', path: '/browse', auth: true, ready: heading(/Vintage Record Player/) },
  { name: 'feed', path: '/feed', auth: true, ready: h1(/What's happening/) },
  { name: 'listing-detail', path: '/listing/listing-003', auth: true, ready: h1(/KitchenAid Stand Mixer/) },
  { name: 'new-listing', path: '/listing/new', auth: true, ready: h1(/Post a listing/) },
  { name: 'edit-listing', path: '/listing/listing-001/edit', auth: true, ready: h1(/Edit listing/) },
  { name: 'dashboard', path: '/dashboard', auth: true, ready: h1(/Welcome back, Jamie/) },
  { name: 'offers-inbox', path: '/offers', auth: true, ready: h1(/^Offers$/) },
  {
    name: 'offer-thread',
    path: '/offers/offer-001',
    auth: true,
    ready: (page) => page.getByRole('button', { name: 'Accept trade' }),
  },
  { name: 'agreements', path: '/agreements', auth: true, ready: h1(/Trade agreements/) },
  { name: 'agreement-detail', path: '/agreements/agreement-001', auth: true, ready: heading(/When and where/) },
  { name: 'profile', path: '/profile/me', auth: true, ready: h1(/Jamie Oakley/) },
  { name: 'settings', path: '/settings', auth: true, ready: h1(/Settings/) },
]

export const route = (name: string) => {
  const r = ROUTES.find((x) => x.name === name)
  if (!r) throw new Error(`unknown route ${name}`)
  return r
}

// 1×1 warm-grey PNG served for every external image, so screenshots and
// layout don't depend on picsum/unsplash being reachable.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN49+7dfwAJ4QPq3S9cwgAAAABJRU5ErkJggg==',
  'base64',
)

/**
 * Makes the demo deterministic offline:
 * - external images get a fixed pixel, web fonts and map tiles are refused
 *   (the sandbox can't reach them; CI might, which would make runs differ)
 * - works around a Vite dev-server quirk where `maplibre-gl-worker.mjs?url`
 *   is served as the worker's source instead of `export default "<url>"`,
 *   which makes maplibre throw `e.endsWith is not a function` (dev only;
 *   production builds emit the asset URL correctly). Reported as a bug.
 */
export async function stabilize(page: Page, opts: { blockMap?: boolean } = {}) {
  await page.route(/^https:\/\/(picsum\.photos|images\.unsplash\.com|[^/]*\.supabase\.co\/storage)\//, (r) =>
    r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }),
  )
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (r) => r.abort())
  await page.route(/^https:\/\/tiles\.openfreemap\.org\//, (r) => r.abort())
  await page.route(/maplibre-gl-worker\.mjs\?url$/, (r) => {
    const url = new URL(r.request().url())
    return r.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: `export default ${JSON.stringify(url.pathname)}`,
    })
  })
  if (opts.blockMap) await page.route(/maplibre-gl/, (r) => r.abort())
}

/** Sign in through the demo picker. */
export async function signIn(page: Page, who: DemoNeighbor = 'Jamie') {
  await loginAs(page, who)
}

/** Visit a route (signing in first if needed) and wait for it to render. */
export async function visit(page: Page, r: RouteSpec, opts: { signedIn?: boolean } = {}) {
  const signedIn = opts.signedIn ?? r.auth
  if (signedIn) await signIn(page)
  if (r.via) await r.via(page)
  else await page.goto(r.path)
  if (r.ready) await expect(r.ready(page)).toBeVisible({ timeout: 30_000 })
  await settle(page)
}

/**
 * Navigate inside the single-page app without reloading. The demo keeps
 * its data in memory, so page.goto() would throw away what a test just made.
 */
export async function clientNav(page: Page, to: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, to)
  await page.waitForURL((u) => u.pathname === to)
}

/** Let lazy chunks, fonts and entrance animations finish. */
export async function settle(page: Page) {
  await page.waitForLoadState('domcontentloaded')
  await page.evaluate(() => document.fonts?.ready)
  await expect(page.getByRole('status', { name: 'Loading' })).toHaveCount(0, { timeout: 30_000 })
  await page.waitForTimeout(400)
}

/** Settings → Delete account → type DELETE: the only way to reach /goodbye. */
async function viaDeleteAccount(page: Page) {
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Delete account' }).click()
  const dialog = page.getByRole('dialog')
  // Jamie signs in with a password; the demo accepts any
  await dialog.getByLabel('Your password').fill('demo-password')
  await dialog.getByLabel(/Type DELETE to confirm/).fill('DELETE')
  await dialog.getByRole('button', { name: 'Delete account' }).click()
  await page.waitForURL('**/goodbye')
}

export interface DialogSpec {
  name: string
  /** Who opens it (demo neighbor) */
  as: DemoNeighbor
  /** Navigate and open the dialog; resolves with the trigger button */
  open: (page: Page) => Promise<void>
  /** The trigger, to check focus returns there */
  trigger: (page: Page) => ReturnType<Page['getByRole']>
}

/** Make an offer on Sam's bike tune-up so Jamie has an open offer to withdraw. */
export async function makeOpenOffer(page: Page) {
  await page.goto('/listing/listing-004')
  await page.getByRole('button', { name: 'Make an offer', exact: true }).click()
  const d = page.getByRole('dialog')
  await d.getByRole('button', { name: 'Vintage Record Player' }).click()
  await d.getByRole('button', { name: 'Send offer' }).click()
  await page.waitForURL(/\/offers\/(?!offer-00)/)
  // The URL changes before the thread's lazy chunk renders
  await expect(page.getByRole('button', { name: 'Withdraw offer' })).toBeVisible({ timeout: 20_000 })
  await settle(page)
}

export const DIALOGS: DialogSpec[] = [
  {
    name: 'make-offer',
    as: 'Jamie',
    open: async (page) => {
      await page.goto('/listing/listing-004')
      await page.getByRole('button', { name: 'Make an offer', exact: true }).click()
    },
    trigger: (page) => page.getByRole('button', { name: 'Make an offer', exact: true }),
  },
  {
    name: 'withdraw-offer',
    as: 'Jamie',
    open: async (page) => {
      await makeOpenOffer(page)
      await page.getByRole('button', { name: 'Withdraw offer' }).click()
    },
    trigger: (page) => page.getByRole('button', { name: 'Withdraw offer' }),
  },
  {
    name: 'accept-trade',
    as: 'Jamie',
    open: async (page) => {
      await page.goto('/offers/offer-001')
      await page.getByRole('button', { name: 'Accept trade' }).click()
    },
    trigger: (page) => page.getByRole('button', { name: 'Accept trade' }),
  },
  {
    name: 'decline-offer',
    as: 'Jamie',
    open: async (page) => {
      await page.goto('/offers/offer-001')
      await page.getByRole('button', { name: 'Decline', exact: true }).click()
    },
    trigger: (page) => page.getByRole('button', { name: 'Decline', exact: true }),
  },
  {
    name: 'take-down-listing',
    as: 'Jamie',
    open: async (page) => {
      await page.goto('/listing/listing-001')
      await page.getByRole('button', { name: /Take down/ }).first().click()
    },
    trigger: (page) => page.getByRole('button', { name: /Take down/ }).first(),
  },
  {
    name: 'cancel-trade',
    as: 'Jamie',
    open: async (page) => {
      await page.goto('/agreements/agreement-001')
      await page.getByRole('button', { name: 'Cancel trade' }).click()
    },
    trigger: (page) => page.getByRole('button', { name: 'Cancel trade' }),
  },
  {
    name: 'flag-trade',
    as: 'Maria',
    open: async (page) => {
      await page.goto('/agreements/agreement-002')
      await page.getByRole('button', { name: 'Flag for review' }).click()
    },
    trigger: (page) => page.getByRole('button', { name: 'Flag for review' }),
  },
  {
    name: 'mark-done',
    as: 'Maria',
    open: async (page) => {
      await page.goto('/agreements/agreement-002')
      await page.getByRole('button', { name: /We made the swap|Mark as done/i }).click()
    },
    trigger: (page) => page.getByRole('button', { name: /We made the swap|Mark as done/i }),
  },
  {
    name: 'delete-account',
    as: 'Jamie',
    open: async (page) => {
      await page.goto('/settings')
      await page.getByRole('button', { name: 'Delete account' }).click()
    },
    trigger: (page) => page.getByRole('button', { name: 'Delete account' }),
  },
]

/** Save a full-page screenshot as bug evidence and attach it to the report. */
export async function bugShot(page: Page, testInfo: TestInfo, name: string) {
  fs.mkdirSync(BUG_DIR, { recursive: true })
  const file = path.join(BUG_DIR, `${name}-${testInfo.project.name}.png`)
  await page.screenshot({ path: file, fullPage: false }).catch(() => {})
  await testInfo.attach(name, { path: file, contentType: 'image/png' }).catch(() => {})
  return file
}

export const isMobile = (testInfo: TestInfo) => testInfo.project.name === 'mobile'
