/// <reference lib="dom" />
import { test, expect as baseExpect } from '../fixtures'
import { LEGAL_UPDATED, LEGAL_CONTACT_EMAIL } from '../../src/lib/legal'
import { captureBugShots } from './helpers-core'

captureBugShots(test)
const expect = baseExpect.configure({ timeout: 10_000 })

/**
 * W-01, W-04 (partial), W-05: public pages, titles and canonical links,
 * legal copy, 404, the goodbye guard and the web app manifest.
 */

const SITE = 'https://bartrrr.app'

test.describe('W-01 public pages', () => {
  test('landing page loads with the brand title, canonical link and a way to join', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle("Bartrrr: Trade, don't buy")
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${SITE}/`)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // Every public page offers a way in
    await expect(page.getByRole('link', { name: /join|sign up|get started|start trading/i }).first()).toBeVisible()
  })

  test('landing "Trading right now" shows sample listings that each have a photo', async ({ page }) => {
    await page.goto('/')
    const section = page.locator('section#listings')
    await expect(section.getByRole('heading', { name: /trading\s*right now/i })).toBeVisible()
    await expect(section.getByText('Sample listings')).toBeVisible()
    const cards = section.locator('a[href^="/listing/"]')
    await expect(cards.first()).toBeVisible()
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThanOrEqual(8)
    for (let i = 0; i < count; i++) {
      await expect(cards.nth(i).locator('img')).toHaveAttribute('src', /^https:\/\//)
    }
  })

  test('landing listings section skips listings without photos', async ({ page }) => {
    // Serve the demo data with the math tutoring listing's photos removed
    await page.route('**/src/data/mock-listings.ts*', async (route) => {
      const res = await route.fetch()
      const body = (await res.text()).replace(
        /images:\s*\[\s*["']https:\/\/images\.unsplash\.com\/photo-1509062522246[^\]]*\]/,
        'images: []',
      )
      expect(body).toContain('images: []')
      await route.fulfill({ response: res, body })
    })
    await page.goto('/')
    const section = page.locator('section#listings')
    await expect(section.locator('a[href^="/listing/"]').first()).toBeVisible()
    await expect(section.getByRole('link', { name: /2 Hours of Math Tutoring/ })).toHaveCount(0)
    await expect(section.locator('a[href^="/listing/"] img:not([src])')).toHaveCount(0)
  })

  test('privacy policy: title, canonical, last updated date and the facts it must state', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page).toHaveTitle('Privacy policy | Bartrrr')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${SITE}/privacy`)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText(`Last updated ${LEGAL_UPDATED}`)).toBeVisible()

    const main = page.getByRole('main')
    // Photo storage with Supabase
    await expect(main).toContainText(/Photos you upload to a listing or your profile are stored with Supabase/)
    await expect(main).toContainText(/Supabase:.*photo storage/)
    // Account emails through Cloudflare Email Service
    await expect(main).toContainText('Cloudflare Email Service')
    // Deletion in Settings, with a link there
    await expect(main).toContainText(/delete your account any time at the bottom of\s+Settings/i)
    await expect(main.getByRole('link', { name: 'Settings' }).first()).toHaveAttribute('href', '/settings')
    await expect(main).toContainText(LEGAL_CONTACT_EMAIL)
    // Links to the other legal page
    await expect(page.getByRole('link', { name: /terms/i }).first()).toBeVisible()
  })

  test('terms of use: title, canonical, last updated date and deletion in Settings', async ({ page }) => {
    await page.goto('/terms')
    await expect(page).toHaveTitle('Terms of use | Bartrrr')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${SITE}/terms`)
    await expect(page.getByText(`Last updated ${LEGAL_UPDATED}`)).toBeVisible()
    const main = page.getByRole('main')
    await expect(main).toContainText(/Settings/)
    await expect(main).toContainText(/delet/i)
    await expect(page.getByRole('link', { name: /privacy/i }).first()).toBeVisible()
  })

  test('in-page section links on the privacy policy jump to their sections', async ({ page }) => {
    await page.goto('/privacy')
    const toc = page.getByRole('navigation', { name: 'On this page' })
    const first = toc.getByRole('link').first()
    const href = await first.getAttribute('href')
    expect(href).toMatch(/^#/)
    await first.click()
    await expect(page).toHaveURL(new RegExp(`${href}$`))
    await expect(page.locator(href!)).toBeInViewport()
  })
})

test.describe('W-04 not found and goodbye', () => {
  test('unknown route shows a friendly 404 that is not indexed', async ({ page }) => {
    await page.goto('/this/does/not/exist')
    await expect(page).toHaveTitle('Page not found | Bartrrr')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('This page')
    await expect(page.getByText('Page not found', { exact: true })).toBeVisible()
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow')
    await expect(page.getByRole('link', { name: 'Browse listings' })).toHaveAttribute('href', '/browse')
    await page.getByRole('link', { name: 'Go to the home page' }).click()
    await expect(page).toHaveURL('/')
  })

  test('visiting /goodbye directly goes to the home page', async ({ page }) => {
    await page.goto('/goodbye')
    await expect(page).toHaveURL('/')
    await expect(page).toHaveTitle("Bartrrr: Trade, don't buy")
    await expect(page.getByText('Thanks for trading')).toHaveCount(0)
  })

  test('app pages are marked noindex', async ({ page }) => {
    await page.goto('/auth/forgot-password')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow')
  })
})

test.describe('W-05 web app manifest', () => {
  test('pages link a manifest that names the app and has icons', async ({ page, request }) => {
    await page.goto('/')
    const link = page.locator('link[rel="manifest"]')
    await expect(link).toHaveAttribute('href', '/manifest.webmanifest')
    const res = await request.get('/manifest.webmanifest')
    expect(res.ok()).toBe(true)
    const manifest = await res.json()
    expect(manifest.short_name).toBe('Bartrrr')
    expect(manifest.start_url).toBe('/')
    expect(manifest.display).toBe('standalone')
    expect(Array.isArray(manifest.icons) && manifest.icons.length).toBeTruthy()
    for (const icon of manifest.icons as { src: string }[]) {
      const iconRes = await request.get(icon.src)
      expect(iconRes.ok(), `icon ${icon.src}`).toBe(true)
    }
  })

  test('theme color in the page matches the manifest', async ({ page, request }) => {
    await page.goto('/')
    const meta = await page.locator('meta[name="theme-color"]').getAttribute('content')
    const manifest = await (await request.get('/manifest.webmanifest')).json()
    expect(meta?.toLowerCase()).toBe(String(manifest.theme_color).toLowerCase())
    // Both are the page's linen (--color-linen), so the splash screen matches the page too
    const body = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(body).toBe('rgb(246, 241, 235)')
    expect(String(manifest.background_color).toLowerCase()).toBe('#f6f1eb')
  })
})
