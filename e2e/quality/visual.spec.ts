/// <reference lib="dom" />
/**
 * R-02 Visual regression: screenshot baselines for the key screens at
 * desktop and mobile. Anything that changes from run to run is masked:
 * relative times and dates, countdowns, the map and avatars; the hero
 * video is hidden by visual.css so the headline over it stays visible.
 *
 * Baselines are per platform (…-linux.png). Fonts come from the system
 * because Google Fonts is blocked in the test harness, so a CI runner with
 * different system fonts needs one `--update-snapshots` run to regenerate.
 */
import { fileURLToPath } from 'node:url'
import type { Locator, Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import { route, stabilize, visit, signIn, makeOpenOffer } from './helpers'

test.describe.configure({ timeout: 120_000 })

test.beforeEach(async ({ page }) => {
  await stabilize(page)
})

const MONTH = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2}\b/
const WEEKDAY = /\b(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\b/
const RELATIVE = /(\d+\s?(s|m|h|d|w|mo|min|mins|hours?|days?|weeks?|months?) (ago|left)|just now|\bago\b|Expire[sd]|in \d+ (hours?|days?)|Today|Tomorrow|Yesterday|Last active|Member since|Joined)/i

function dynamic(page: Page): Locator[] {
  return [
    page.locator('time'),
    page.getByText(MONTH),
    page.getByText(WEEKDAY),
    page.getByText(RELATIVE),
    page.locator('.maplibregl-map, [aria-label*="map" i][role="region"], [data-testid="map"]'),
    page.locator('img.rounded-full'), // avatar photos
    page.locator('div[aria-live="polite"].fixed > *'), // toasts
  ]
}

const SCREENS: { name: string; go: (page: Page) => Promise<void> }[] = [
  { name: 'landing', go: (p) => visit(p, route('landing')) },
  { name: 'login', go: (p) => visit(p, route('login')) },
  { name: 'signup', go: (p) => visit(p, route('signup')) },
  { name: 'not-found', go: (p) => visit(p, route('not-found')) },
  { name: 'browse', go: (p) => visit(p, route('browse')) },
  { name: 'listing-detail', go: (p) => visit(p, route('listing-detail')) },
  { name: 'new-listing', go: (p) => visit(p, route('new-listing')) },
  { name: 'dashboard', go: (p) => visit(p, route('dashboard')) },
  { name: 'offers-inbox', go: (p) => visit(p, route('offers-inbox')) },
  { name: 'offer-thread', go: (p) => visit(p, route('offer-thread')) },
  { name: 'agreement-detail', go: (p) => visit(p, route('agreement-detail')) },
  { name: 'profile', go: (p) => visit(p, route('profile')) },
  { name: 'settings', go: (p) => visit(p, route('settings')) },
  {
    name: 'withdraw-dialog',
    go: async (p) => {
      await signIn(p)
      await makeOpenOffer(p)
      await p.getByRole('button', { name: 'Withdraw offer' }).click()
      await expect(p.getByRole('dialog')).toBeVisible()
      await p.waitForTimeout(500)
    },
  },
]

for (const s of SCREENS) {
  test(`R-02 ${s.name}`, async ({ page }) => {
    await s.go(page)
    // Park the caret and pointer so focus rings and hovers don't vary
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.())
    await page.mouse.move(0, 0)
    await expect(page).toHaveScreenshot(`${s.name}.png`, {
      mask: dynamic(page),
      animations: 'disabled',
      caret: 'hide',
      stylePath: fileURLToPath(new URL('./visual.css', import.meta.url)),
      maxDiffPixelRatio: 0.02,
      timeout: 20_000,
    })
  })
}
