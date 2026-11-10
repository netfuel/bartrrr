/// <reference lib="dom" />
/**
 * Helpers for the trade-flow demo specs (offers, messaging, agreements,
 * notifications).
 *
 * How "the other side" is tested
 * ------------------------------
 * Demo mode keeps all data in memory: every full page load (page.goto,
 * reload, demo login) starts again from the mock data in src/data/. So
 * within one test we:
 *   1. log in once through the demo picker (loginAs), then
 *   2. move around with client-side navigation only (`go`), which keeps the
 *      in-memory stores, and
 *   3. switch the signed-in neighbor in place (`switchTo`) through the auth
 *      store, so the other neighbor sees exactly the state the first one
 *      left behind (offers, agreements, notifications), as two devices
 *      sharing a backend would.
 * The store modules are reached with a dynamic import of
 * /src/stores/index.ts, which the Vite dev server resolves to the same
 * module instances the app uses.
 */
import type { Page } from '@playwright/test'
import { expect } from '../fixtures'

/** Path the dev server serves the stores barrel at (built as a string so
 *  TypeScript doesn't try to resolve it from the test side). */
const STORES = ['', 'src', 'stores', 'index.ts'].join('/')

/** The stores module and its rows, as seen from tests (loosely typed on purpose). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Loose = any

export const USER_IDS = {
  Jamie: 'user-001',
  Maria: 'user-002',
  Alex: 'user-003',
  Priya: 'user-004',
  Jordan: 'user-005',
  Sam: 'user-006',
  Nina: 'user-007',
  Dave: 'user-008',
} as const
export type Neighbor = keyof typeof USER_IDS

export const SHOTS = '/tmp/claude-0/-home-claude/87739abf-99bf-5cc0-842e-f54964f93487/scratchpad/regression/trade'

/**
 * Log in through the demo picker (same steps as fixtures' loginAs) and land
 * on `path` with fresh mock data. It lands on the dashboard rather than the
 * default /browse so the map (out of scope here) never loads: in the dev
 * server it throws a MapLibre worker error that would fail the test.
 */
export async function start(page: Page, who: Neighbor, path = '/dashboard') {
  await page.goto(`/auth/login?returnTo=${encodeURIComponent('/dashboard')}`)
  // Picker buttons read "JO Jamie Oakley Downtown Memphis 4.8" once the
  // avatar falls back to initials (external images are blocked here)
  await page.getByRole('group', { name: /pick a sample neighbor/ }).getByRole('button', { name: new RegExp(`\\b${who} `) }).click()
  await page.getByRole('button', { name: `Log in as ${who}` }).click()
  await page.waitForURL(/\/dashboard$/)
  if (path !== '/dashboard') await go(page, path)
}

/** Client-side navigation: keeps the in-memory demo state (no reload). */
export async function go(page: Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await expect(page).toHaveURL(new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
  await expect(page.locator('main')).toBeVisible()
}

/** Become another demo neighbor without reloading (store state is kept). */
export async function switchTo(page: Page, who: Neighbor, path?: string) {
  await page.evaluate(async ({ id, path }) => {
    const s = await import(/* @vite-ignore */ path)
    s.useAuthStore.getState().login(id)
    s.useAuthStore.getState().markOnboarded(id)
  }, { id: USER_IDS[who], path: STORES })
  if (path) await go(page, path)
}

/**
 * Run a function against the app's stores inside the page. The function is
 * serialized, so it can only use its arguments.
 */
export async function withStores<A, R>(
  page: Page,
  fn: (stores: Loose, arg: A) => R | Promise<R>,
  arg?: A,
): Promise<R> {
  return page.evaluate(
    async ({ src, arg, path }) => {
      const stores = await import(/* @vite-ignore */ path)
      const f = new Function(`return (${src})`)()
      return f(stores, arg)
    },
    { src: fn.toString(), arg: arg as A, path: STORES },
  )
}

/** Wait for a toast with this text. */
export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.getByText(text).first()).toBeVisible()
}

/** Save a screenshot of the current page into the shared bug folder. */
export async function shot(page: Page, name: string, projectName: string) {
  await page.screenshot({ path: `${SHOTS}/${name}-${projectName}.png`, fullPage: false })
}

/** The offer thread's status line (aria-live region). */
export const offerStatus = (page: Page) => page.locator('main [role="status"][aria-live="polite"]')

/** Dismiss any visible toasts (so they can't cover what a test taps next). */
export async function dismissToasts(page: Page) {
  await withStores(page, (s) => {
    for (const t of s.useToastStore.getState().toasts) s.useToastStore.getState().dismissToast(t.id)
  })
}

/** True when the page scrolls sideways (something overflows the viewport). */
export async function hasHorizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
}

/** Style guide §2: sentence case, no em dashes, no exclamation points. */
export function styleProblems(text: string): string[] {
  const problems: string[] = []
  if (text.includes('—')) problems.push(`em dash in "${text}"`)
  if (text.includes('!')) problems.push(`exclamation point in "${text}"`)
  return problems
}

/** Sentence case for a short title: only the first word (and proper nouns) capitalized. */
export function isSentenceCase(title: string, properNouns: string[] = []): boolean {
  const words = title.split(/\s+/).slice(1)
  return words.every((w) => {
    const bare = w.replace(/[^\p{L}'-]/gu, '')
    if (!bare || bare === bare.toLowerCase()) return true
    return properNouns.some((n) => bare.startsWith(n))
  })
}
