/**
 * N-01: in-app notifications (bell, unread count, mark read, wording, links).
 *
 * Demo mode starts with no notifications; each one is produced by the other
 * neighbor doing the real action in the UI, then we switch to the recipient
 * in place (see helpers-trade.ts) and open the bell.
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import { DECLINE_REASON_LABELS } from '../../src/types'
import {
  dismissToasts,
  go,
  isSentenceCase,
  shot,
  start,
  styleProblems,
  switchTo,
  withStores,
  USER_IDS,
  type Loose,
} from './helpers-trade'

const NAMES = ['Jamie', 'Maria', 'Alex', 'Priya', 'Jordan', 'Sam', 'Nina', 'Dave', 'Bartrrr', 'Memphis']

const bell = (page: Page) => page.getByRole('button', { name: /^Notifications/ })
const panel = (page: Page) => page.getByRole('region', { name: 'Notifications' })

async function openBell(page: Page) {
  await dismissToasts(page) // toasts sit over the header on phones
  if ((await panel(page).count()) === 0) await bell(page).click()
  await expect(panel(page)).toBeVisible()
}

/** Check one notification in the bell, click it, and land on `path`. */
async function checkAndFollow(page: Page, title: string, body: string | RegExp, path: RegExp) {
  await openBell(page)
  const item = panel(page).getByRole('link').filter({ hasText: title }).filter({ hasText: body }).first()
  await expect(item).toBeVisible()
  await item.click()
  await expect(page).toHaveURL(path)
  await expect(panel(page)).toHaveCount(0)
}

/** Every notification for this neighbor follows style guide §2. */
async function expectStyle(page: Page, who: keyof typeof USER_IDS) {
  const list = await withStores(page, (s, id) =>
    s.useNotificationsStore.getState().notifications.filter((n: Loose) => n.userId === id).map((n: Loose) => ({ title: n.title, body: n.body })),
  USER_IDS[who])
  expect(list.length).toBeGreaterThan(0)
  for (const n of list) {
    expect(styleProblems(n.title), n.title).toEqual([])
    expect(styleProblems(n.body), n.body).toEqual([])
    expect(isSentenceCase(n.title, NAMES), `sentence case: "${n.title}"`).toBe(true)
  }
}

/** Types of this neighbor's notifications with a given title. */
async function typesOf(page: Page, who: keyof typeof USER_IDS, title: string): Promise<string[]> {
  return withStores(page, (s, [id, t]) =>
    s.useNotificationsStore.getState().notifications
      .filter((n: Loose) => n.userId === id && n.title === t)
      .map((n: Loose) => n.type as string),
  [USER_IDS[who], title] as const)
}

async function makeOffer(page: Page, listingPath: string, item: string) {
  await go(page, listingPath)
  await page.getByRole('button', { name: 'Make an offer', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: /Or describe something else|What are you offering\?/ }).fill(item)
  await dialog.getByRole('button', { name: 'Send offer' }).click()
  await expect(page).toHaveURL(/\/offers\/offer-/)
  return new URL(page.url()).pathname
}

