/// <reference lib="dom" />
import type { Page } from '@playwright/test'
import { test, expect as baseExpect } from '../fixtures'
import { captureBugShots, goInApp, isMobile, login } from './helpers-core'

/**
 * N-01 phone navigation (T-46/T-40): the bottom bar carries the trade loop
 * (Dashboard, Browse, Post, Offers, Agreements); the header avatar leads to
 * your profile, which has Edit profile (Settings) and Log out. Everything a
 * neighbor needs is at most 2 taps from any screen.
 * N-02 desktop: the sidebar keeps Settings, and your profile has Log out too.
 */

captureBugShots(test)
const expect = baseExpect.configure({ timeout: 10_000 })

const bar = (page: Page) => page.locator('nav[aria-label="Main navigation"]')
const avatar = (page: Page) => page.getByRole('banner').getByRole('link', { name: 'Your profile' })

test.describe('N-01 phone navigation', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, testInfo) => {
    test.skip(!isMobile(testInfo), 'Phone layout only')
  })

  test('the bottom bar has five items with 44px touch targets', async ({ page }) => {
    await login(page, 'Jamie')
    const links = bar(page).getByRole('link')
    await expect(links).toHaveCount(5)
    await expect(links).toHaveText(['Dashboard', 'Browse', 'Post a listing', 'Offers', 'Agreements'], { useInnerText: true })
    for (const box of await links.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
    const a = await avatar(page).boundingBox()
    expect(a!.width).toBeGreaterThanOrEqual(44)
    expect(a!.height).toBeGreaterThanOrEqual(44)
    // Nothing spills sideways at phone width
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })

  test('Dashboard and Agreements are one tap away', async ({ page }) => {
    await login(page, 'Jamie')
    await bar(page).getByRole('link', { name: 'Dashboard' }).click()
    await expect(page).toHaveURL('/dashboard')
    await expect(page.getByRole('heading', { level: 1, name: /Welcome back/ })).toBeVisible()
    await expect(bar(page).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')

    await bar(page).getByRole('link', { name: 'Agreements' }).click()
    await expect(page).toHaveURL('/agreements')
    await expect(bar(page).getByRole('link', { name: 'Agreements' })).toHaveAttribute('aria-current', 'page')

    await bar(page).getByRole('link', { name: 'Offers' }).click()
    await expect(page).toHaveURL('/offers')
  })

  test('Settings is two taps away: your profile, then Edit profile', async ({ page }) => {
    await login(page, 'Jamie')
    await goInApp(page, '/agreements')
    await avatar(page).click()
    await expect(page).toHaveURL('/profile/me')
    await expect(page.getByRole('heading', { level: 1, name: 'Jamie Oakley' })).toBeVisible()
    await page.getByRole('main').getByRole('link', { name: 'Edit profile' }).click()
    await expect(page).toHaveURL('/settings')
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  })

  test('Log out is two taps away and signs you out', async ({ page }) => {
    await login(page, 'Jamie')
    await avatar(page).click()
    await page.getByRole('main').getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL('/auth/login')
    await goInApp(page, '/dashboard', { redirects: true })
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('the feed is one tap from Browse, and Browse stays lit there', async ({ page }) => {
    await login(page, 'Jamie')
    await page.getByRole('link', { name: 'Neighborhood feed' }).click()
    await expect(page).toHaveURL('/feed')
    await expect(page.getByRole('heading', { level: 1, name: /What's happening in/ })).toBeVisible()
    await expect(bar(page).getByRole('link', { name: 'Browse' })).toHaveClass(/text-ink/)
  })

  test('the header search has a hint that fits', async ({ page }) => {
    // T-61: "Search listings or neighborhoods" was cut to "Search listi"
    await login(page, 'Jamie')
    const search = page.getByRole('searchbox', { name: 'Search listings' })
    await expect(search).toHaveAttribute('placeholder', 'Search')
    const fits = await search.evaluate((el) => {
      const input = el as HTMLInputElement
      const cs = getComputedStyle(input)
      const ctx = document.createElement('canvas').getContext('2d')!
      ctx.font = `${cs.fontSize} ${cs.fontFamily}`
      const room = input.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      return ctx.measureText(input.placeholder).width <= room
    })
    expect(fits).toBe(true)
  })

  test('toasts stay clear of the header, the bottom bar and the offer action bar', async ({ page }) => {
    // T-44: toasts sat over the search box and bell for 5 s, catching taps
    const overlaps = async (a: string, b: string) => {
      const boxes = await Promise.all([a, b].map((s) => page.locator(s).first().boundingBox()))
      const [p, q] = boxes as { x: number; y: number; width: number; height: number }[]
      return p.y < q.y + q.height && q.y < p.y + p.height && p.x < q.x + q.width && q.x < p.x + p.width
    }
    const toast = '[aria-live="polite"] > [role="status"]'
    await login(page, 'Jamie')
    await goInApp(page, '/settings')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.locator(toast).filter({ hasText: 'Settings saved.' })).toBeVisible()
    // Still announced: inside the polite live region, as a status
    await expect(page.locator('[aria-live="polite"]').getByRole('status')).toHaveText(/Settings saved\./)
    expect(await overlaps(toast, 'header')).toBe(false)
    expect(await overlaps(toast, 'nav[aria-label="Main navigation"]')).toBe(false)
    // The header's search and bell take taps while the toast is up
    await page.getByRole('button', { name: /^Notifications/ }).click()
    await expect(page.getByRole('button', { name: /^Notifications/ })).toHaveAttribute('aria-expanded', 'true')

    // An offer thread: its Accept / Counter-offer bar stays uncovered
    await goInApp(page, '/offers')
    const thread = page.getByRole('main').locator('a[href^="/offers/"]').first()
    await goInApp(page, (await thread.getAttribute('href'))!)
    const actionBar = page.getByRole('main').locator('div.fixed').first()
    await expect(actionBar).toBeVisible()
    await page.evaluate(async (path) => {
      const mod = await import(/* @vite-ignore */ path)
      mod.showToast('Message sent.', 'success')
    }, '/src/stores/toast-store.ts')
    await expect(page.locator(toast).filter({ hasText: 'Message sent.' })).toBeVisible()
    const barTop = (await actionBar.boundingBox())!.y
    // Polls past the toast's rise-in animation
    await expect
      .poll(async () => {
        const b = (await page.locator(toast).last().boundingBox())!
        return b.y + b.height <= barTop
      })
      .toBe(true)
  })
})

test.describe('N-02 own profile and desktop sidebar', () => {
  test('your own profile has Edit profile and Log out; a neighbor’s does not', async ({ page }) => {
    await login(page, 'Jamie')
    await goInApp(page, '/profile/me')
    const main = page.getByRole('main')
    await expect(main.getByRole('link', { name: 'Edit profile' })).toHaveAttribute('href', '/settings')
    await expect(main.getByRole('button', { name: 'Log out' })).toBeVisible()
    await goInApp(page, '/profile/priya_green')
    await expect(page.getByRole('heading', { level: 1, name: /Priya/ })).toBeVisible()
    await expect(main.getByRole('link', { name: 'Edit profile' })).toHaveCount(0)
    await expect(main.getByRole('button', { name: 'Log out' })).toHaveCount(0)
  })

  test('T-70: /profile opens your own profile', async ({ page }) => {
    await login(page, 'Jamie')
    await page.goto('/profile')
    await expect(page).toHaveURL('/profile/me')
    await expect(page.getByRole('heading', { level: 1, name: 'Jamie Oakley' })).toBeVisible()
    await expect(page.getByText('Page not found')).toHaveCount(0)
    // In the app too, and with a trailing slash
    await goInApp(page, '/profile/', { redirects: true })
    await expect(page).toHaveURL('/profile/me')
  })

  test('T-70: /profile signed out asks you to log in, then opens your profile', async ({ page }) => {
    await page.goto('/profile')
    await expect(page).toHaveURL('/auth/login?returnTo=%2Fprofile')
    await page.getByRole('button', { name: 'Log in as Jamie' }).click()
    await expect(page).toHaveURL('/profile/me')
    await expect(page.getByRole('heading', { level: 1, name: 'Jamie Oakley' })).toBeVisible()
  })

  test('desktop: the sidebar has Settings, and Log out works from your profile', async ({ page }, testInfo) => {
    test.skip(isMobile(testInfo), 'Desktop sidebar only')
    await login(page, 'Jamie')
    const sidebar = page.locator('aside[aria-label="Main navigation"]')
    await expect(sidebar.getByRole('link', { name: 'Settings' })).toBeVisible()
    for (const name of ['Dashboard', 'Browse', 'Feed', 'Offers', 'Agreements', 'Profile']) {
      await expect(sidebar.getByRole('link', { name, exact: true })).toBeVisible()
    }
    await sidebar.getByRole('link', { name: 'Profile', exact: true }).click()
    await page.getByRole('main').getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL('/auth/login')
  })
})
