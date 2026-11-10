/// <reference lib="dom" />
/**
 * Z-01 Resilience, as far as offline demo mode goes: the connection drops
 * during actions and while moving between pages, and map tiles are blocked.
 * The app must say something friendly and never crash or go blank.
 *
 * Demo mode keeps data in memory, so writes can't fail on the network
 * here; the failure modes we can reach are lazy page chunks, the map and
 * external images.
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import { stabilize, signIn, settle, clientNav, bugShot, isMobile } from './helpers'

test.describe.configure({ timeout: 120_000 })

test.beforeEach(async ({ page }) => {
  await stabilize(page)
  // Vite's dev client reloads the tab when its socket reconnects after the
  // connection drops, which would hide what the app does on its own once
  // it's back online. Proxy the socket through Playwright, outside the
  // page's emulated network, so it never drops (production has no such
  // client).
  await page.routeWebSocket(/./, (ws) => {
    ws.connectToServer()
  })
})

/** Something readable is on screen: not blank, not the browser's error page. */
async function expectFriendly(page: Page) {
  expect(page.url(), 'still on the app, not the browser error page').toMatch(/^http:\/\/localhost/)
  const text = await page.evaluate(() => document.body?.innerText.trim() ?? '')
  expect(text.length, 'page is not blank').toBeGreaterThan(20)
}

test('Z-01 map tiles blocked: browse explains and keeps the list', async ({ page }, testInfo) => {
  await signIn(page)
  await page.goto('/browse')
  if (isMobile(testInfo)) await page.getByRole('button', { name: 'Map view' }).click()
  await expect(page.getByText("Map isn't available right now")).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/list view/i).first()).toBeVisible()
  if (isMobile(testInfo)) await page.getByRole('button', { name: 'List view' }).click()
  await expect(page.getByRole('heading', { name: 'Vintage Record Player' }).first()).toBeVisible()
})

test('Z-01 map library blocked: browse still works', async ({ page }, testInfo) => {
  await page.route(/maplibre-gl/, (r) => r.abort())
  await signIn(page)
  await page.goto('/browse')
  if (isMobile(testInfo)) await page.getByRole('button', { name: 'Map view' }).click()
  await expect(page.getByText("Map isn't available right now")).toBeVisible({ timeout: 20_000 })
  await expectFriendly(page)
})