test.describe('N-01 notifications', () => {
  // Long two-sided journeys: each step is quick but there are many
  test.describe.configure({ timeout: 90_000 })

  test('bell shows the unread count; reading one or all clears it', async ({ page }) => {
    await start(page, 'Jamie')
    await expect(bell(page)).toHaveAccessibleName('Notifications')
    await openBell(page)
    await expect(panel(page)).toContainText("You're all caught up.")
    await expect(panel(page)).toContainText('New offers, messages, and trade updates will show up here.')
    await bell(page).click()

    // Two neighbors make offers on Jamie's listings
    await switchTo(page, 'Priya')
    await makeOffer(page, '/listing/listing-013', 'Seedlings')
    await switchTo(page, 'Alex')
    await makeOffer(page, '/listing/listing-001', 'Shelf repair')

    await switchTo(page, 'Jamie', '/dashboard')
    await expect(bell(page)).toHaveAccessibleName('Notifications, 2 unread')
    await expect(bell(page)).toContainText('2')

    // Opening the bell doesn't mark anything read; following one does
    await openBell(page)
    await expect(bell(page)).toHaveAccessibleName('Notifications, 2 unread')
    await checkAndFollow(page, 'New offer on your listing', 'Priya Patel wants to trade for your Raised Garden Bed Kit. Take a look.', /\/offers\/offer-/)
    await expect(bell(page)).toHaveAccessibleName('Notifications, 1 unread')

    await openBell(page)
    await panel(page).getByRole('button', { name: 'Mark all as read' }).click()
    await expect(bell(page)).toHaveAccessibleName('Notifications')
    await expect(panel(page).getByRole('button', { name: 'Mark all as read' })).toHaveCount(0)
    await expect(panel(page).getByRole('link')).toHaveCount(2) // still listed, just read
    await panel(page).getByRole('button', { name: 'Close' }).click()
    await expect(panel(page)).toHaveCount(0)
  })

  test('offer notifications: wording and links', async ({ page }) => {
    // New offer
    await start(page, 'Priya')
    const offerPath = await makeOffer(page, '/listing/listing-013', 'Seedlings')
    const offerRe = new RegExp(`${offerPath}$`)
    await switchTo(page, 'Jamie', '/dashboard')
    await checkAndFollow(page, 'New offer on your listing', 'Priya Patel wants to trade for your Raised Garden Bed Kit. Take a look.', offerRe)

    // Counter-offer and message, to Priya
    await page.getByRole('button', { name: 'Counter-offer', exact: true }).click()
    await page.getByRole('textbox', { name: /instead\?/ }).fill('Seedlings\nCompost')
    await page.getByRole('button', { name: 'Send counter-offer' }).click()
    await page.getByRole('textbox', { name: 'Message Priya' }).fill('Can you add compost?')
    await page.getByRole('button', { name: 'Send message' }).click()
    await expectStyle(page, 'Priya')
    await switchTo(page, 'Priya', '/dashboard')
    await expect(bell(page)).toHaveAccessibleName('Notifications, 2 unread')
    await checkAndFollow(page, 'New message', 'Jamie Oakley: Can you add compost?', offerRe)
    await go(page, '/dashboard')
    await checkAndFollow(page, 'New counter-offer', 'Jamie Oakley suggested a change to your trade. Take a look.', offerRe)

    // Accepted, to Jamie
    await page.getByRole('button', { name: 'Accept trade' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Accept trade' }).click()
    await switchTo(page, 'Jamie', '/dashboard')
    await checkAndFollow(page, 'Offer accepted', 'Priya Patel accepted the trade. Next: review and sign the trade agreement.', offerRe)
    await expect(page.getByRole('button', { name: 'Review and sign agreement' })).toBeVisible()
    await expectStyle(page, 'Jamie')

    // Declined, to Sam, with the reason in words
    await go(page, '/offers/offer-001')
    await page.getByRole('button', { name: 'Decline' }).click()
    await page.getByRole('dialog').getByRole('button', { name: DECLINE_REASON_LABELS.looking_for_specific }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Decline offer' }).click()
    await switchTo(page, 'Sam', '/dashboard')
    await checkAndFollow(
      page,
      'Offer declined',
      `Jamie Oakley declined your offer. Their reason: “${DECLINE_REASON_LABELS.looking_for_specific}”`,
      /\/offers\/offer-001$/,
    )
    await expectStyle(page, 'Sam')
  })

  test('withdrawn offer notifies the listing owner', async ({ page }) => {
    await start(page, 'Sam', '/dashboard')
    await page.getByRole('tab', { name: /Offers sent/ }).click()
    await page.getByRole('button', { name: 'Withdraw offer to Jamie' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Withdraw offer' }).click()
    await switchTo(page, 'Jamie', '/dashboard')
    await checkAndFollow(page, 'Offer withdrawn', 'Sam Nguyen withdrew their offer on your Vintage Record Player.', /\/offers\/offer-001$/)
    await expect(page.locator('main [role="status"]')).toContainText('Sam withdrew this offer.')
    await expectStyle(page, 'Jamie')
    // T-04: its own type, not offer_declined
    expect(await typesOf(page, 'Jamie', 'Offer withdrawn')).toEqual(['offer_withdrawn'])
  })

  test('agreement notifications: wording and links', async ({ page }) => {
    const agreementRe = /\/agreements\/agreement-001$/
    // Details changed, to Dave
    await start(page, 'Jamie', '/agreements/agreement-001')
    await page.getByRole('button', { name: 'Edit time and place' }).click()
    await page.getByRole('textbox', { name: 'Place' }).fill('Poplar Library')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await switchTo(page, 'Dave', '/dashboard')
    await checkAndFollow(page, 'Trade details changed', 'Jamie changed the time and place. Review the agreement and sign again.', agreementRe)

    // Dave signs, then Jamie signs: both told
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Sign agreement' }).click()
    await switchTo(page, 'Jamie', '/dashboard')
    await openBell(page)
    await expect(panel(page).getByRole('link').first()).toContainText('Your turn to sign')
    await expect(panel(page).getByRole('link').first()).toContainText('Your neighbor signed the trade agreement. Review it and sign to lock in the trade.')
    await panel(page).getByRole('link').first().click()
    await expect(page).toHaveURL(agreementRe)
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Sign agreement' }).click()

    // Jamie marks it done, to Dave
    await page.getByRole('button', { name: 'We made the swap' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Yes, we swapped' }).click()
    await switchTo(page, 'Dave', '/dashboard')
    await checkAndFollow(page, 'Trade complete', 'Jamie Oakley marked your trade as done. How did it go? Leave a review.', agreementRe)

    // Dave reviews, to Jamie
    await page.getByRole('radio', { name: '5 stars' }).click()
    await page.getByRole('button', { name: 'Post review' }).click()
    await expectStyle(page, 'Dave')
    await switchTo(page, 'Jamie', '/dashboard')
    await checkAndFollow(page, 'New review', 'Dave Morrison left you a review.', agreementRe)
    await expectStyle(page, 'Jamie')
  })

  test('canceled and flagged trades notify the other neighbor', async ({ page }) => {
    await start(page, 'Maria', '/agreements/agreement-002')
    await page.getByRole('button', { name: 'Flag for review' }).click()
    await page.getByRole('dialog').getByRole('textbox', { name: 'What went wrong?' }).fill('No show at the library.')
    await page.getByRole('dialog').getByRole('button', { name: 'Flag trade' }).click()
    await go(page, '/agreements/agreement-001') // not Maria's: nothing to do there
    await switchTo(page, 'Jamie', '/agreements/agreement-001')
    await page.getByRole('button', { name: 'Cancel trade' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel trade' }).click()

    await switchTo(page, 'Dave', '/dashboard')
    await expect(bell(page)).toHaveAccessibleName('Notifications, 2 unread')
    await checkAndFollow(page, 'Trade flagged for review', 'Maria flagged your trade: “No show at the library.” Talk it through with them in your messages.', /\/agreements\/agreement-002$/)
    await go(page, '/dashboard')
    await checkAndFollow(page, 'Trade canceled', 'Jamie canceled your trade agreement. Message them if you want to try again.', /\/agreements\/agreement-001$/)
    await expectStyle(page, 'Dave')
    // T-04: their own types, not agreement_ready
    expect(await typesOf(page, 'Dave', 'Trade canceled')).toEqual(['trade_canceled'])
    expect(await typesOf(page, 'Dave', 'Trade flagged for review')).toEqual(['trade_flagged'])
  })

  test('a match notification links to the new listing', async ({ page }) => {
    // Posting a listing is covered by the listings spec; this injects the
    // notification CreateListingPage sends, to check the bell and its link.
    await start(page, 'Jamie')
    await withStores(page, (s, id) =>
      s.useNotificationsStore.getState().addNotification({
        userId: id,
        type: 'match',
        title: 'New listing you might like',
        body: 'A neighbor just posted "Succulent Collection (12 pots)". It matches what you\'re looking for.',
        data: { listingId: 'listing-005' },
      }), USER_IDS.Jamie)
    await checkAndFollow(page, 'New listing you might like', 'A neighbor just posted', /\/listing\/listing-005$/)
    await expect(page.getByRole('heading', { name: 'Succulent Collection (12 pots)' })).toBeVisible()
  })

  test('signing notifications use the style guide wording', async ({ page }, testInfo) => {
    await start(page, 'Dave', '/agreements/agreement-001')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Sign agreement' }).click()
    await switchTo(page, 'Jamie', '/dashboard')
    await openBell(page)
    try {
      await expect(panel(page).getByRole('link').first()).toContainText("You're both signed: time to swap", { timeout: 2000 })
      await expect(panel(page).getByRole('link').first()).toContainText('You both signed the trade agreement. Meet up and make the swap.')
    } catch (e) {
      await shot(page, 'N-01-sign-notification-wording', testInfo.project.name)
      throw e
    }
  })
})
