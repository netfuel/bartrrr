/// <reference lib="dom" />
/**
 * M-01..M-03: messaging in the offer thread.
 * offer-001 (Sam -> Jamie, countered) is open, so it has a composer.
 * Demo data lives in memory, so "after reload" can only be checked for the
 * seeded thread; new messages reaching the server needs a backend.
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import { go, hasHorizontalOverflow, shot, start, switchTo } from './helpers-trade'

// Two-sided journeys run many steps; keep headroom when the dev server is busy
test.describe.configure({ timeout: 60_000 })

const composer = (page: Page, name = 'Message Sam') => page.getByRole('textbox', { name })
const sendBtn = (page: Page) => page.getByRole('button', { name: 'Send message' })
const threadText = (page: Page) => page.locator('main').innerText()

test.describe('M-01 realtime delivery', () => {
  test.skip(true, 'Needs a backend: demo mode has no realtime channel between two browsers')
  test('a message shows up for the other neighbor without a reload', async () => {})
})

test.describe('M-03 push notifications', () => {
  test.skip(true, 'Needs a backend and a push service: demo mode never sends web push')
  test('a new message sends a push to the other neighbor', async () => {})
})

test.describe('M-02 offer thread messages', () => {
  test('send messages; they appear in order for both neighbors', async ({ page }) => {
    await start(page, 'Jamie', '/offers/offer-001')
    for (const text of ['First note from Jamie', 'Second note from Jamie']) {
      await composer(page).fill(text)
      await composer(page).press('Enter')
      await expect(composer(page)).toHaveValue('')
    }
    await composer(page).fill('Third, sent with the button')
    await sendBtn(page).click()
    await expect(page.getByText('Third, sent with the button')).toBeVisible()

    const order = [
      "Hey Jamie! I'd love to trade",
      'The guitar sounds great',
      'Fair enough! How about I add',
      'First note from Jamie',
      'Second note from Jamie',
      'Third, sent with the button',
    ]
    const assertOrder = async () => {
      const text = await threadText(page)
      const idx = order.map((o) => text.indexOf(o))
      expect(idx.every((i) => i >= 0), `all messages present: ${idx}`).toBe(true)
      expect([...idx].sort((a, b) => a - b)).toEqual(idx)
    }
    await assertOrder()

    // Leave and come back: same order
    await go(page, '/offers')
    await go(page, '/offers/offer-001')
    await assertOrder()

    // The other side sees the same thread, marked as Jamie's
    await switchTo(page, 'Sam', '/offers/offer-001')
    await assertOrder()
    await expect(page.getByText('Jamie Oakley', { exact: true }).last()).toBeVisible()
    // Chatting doesn't change whose move it is
    await expect(page.locator('main [role="status"]')).toContainText('Waiting for Jamie to reply.')
  })

  test('empty and whitespace-only messages are refused', async ({ page }) => {
    await start(page, 'Jamie', '/offers/offer-001')
    const before = await threadText(page)
    await expect(sendBtn(page)).toBeDisabled()
    await composer(page).press('Enter')
    await composer(page).fill('    ')
    await expect(sendBtn(page)).toBeDisabled()
    await composer(page).press('Enter')
    await composer(page).fill('\t \t')
    await expect(sendBtn(page)).toBeDisabled()
    expect(await threadText(page)).toBe(before)
    // Leading and trailing spaces are trimmed off a real message
    await composer(page).fill('   padded   ')
    await expect(sendBtn(page)).toBeEnabled()
    await sendBtn(page).click()
    await expect(page.locator('main p').filter({ hasText: /^padded$/ })).toBeVisible()
  })

  test('long text is kept whole and capped at 2,000 characters', async ({ page }) => {
    await start(page, 'Jamie', '/offers/offer-001')
    const long = 'We could meet at the Cossitt Library on Saturday morning. '.repeat(30).trim() // ~1,700 chars
    await composer(page).fill(long)
    await sendBtn(page).click()
    await expect(page.locator('main p').filter({ hasText: long })).toBeVisible()
    expect(await hasHorizontalOverflow(page)).toBe(false)

    await composer(page).fill('x'.repeat(2100))
    await expect(composer(page)).toHaveValue('x'.repeat(2000))
  })

  test('links are shown exactly as typed, as text, not as markup', async ({ page }) => {
    await start(page, 'Jamie', '/offers/offer-001')
    const msg = 'Photos here: https://example.com/a?b=1&c=2 <b>bold?</b>'
    await composer(page).fill(msg)
    await sendBtn(page).click()
    await expect(page.locator('main p').filter({ hasText: msg })).toBeVisible()
    await expect(page.locator('main b')).toHaveCount(0)
  })

  test('a long unbroken link does not push the page sideways', async ({ page }, testInfo) => {
    await start(page, 'Jamie', '/offers/offer-001')
    const url = `https://www.example.com/listings?id=${'abcdef0123'.repeat(16)}`
    await composer(page).fill(`See ${url}`)
    await sendBtn(page).click()
    const bubbleText = page.locator('main p').filter({ hasText: url })
    await expect(bubbleText).toBeVisible()
    // The text must stay inside its bubble and inside the viewport
    const overflow =
      (await hasHorizontalOverflow(page)) ||
      (await bubbleText.evaluate((el) => {
        const bubble = el.parentElement!.getBoundingClientRect()
        const text = el.getBoundingClientRect()
        return el.scrollWidth > el.clientWidth + 1 || text.right > bubble.right + 1 || bubble.right > window.innerWidth
      }))
    if (overflow) await shot(page, 'M-02-long-link-overflow', testInfo.project.name)
    expect(overflow).toBe(false)
  })

  test('the seeded thread keeps its order after a reload', async ({ page }) => {
    await start(page, 'Jamie', '/offers/offer-001')
    await page.reload()
    const text = await threadText(page)
    const idx = ["Hey Jamie! I'd love to trade", 'The guitar sounds great', 'Fair enough! How about I add'].map((o) => text.indexOf(o))
    expect(idx.every((i) => i >= 0)).toBe(true)
    expect([...idx].sort((a, b) => a - b)).toEqual(idx)
  })

  test('messages you send survive a reload', async () => {
    test.skip(true, 'Needs a backend: demo mode keeps sent messages in memory only, so a reload starts from the mock data')
  })

  test('neighbors can still message each other after the offer is accepted', async ({ page }, testInfo) => {
    await start(page, 'Jamie', '/agreements/agreement-001')
    await page.getByRole('link', { name: 'Message Dave' }).click()
    await expect(page).toHaveURL(/\/offers\/offer-002$/)
    try {
      await expect(composer(page, 'Message Dave')).toBeVisible({ timeout: 2000 })
    } catch (e) {
      await shot(page, 'M-02-no-composer-after-accept', testInfo.project.name)
      throw e
    }
    await composer(page, 'Message Dave').fill('Saturday at 10 at Overton Park works for me.')
    await sendBtn(page).click()
    await expect(page.locator('main').getByText('Saturday at 10 at Overton Park works for me.')).toBeVisible()
  })

  test('declined, withdrawn and expired threads have no message box', async ({ page }) => {
    await start(page, 'Sam', '/offers/offer-003') // Sam declined Jordan's offer
    await expect(page.locator('main [role="status"]')).toContainText('You declined this offer.')
    await expect(composer(page, 'Message Jordan')).toHaveCount(0)
  })
})

test.describe('M-04 thread layout on phones', () => {
  /** Top edge of the fixed bar holding the message box and actions. */
  const barTop = async (page: Page) =>
    (await composer(page).locator('xpath=ancestor::div[contains(@class, "fixed")][1]').boundingBox())!.y
  /** Whether `text`'s bubble sits fully between the header and the fixed bar. */
  const inView = (page: Page, locator: ReturnType<Page['locator']>) => async () => {
    const box = await locator.boundingBox()
    if (!box) return false
    return box.y >= 64 && box.y + box.height <= (await barTop(page))
  }

  for (const width of [360, 390]) {
    test(`at ${width}px the status line and newest message clear the fixed bars`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile', 'Phone layout')
      await page.setViewportSize({ width, height: 844 })
      await start(page, 'Jamie', '/offers/offer-001')
      const status = page.locator('main [role="status"]')
      await expect(status).toContainText('Round 2 of 5')
      try {
        await expect.poll(inView(page, status)).toBe(true)
        await expect.poll(inView(page, page.locator('main').getByText('Fair enough! How about I add'))).toBe(true)
      } catch (e) {
        await shot(page, `M-04-thread-${width}-on-load`, testInfo.project.name)
        throw e
      }
      // The bar stays compact: at most a quarter of the screen
      expect(844 - (await barTop(page))).toBeLessThanOrEqual(844 / 4 + 1)

      await composer(page).fill('Could you do Saturday morning instead?')
      await sendBtn(page).click()
      await expect.poll(inView(page, page.locator('main').getByText('Could you do Saturday morning instead?'))).toBe(true)
      expect(await hasHorizontalOverflow(page)).toBe(false)
    })
  }
})
