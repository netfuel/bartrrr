/// <reference lib="dom" />
/**
 * S-04 Hostile and unusual input in every free-text field: script tags,
 * 5,000-character strings, emoji and right-to-left text. Each must be
 * saved or refused cleanly, shown back as plain text (never as HTML), and
 * must not break the layout at 390px.
 */
import type { Page, TestInfo } from '@playwright/test'
import { test, expect } from '../fixtures'
import { stabilize, signIn, settle, bugShot, clientNav } from './helpers'

test.describe.configure({ timeout: 120_000 })
test.use({ viewport: { width: 390, height: 844 } })

const PAYLOADS = {
  script: `<script>window.__xss=1</script><img src=x onerror="window.__xss=2"> & "quotes"`,
  // One unbroken 5,000-character token: the hardest case for wrapping
  long: 'Supercalifragilistic'.repeat(250),
  emoji: 'Trade 🛠️🚲🍞 for 👩🏽‍🌾 help 🎸',
  rtl: 'مقابل دراجة هوائية · מכונת כביסה',
} as const
type Kind = keyof typeof PAYLOADS

/** A short, distinctive piece of the payload to look for on the page. */
function probe(kind: Kind, value: string) {
  if (kind === 'long') return value.slice(0, 40)
  if (kind === 'script') return '<script>window.__xss=1</script>'
  return value
}

test.beforeEach(async ({ page }) => {
  await stabilize(page)
  await page.addInitScript(() => {
    ;(window as unknown as { __xss?: number }).__xss = undefined
  })
})

/** Shown as text, nothing injected, nothing wider than the screen. */
async function assertSafe(page: Page, testInfo: TestInfo, name: string, kind: Kind, value: string, shown = true) {
  await settle(page)
  const injected = await page.evaluate(() => ({
    xss: (window as unknown as { __xss?: number }).__xss ?? null,
    img: document.querySelectorAll('img[src="x"]').length,
    scripts: Array.from(document.querySelectorAll('script')).filter((s) => s.textContent?.includes('__xss')).length,
  }))
  expect(injected, 'no HTML injection').toEqual({ xss: null, img: 0, scripts: 0 })

  if (shown) {
    const text = probe(kind, value)
    // Shown as literal text somewhere outside form fields
    // Collapse whitespace: headings may break a name across lines or spans
    const found = await page.evaluate((t) => {
      const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
      return norm(document.body.innerText).includes(norm(t))
    }, text)
    if (!found) await bugShot(page, testInfo, `input-${name}-${kind}-not-shown`)
    expect.soft(found, `${name}: "${text.slice(0, 40)}" shown as plain text`).toBe(true)
  }

  const layout = await page.evaluate(() => {
    const d = document.documentElement
    return { over: d.scrollWidth - d.clientWidth }
  })
  if (layout.over > 1) await bugShot(page, testInfo, `input-${name}-${kind}-overflow`)
  expect.soft(layout.over, `${name}: page wider than 390px after saving ${kind} input`).toBeLessThanOrEqual(1)
}

/** Refused cleanly: a visible validation message, no crash. */
async function refusedCleanly(page: Page) {
  const msg = page.locator('[role="alert"], [aria-invalid="true"], .text-error, [id$="-error"]')
  return (await msg.count()) > 0
}

const kinds = Object.keys(PAYLOADS) as Kind[]

const WRAP_BUG =
  'BUG: long unbroken words (titles, offer items, names, bios) do not wrap and make the page wider than a 390px phone'
/** Field group + payload combinations that hit a reported bug. */
const KNOWN: Record<string, string> = {
  'listing:script': WRAP_BUG,
  'listing:long': WRAP_BUG,
  'offer:long': WRAP_BUG,
  'profile:script': WRAP_BUG,
  'profile:long': WRAP_BUG,
}
const known = (group: string, kind: Kind) => {
  const bug = KNOWN[`${group}:${kind}`]
  test.fail(!!bug, bug)
}

