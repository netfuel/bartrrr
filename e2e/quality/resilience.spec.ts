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

const OFFLINE_BUG =
  "BUG: offline, opening a page whose code isn't loaded yet reloads the tab into the browser's offline error page"

test.beforeEach(async ({ page }) => {
  await stabilize(page)
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
  test.fail(true, OFFLINE_BUG)
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
  await expect(page.getByText(/Offer sent/).first()).toBeVisible()
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
  test.fail(true, OFFLINE_BUG)
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
  // Either the page made it, or the friendly error screen says what to do
  const settingsOrError = page
    .getByRole('heading', { level: 1, name: /Settings/ })
    .or(page.getByRole('heading', { name: /didn't load right/ }))
  await expect(settingsOrError.first()).toBeVisible()
  await expectFriendly(page)

  // Back online, moving on works again
  await context.setOffline(false)
  await clientNav(page, '/agreements')
  await expect(page.getByRole('heading', { level: 1, name: 'Trade agreements' })).toBeVisible({ timeout: 20_000 })
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
