/// <reference lib="dom" />
/**
 * Y-02 Keyboard only: log in, post a listing (photos skipped), make an
 * offer, open and close every dialog with focus trapped inside and
 * returned to its trigger, the skip link if there is one, and a visible
 * focus ring on every element Tab reaches.
 */
import type { Locator, Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import { ROUTES, DIALOGS, stabilize, visit, settle, signIn, makeOpenOffer, bugShot } from './helpers'

test.describe.configure({ timeout: 120_000 })

test.beforeEach(async ({ page }) => {
  await stabilize(page)
})

const isFocused = (l: Locator) => l.evaluate((el) => el === document.activeElement).catch(() => false)

/** Press Tab until `target` has focus. Fails if it isn't reached. */
async function tabTo(page: Page, target: Locator, max = 80) {
  await expect(target).toBeVisible()
  for (let i = 0; i < max; i++) {
    if (await isFocused(target)) return
    await page.keyboard.press('Tab')
  }
  expect(await isFocused(target), `reached ${target} by Tab within ${max} presses`).toBe(true)
}

test('Y-02 log in with the keyboard', async ({ page }) => {
  await page.goto('/auth/login')
  await settle(page)
  const jamie = page.getByRole('button', { name: /Jamie Oakley/ }).first()
  await tabTo(page, jamie)
  await page.keyboard.press('Enter')
  const go = page.getByRole('button', { name: 'Log in as Jamie' })
  await tabTo(page, go)
  await page.keyboard.press('Enter')
  await page.waitForURL((u) => !u.pathname.startsWith('/auth/'))
})

test('Y-02 post a listing with the keyboard (photos skipped)', async ({ page }) => {
  await signIn(page)
  await page.goto('/listing/new')
  await settle(page)
  const next = page.getByRole('button', { name: 'Next' })

  await tabTo(page, next)
  await page.keyboard.press('Enter')

  await tabTo(page, page.getByLabel('Title'))
  await page.keyboard.type('Keyboard-only lamp')
  await tabTo(page, page.getByRole('button', { name: 'Goods', exact: true }))
  await page.keyboard.press('Space')
  await tabTo(page, next)
  await page.keyboard.press('Enter')

  await tabTo(page, page.getByLabel(/I'd trade this for/))
  await page.keyboard.type('Gardening help')
  await tabTo(page, next)
  await page.keyboard.press('Enter')

  await expect(page.getByRole('heading', { name: 'Review your listing' })).toBeVisible()
  await tabTo(page, page.getByRole('button', { name: /Post listing/ }))
  await page.keyboard.press('Enter')
  await page.waitForURL(/\/listing\/(?!new)[^/]+$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Keyboard-only lamp' })).toBeVisible()
})

test('Y-02 make an offer with the keyboard', async ({ page }) => {
  await signIn(page)
  await page.goto('/listing/listing-004')
  await settle(page)
  await tabTo(page, page.getByRole('button', { name: 'Make an offer', exact: true }))
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await tabTo(page, dialog.getByRole('button', { name: 'Vintage Record Player' }), 20)
  await page.keyboard.press('Space')
  await tabTo(page, dialog.getByRole('button', { name: 'Send offer' }), 20)
  await page.keyboard.press('Enter')
  await page.waitForURL(/\/offers\/(?!offer-00)/)
  await expect(page.getByRole('button', { name: 'Withdraw offer' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/Offer sent/).first()).toBeVisible()
})

test.describe('Y-02 dialogs trap focus and return it', () => {
  for (const d of DIALOGS) {
    test(d.name, async ({ page }, testInfo) => {
      await signIn(page, d.as)
      // Get to the page the dialog lives on, then open it from the keyboard
      if (d.name === 'withdraw-offer') await makeOpenOffer(page)
      else {
        await d.open(page)
        await page.keyboard.press('Escape')
        await expect(page.getByRole('dialog')).toHaveCount(0)
      }
      await settle(page)
      const trigger = d.trigger(page)
      await tabTo(page, trigger, 120)
      await page.keyboard.press('Enter')
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()

      const inside = () => dialog.evaluate((el) => el.contains(document.activeElement))
      expect(await inside(), 'focus moves into the dialog').toBe(true)
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press('Tab')
        if (!(await inside())) {
          await bugShot(page, testInfo, `focus-escape-${d.name}`)
          throw new Error(`focus left the ${d.name} dialog after ${i + 1} Tab presses`)
        }
      }
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Shift+Tab')
        expect(await inside(), `Shift+Tab ${i + 1} stays inside`).toBe(true)
      }

      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      expect(await isFocused(trigger), 'focus returns to the trigger').toBe(true)
    })
  }
})

test('Y-02 skip link, if present, jumps to the main content', async ({ page }) => {
  await signIn(page)
  await page.goto('/dashboard')
  await settle(page)
  await page.keyboard.press('Tab')
  const first = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    return { text: el?.textContent?.trim() ?? '', href: el?.getAttribute('href') ?? '' }
  })
  if (!/skip/i.test(first.text)) {
    test.info().annotations.push({
      type: 'note',
      description: `No skip link: first Tab stop is "${first.text}" (${first.href}). Landmarks exist, so this isn't a WCAG failure.`,
    })
    return
  }
  await page.keyboard.press('Enter')
  const inMain = await page.evaluate(() => !!document.activeElement?.closest('main') || document.activeElement?.tagName === 'MAIN')
  expect(inMain).toBe(true)
})

/** Outline, ring (box-shadow), border or background must change on focus. */
async function focusRing(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body) return null
    const read = () => {
      const s = getComputedStyle(el)
      return {
        outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 && s.outlineColor !== 'rgba(0, 0, 0, 0)',
        shadow: s.boxShadow,
        border: s.borderColor,
        bg: s.backgroundColor,
        text: s.textDecorationLine,
      }
    }
    const on = read()
    const describe =
      el.tagName.toLowerCase() +
      (el.id ? `#${el.id}` : '') +
      ` "${(el.getAttribute('aria-label') || el.textContent || (el as HTMLInputElement).placeholder || '').trim().slice(0, 40)}"`
    return { on, describe }
  })
}