test.describe('S-04 listing title, description and "in return"', () => {
  for (const kind of kinds) {
    test(kind, async ({ page }, testInfo) => {
      known('listing', kind)
      const v = PAYLOADS[kind]
      await signIn(page)
      await page.goto('/listing/new')
      await page.getByRole('button', { name: 'Next' }).click()
      await page.getByLabel('Title').fill(v)
      await page.getByLabel('Description (optional)').fill(v)
      await page.getByRole('button', { name: 'Goods', exact: true }).click()
      await page.getByRole('button', { name: 'Next' }).click()
      await page.getByLabel(/I'd trade this for/).fill(v)
      await page.getByRole('button', { name: 'Next' }).click()
      await assertSafe(page, testInfo, 'listing-review', kind, v)
      await page.getByRole('button', { name: /Post listing/ }).click()
      await page.waitForURL(/\/listing\/(?!new)[^/]+$/)
      await expect(page.getByRole('button', { name: /Edit listing/ }).first()).toBeVisible({ timeout: 20_000 })
      await assertSafe(page, testInfo, 'listing-detail', kind, v)
      // And in the list everyone browses
      await clientNav(page, '/browse')
      await assertSafe(page, testInfo, 'browse', kind, v, false)
    })
  }
})

test.describe('S-04 offer items and message', () => {
  for (const kind of kinds) {
    test(kind, async ({ page }, testInfo) => {
      known('offer', kind)
      const v = PAYLOADS[kind]
      await signIn(page)
      await page.goto('/listing/listing-004')
      await page.getByRole('button', { name: 'Make an offer', exact: true }).click()
      const d = page.getByRole('dialog')
      await d.getByLabel(/Or describe something else|What are you offering/).fill(v)
      await d.getByLabel('Add a message (optional)').fill(v)
      await d.getByRole('button', { name: 'Send offer' }).click()
      await page.waitForURL(/\/offers\/(?!offer-00)/)
      await expect(page.getByRole('button', { name: 'Withdraw offer' })).toBeVisible({ timeout: 20_000 })
      await assertSafe(page, testInfo, 'offer-thread', kind, v)
      await clientNav(page, '/offers')
      await page.getByRole('tab', { name: /Sent/ }).or(page.getByRole('button', { name: /Sent/ })).first().click()
      await assertSafe(page, testInfo, 'offers-inbox', kind, v, false)
    })
  }
})

test.describe('S-04 chat message', () => {
  for (const kind of kinds) {
    test(kind, async ({ page }, testInfo) => {
      const v = PAYLOADS[kind]
      await signIn(page)
      await page.goto('/offers/offer-001')
      const box = page.getByLabel('Message Sam')
      await box.fill(v)
      const kept = await box.inputValue()
      await page.getByRole('button', { name: 'Send message' }).click()
      // The composer caps messages at 2,000 characters: what's kept is what's sent
      await assertSafe(page, testInfo, 'chat', kind, kept)
    })
  }
})

test.describe('S-04 display name and bio', () => {
  for (const kind of kinds) {
    test(kind, async ({ page }, testInfo) => {
      known('profile', kind)
      const v = PAYLOADS[kind]
      await signIn(page)
      await page.goto('/settings')
      // Wait for the form to load Jamie's saved values, or they'd overwrite ours
      await expect(page.getByLabel('Display name')).toHaveValue('Jamie Oakley')
      await settle(page)
      await page.getByLabel('Display name').fill(v)
      await page.getByLabel('Bio').fill(v)
      const name = await page.getByLabel('Display name').inputValue()
      const bio = await page.getByLabel('Bio').inputValue()
      expect(name.length, 'display name took the input').toBeGreaterThan(0)
      await page.getByRole('button', { name: 'Save changes' }).click()
      await settle(page)
      const saved = await page.getByText(/Settings saved|✓ Saved/).first().isVisible()
      if (!saved && (await refusedCleanly(page))) {
        testInfo.annotations.push({ type: 'refused', description: `settings refused ${kind} input with a message` })
        await assertSafe(page, testInfo, 'settings', kind, v, false)
        return
      }
      await assertSafe(page, testInfo, 'settings', kind, v, false)
      // Client-side navigation: a reload would reset the demo's in-memory data
      await clientNav(page, '/profile/me')
      await assertSafe(page, testInfo, 'profile-name', kind, name.trim())
      await assertSafe(page, testInfo, 'profile-bio', kind, bio.trim())
    })
  }
})

test.describe('S-04 flag reason', () => {
  for (const kind of kinds) {
    test(kind, async ({ page }, testInfo) => {
      const v = PAYLOADS[kind]
      await signIn(page, 'Maria')
      await page.goto('/agreements/agreement-002')
      await page.getByRole('button', { name: 'Flag for review' }).click()
      const d = page.getByRole('dialog')
      await d.getByLabel('What went wrong?').fill(v)
      const kept = await d.getByLabel('What went wrong?').inputValue()
      await assertSafe(page, testInfo, 'flag-dialog', kind, v, false)
      await d.getByRole('button', { name: 'Flag trade' }).click()
      await settle(page)
      if (await d.isVisible()) {
        expect(await refusedCleanly(page), 'a visible reason when the flag is refused').toBe(true)
        return
      }
      await expect(page.getByText('Flagged for review').first()).toBeVisible()
      await assertSafe(page, testInfo, 'flagged-agreement', kind, kept.trim())
    })
  }
})

test.describe('S-04 meetup place and notes (special instructions)', () => {
  for (const kind of kinds) {
    test(kind, async ({ page }, testInfo) => {
      const v = PAYLOADS[kind]
      await signIn(page)
      await page.goto('/agreements/agreement-001')
      await page.getByRole('button', { name: 'Edit time and place' }).click()
      await page.getByLabel('Place').fill(v)
      await page.getByLabel('Notes (optional)').fill(v)
      const notes = await page.getByLabel('Notes (optional)').inputValue()
      await page.getByRole('button', { name: 'Save changes' }).click()
      await settle(page)
      if (await page.getByLabel('Notes (optional)').isVisible()) {
        expect(await refusedCleanly(page), 'a visible reason when the details are refused').toBe(true)
        await assertSafe(page, testInfo, 'exchange-form', kind, v, false)
        return
      }
      await assertSafe(page, testInfo, 'agreement-notes', kind, notes.trim())
    })
  }
})