test('Z-01 offline while making an offer', async ({ page, context }, testInfo) => {
  await signIn(page)
  await page.goto('/listing/listing-004')
  await page.getByRole('button', { name: 'Make an offer', exact: true }).click()
  const d = page.getByRole('dialog')
  await d.getByRole('button', { name: 'Vintage Record Player' }).click()
  await context.setOffline(true)
  await d.getByRole('button', { name: 'Send offer' }).click()
  // Demo writes are local, so the offer goes through; the thread must render
  await page.waitForURL(/\/offers\//)
  await page.waitForTimeout(3_000)
  if (!/^http:\/\/localhost/.test(page.url())) await bugShot(page, testInfo, 'offline-offer-thread')
  await settle(page)
  await expectFriendly(page)
  // The thread's code may not be loaded yet: the offline screen says so,
  // and the thread appears by itself once the connection is back
  const offline = page.getByRole('heading', { level: 1, name: /You're\s*offline/ })
  if (await offline.isVisible()) {
    await expect(page.getByText('Reconnect and try again.', { exact: false })).toBeVisible()
    await context.setOffline(false)
  }
  await expect(page.getByText(/Offer sent/).first()).toBeVisible({ timeout: 20_000 })
  await context.setOffline(false)
})

test('Z-01 offline while chatting and countering', async ({ page, context }) => {
  await signIn(page)
  await page.goto('/offers/offer-001')
  await expect(page.getByRole('button', { name: 'Accept trade' })).toBeVisible({ timeout: 30_000 })
  await context.setOffline(true)
  await page.getByLabel('Message Sam').fill('Still there?')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByText('Still there?').first()).toBeVisible()
  await page.getByRole('button', { name: 'Counter-offer' }).click()
  await settle(page)
  await expectFriendly(page)
  await context.setOffline(false)
})

test('Z-01 offline when moving to a page that has not loaded yet', async ({ page, context }, testInfo) => {
  await signIn(page)
  await page.goto('/dashboard')
  await settle(page)
  await context.setOffline(true)
  // Settings' code hasn't been fetched yet in this tab
  await clientNav(page, '/settings').catch(() => {})
  await page.waitForTimeout(3_000)
  const onApp = /^http:\/\/localhost/.test(page.url())
  if (!onApp) await bugShot(page, testInfo, 'offline-chunk-reload')
  expect(onApp, 'not bounced to the browser offline page').toBe(true)
  // Settings' code can't load: the screen says the connection is the problem
  await expect(page.getByRole('heading', { level: 1, name: /You're\s*offline/ })).toBeVisible()
  await expect(page.getByText(/Reconnect and try again/)).toBeVisible()
  await expectFriendly(page)

  // Try again while still offline: same friendly screen, still on the app
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /You're\s*offline/ })).toBeVisible()
  expect(page.url()).toMatch(/\/settings$/)

  // Back online, the page loads by itself
  await context.setOffline(false)
  await expect(page.getByRole('heading', { level: 1, name: /Settings/ })).toBeVisible({ timeout: 20_000 })

  // And moving on works
  await clientNav(page, '/agreements')
  await expect(page.getByRole('heading', { level: 1, name: 'Trade agreements' })).toBeVisible({ timeout: 20_000 })
})

test('Z-01 offline, Try again loads the page once the connection is back', async ({ page, context }) => {
  // Some browsers miss the "online" event: then Try again is the way back
  await page.addInitScript(() => {
    const add = window.addEventListener.bind(window) as (...args: unknown[]) => void
    window.addEventListener = ((type: string, ...rest: unknown[]) => {
      if (type !== 'online') add(type, ...rest)
    }) as typeof window.addEventListener
  })
  await signIn(page)
  await page.goto('/dashboard')
  await settle(page)
  await context.setOffline(true)
  await clientNav(page, '/agreements')
  await expect(page.getByRole('heading', { level: 1, name: /You're\s*offline/ })).toBeVisible({ timeout: 20_000 })
  await context.setOffline(false)
  await page.waitForTimeout(1_000)
  await expect(page.getByRole('heading', { level: 1, name: /You're\s*offline/ })).toBeVisible()
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Trade agreements' })).toBeVisible({ timeout: 20_000 })
  expect(page.url()).toMatch(/^http:\/\/localhost/)
})

test('Z-01 connection down while the browser says online: offline screen, then Try again', async ({ page }) => {
  await signIn(page)
  await page.goto('/dashboard')
  await settle(page)
  // The page's code and the app itself can't be reached, but navigator.onLine stays true
  const down = (r: import('@playwright/test').Route) => r.abort('internetdisconnected')
  await page.route(/\/src\/pages\/SettingsPage\.tsx/, down)
  await page.route(/\/\?network-check=/, down)
  // Survives anything but a full reload
  await page.evaluate(() => ((window as unknown as { __sameTab?: boolean }).__sameTab = true))
  await clientNav(page, '/settings')
  await expect(page.getByRole('heading', { level: 1, name: /You're\s*offline/ })).toBeVisible({ timeout: 20_000 })
  // Connection back: Try again fetches the page's code again, no reload
  await page.unroute(/\/src\/pages\/SettingsPage\.tsx/)
  await page.unroute(/\/\?network-check=/)
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible({ timeout: 20_000 })
  const sameTab = await page.evaluate(() => (window as unknown as { __sameTab?: boolean }).__sameTab)
  expect(sameTab, 'no full reload').toBe(true)
})

test('Z-01 a page chunk missing after a deploy still reloads once', async ({ page }) => {
  await signIn(page)
  await page.goto('/dashboard')
  await settle(page)
  // Online and the app answers, but this page's old chunk is gone until the
  // tab loads the new build: version skew
  let reloaded = false
  page.on('request', (r) => {
    if (r.isNavigationRequest() && r.frame() === page.mainFrame()) reloaded = true
  })
  await page.route(/\/src\/pages\/SettingsPage\.tsx/, (r) =>
    reloaded ? r.continue() : r.fulfill({ status: 404, body: '' }),
  )
  await page.evaluate(() => ((window as unknown as { __sameTab?: boolean }).__sameTab = true))
  await clientNav(page, '/settings')
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible({ timeout: 30_000 })
  const sameTab = await page.evaluate(() => (window as unknown as { __sameTab?: boolean }).__sameTab)
  expect(sameTab, 'reloaded to pick up the new build').toBeUndefined()
  expect(reloaded).toBe(true)
})

test('Z-01 images that fail to load fall back cleanly', async ({ page }) => {
  await page.unroute(/^https:\/\/(picsum\.photos|images\.unsplash\.com|[^/]*\.supabase\.co\/storage)\//)
  await page.route(/^https:\/\/(picsum\.photos|images\.unsplash\.com)\//, (r) => r.abort())
  await signIn(page)
  await page.goto('/listing/listing-003')
  await settle(page)
  await expectFriendly(page)
  await expect(page.getByRole('heading', { level: 1, name: 'KitchenAid Stand Mixer' })).toBeVisible()
  // Avatars fall back to initials when their photo fails
  await expect(page.getByText(/^DM$/).first()).toBeVisible()
})