test.describe('Y-02 visible focus ring on every Tab stop', () => {
  for (const r of ROUTES.filter((x) => !x.via)) {
    test(r.name, async ({ page }, testInfo) => {
      await visit(page, r, { signedIn: r.auth })
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      const bad: string[] = []
      let checked = 0
      for (let i = 0; i < 60; i++) {
        await page.keyboard.press('Tab')
        // Stop when Tab wraps back to an element already checked
        const again = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null
          if (!el || el === document.body) return false
          if (el.dataset.qaSeen) return true
          el.dataset.qaSeen = '1'
          return false
        })
        if (again) break
        const f = await focusRing(page)
        if (!f) continue
        checked++
        if (f.on.outline) continue
        // Not an outline: compare with the same element unfocused
        const off = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement
          el.blur()
          const s = getComputedStyle(el)
          const v = { shadow: s.boxShadow, border: s.borderColor, bg: s.backgroundColor, text: s.textDecorationLine }
          el.focus({ focusVisible: true } as FocusOptions)
          return v
        })
        const changed =
          off.shadow !== f.on.shadow || off.border !== f.on.border || off.bg !== f.on.bg || off.text !== f.on.text
        if (!changed) bad.push(f.describe)
      }
      testInfo.annotations.push({ type: 'tab-stops', description: `${r.name}: ${checked} checked` })
      expect(checked, 'Tab reaches at least one control').toBeGreaterThan(0)
      if (bad.length) await bugShot(page, testInfo, `focus-ring-${r.name}`)
      expect(bad, `elements without a visible focus indicator on ${r.name}`).toEqual([])
    })
  }
})
