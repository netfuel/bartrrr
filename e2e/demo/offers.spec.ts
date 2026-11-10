/**
 * F-01..F-07: offers (make, counter, last round, accept, decline, withdraw,
 * expired, inbox and dashboard lists).
 *
 * Mock data used (src/data/mock-offers.ts):
 *   offer-001  Sam -> Jamie, Vintage Record Player (listing-001), countered,
 *              round 2, Sam sent the latest counter-offer: Jamie's move.
 *   offer-002  Jamie -> Dave, KitchenAid mixer, accepted.
 *   offer-003  Jordan -> Sam, mountain bike, declined.
 * Both sides are seen in one page by switching the signed-in neighbor in
 * place (see helpers-trade.ts).
 */
import { test, expect } from '../fixtures'
import { DECLINE_REASON_LABELS } from '../../src/types'
import {
  expectToast,
  go,
  offerStatus,
  shot,
  start,
  switchTo,
  withStores,
  USER_IDS,
  type Loose,
} from './helpers-trade'

// Two-sided journeys run many steps; keep headroom when the dev server is busy
test.describe.configure({ timeout: 60_000 })

async function counter(page: import('@playwright/test').Page, items: string, note?: string) {
  await page.getByRole('button', { name: 'Counter-offer', exact: true }).click()
  const box = page.getByRole('textbox', { name: /instead\?/ })
  await box.fill(items)
  if (note) await page.getByRole('textbox', { name: 'Message (optional)' }).fill(note)
  await page.getByRole('button', { name: 'Send counter-offer' }).click()
}

test.describe('F-01 make an offer', () => {
  test('from a listing with picked and described items and a message', async ({ page }) => {
    await start(page, 'Jamie', '/listing/listing-005') // Priya's succulents
    await page.getByRole('button', { name: 'Make an offer', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Make an offer' })).toBeVisible()

    // Nothing chosen yet: send is disabled, with the reason next to it
    const send = dialog.getByRole('button', { name: 'Send offer' })
    await expect(send).toBeDisabled()
    await expect(dialog.getByText('Pick or describe at least one thing to offer.')).toBeVisible()

    // One of Jamie's own listings plus a described service
    await dialog.getByRole('button', { name: 'Raised Garden Bed Kit' }).click()
    await expect(dialog.getByRole('button', { name: 'Raised Garden Bed Kit' })).toHaveAttribute('aria-pressed', 'true')
    await dialog.getByRole('textbox', { name: 'Or describe something else' }).fill('2 hours of gardening help')
    await dialog.getByRole('textbox', { name: 'Add a message (optional)' }).fill('Would love these for my porch.')
    await expect(dialog.getByText('Raised Garden Bed Kit, 2 hours of gardening help')).toBeVisible()
    await expect(dialog.getByText('They have 72 hours to accept, decline, or send a counter-offer.')).toBeVisible()
    await send.click()

    await expect(page).toHaveURL(/\/offers\/offer-/)
    await expectToast(page, 'Offer sent. They have 72 hours to reply.')
    await expect(offerStatus(page)).toContainText("Waiting for Priya to reply. We'll let you know when they do.")
    await expect(offerStatus(page)).toContainText('Round 1 of 5 · 4 counter-offers left · Expires in')
    await expect(page.getByText('Would love these for my porch.')).toBeVisible()
    await expect(page.locator('main').getByText('2 hours of gardening help', { exact: true })).toBeVisible()

    // Listing owner sees it waiting on them
    await switchTo(page, 'Priya', '/offers')
    const row = page.getByRole('link', { name: /Jamie Oakley/ })
    await expect(row).toContainText('Your turn')
    await expect(row).toContainText('Succulent Collection')
  })

  test("T-68: a browse card's Offer button opens the make-offer form right there", async ({ page }) => {
    await start(page, 'Jamie', '/browse')
    const offer = page.getByRole('button', { name: 'Make an offer on Succulent Collection (12 pots)' })
    await offer.click()
    // Same form as the listing page, without leaving browse
    await expect(page).toHaveURL('/browse')
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Make an offer' })).toBeVisible()
    await expect(dialog).toContainText('Succulent Collection (12 pots)')
    // Closing leaves you where you were
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL('/browse')

    await offer.click()
    await dialog.getByRole('textbox', { name: 'What are you offering?' }).or(dialog.getByRole('textbox', { name: 'Or describe something else' })).fill('A jar of fig jam')
    await dialog.getByRole('button', { name: 'Send offer' }).click()
    await expect(page).toHaveURL(/\/offers\/offer-/)
    await expectToast(page, 'Offer sent. They have 72 hours to reply.')
    await expect(page.locator('main').getByText('A jar of fig jam', { exact: true }).first()).toBeVisible()
  })

  test("T-68: a similar listing's Offer button opens the form for that listing", async ({ page }) => {
    await start(page, 'Jamie', '/listing/listing-003')
    const similar = page
      .getByRole('main')
      .getByRole('article')
      .filter({ has: page.getByRole('button', { name: /^Make an offer on / }) })
      .first()
    await expect(similar).toBeVisible()
    const title = (await similar.getByRole('heading', { level: 3 }).textContent())!
    await similar.getByRole('button', { name: `Make an offer on ${title}` }).click()
    await expect(page).toHaveURL('/listing/listing-003')
    await expect(page.getByRole('dialog')).toContainText(title)
  })

  test('T-68: no card Offer button on your own or closed listings', async ({ page }) => {
    await start(page, 'Jamie', '/browse')
    await expect(page.getByRole('heading', { level: 3, name: 'Raised Garden Bed Kit' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Make an offer on Raised Garden Bed Kit' })).toHaveCount(0)
    await withStores(page, (s) => {
      s.useListingsStore.getState().updateListing('listing-005', { status: 'closed' })
    })
    await expect(page.getByRole('button', { name: 'Make an offer on Succulent Collection (12 pots)' })).toHaveCount(0)
  })

  test('not on your own listing', async ({ page }) => {
    await start(page, 'Jamie', '/listing/listing-001')
    await expect(page.getByRole('heading', { name: 'Vintage Record Player' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Make an offer', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Edit listing' })).toBeVisible()
  })

  test('not on a listing with a trade in progress or no longer available', async ({ page }) => {
    await start(page, 'Jamie')
    await withStores(page, (s) => {
      s.useListingsStore.getState().updateListing('listing-005', { status: 'pending' })
      s.useListingsStore.getState().updateListing('listing-011', { status: 'closed' })
    })
    await go(page, '/listing/listing-005')
    await expect(page.getByRole('button', { name: 'Make an offer', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'A trade for this is in progress' })).toBeDisabled()

    await go(page, '/listing/listing-011')
    await expect(page.getByRole('button', { name: 'Make an offer', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'This listing is no longer available' })).toBeDisabled()
  })
})

test.describe('F-02 counter-offers back and forth', () => {
  test('turn indicator is right for both neighbors on every round', async ({ page }) => {
    await start(page, 'Jamie', '/offers/offer-001')
    // Round 2: Sam countered, Jamie's move. Jamie owns the listing: Decline, not Withdraw
    await expect(offerStatus(page)).toContainText('Your move: accept, counter-offer, or decline.')
    await expect(offerStatus(page)).toContainText('Round 2 of 5 · 3 counter-offers left')
    await expect(page.getByRole('button', { name: 'Decline' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Withdraw/ })).toHaveCount(0)

    // The counter form starts from what's on the table and speaks to the owner's side
    await page.getByRole('button', { name: 'Counter-offer', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'What would you want from Sam instead?' })).toHaveValue(
      'Yamaha FG800 Acoustic Guitar\nFree Bike Tune-Up',
    )
    await page.getByRole('textbox', { name: 'What would you want from Sam instead?' }).fill('Yamaha FG800 Acoustic Guitar\nGuitar case')
    await page.getByRole('textbox', { name: 'Message (optional)' }).fill('Swap the tune-up for the case?')
    await page.getByRole('button', { name: 'Send counter-offer' }).click()
    await expectToast(page, 'Counter-offer sent. Waiting for Sam to reply.')

    // Round 3: Jamie waits
    await expect(offerStatus(page)).toContainText("Waiting for Sam to reply. We'll let you know when they do.")
    await expect(offerStatus(page)).toContainText('Round 3 of 5 · 2 counter-offers left')
    await expect(page.getByRole('button', { name: 'Waiting for Sam to reply' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Accept trade' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Counter-offer', exact: true })).toHaveCount(0)
    await expect(page.getByText('Counter-offer 2 of 4')).toBeVisible()

    // Sam's side: his move; he made the offer so he can withdraw rather than decline
    await switchTo(page, 'Sam', '/offers/offer-001')
    await expect(offerStatus(page)).toContainText('Your move: accept, counter-offer, or decline.')
    await expect(offerStatus(page)).toContainText('Round 3 of 5 · 2 counter-offers left')
    await expect(page.getByRole('button', { name: /^Withdraw/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Decline' })).toHaveCount(0)
    await expect(page.getByText('Swap the tune-up for the case?')).toBeVisible()
    await page.getByRole('button', { name: 'Counter-offer', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'What will you offer instead?' })).toBeVisible()
    await page.getByRole('textbox', { name: 'What will you offer instead?' }).fill('Yamaha FG800 Acoustic Guitar\nGuitar strings')
    await page.getByRole('button', { name: 'Send counter-offer' }).click()
    await expect(offerStatus(page)).toContainText('Waiting for Jamie to reply.')
    await expect(offerStatus(page)).toContainText('Round 4 of 5 · 1 counter-offer left')

    // Round 4 on Jamie's side: last counter-offer nudge
    await switchTo(page, 'Jamie', '/offers/offer-001')
    await expect(offerStatus(page)).toContainText('Your move: accept, counter-offer, or decline.')
    await expect(offerStatus(page)).toContainText('Round 4 of 5 · 1 counter-offer left')
    await expect(offerStatus(page)).toContainText("One counter-offer left. If you're close, now's a good time to meet in the middle.")

    // Inbox lists agree with the thread
    await go(page, '/offers')
    await expect(page.getByRole('link', { name: /Sam Nguyen/ })).toContainText('Your turn')
    await switchTo(page, 'Sam', '/offers')
    await page.getByRole('tab', { name: /Sent/ }).click()
    const samRow = page.getByRole('link', { name: /Jamie Oakley/ })
    await expect(samRow).not.toContainText('Your turn')
    await expect(samRow).toContainText('Counter-offer')
  })
})

test.describe('F-03 round 5 is the last', () => {
  test('counter-offers close after round 5, with the reason shown', async ({ page }) => {
    await start(page, 'Jamie', '/offers/offer-001')
    await counter(page, 'Guitar') // round 3
    await switchTo(page, 'Sam', '/offers/offer-001')
    await counter(page, 'Guitar\nStrings') // round 4
    await switchTo(page, 'Jamie', '/offers/offer-001')
    await page.getByRole('button', { name: 'Counter-offer', exact: true }).click()
    await expect(page.getByText('This is the last counter-offer either of you can send.')).toBeVisible()
    await page.getByRole('textbox', { name: /instead\?/ }).fill('Guitar\nStrings\nCapo')
    await page.getByRole('button', { name: 'Send counter-offer' }).click() // round 5
    await expect(offerStatus(page)).toContainText('Round 5 of 5')
    await expect(page.getByText('Counter-offer 4 of 4')).toBeVisible()

    await switchTo(page, 'Sam', '/offers/offer-001')
    await expect(offerStatus(page)).toContainText(
      'Your move: accept or decline. This is the last round, so counter-offers are closed.',
    )
    await expect(offerStatus(page)).not.toContainText('counter-offers left')
    await expect(page.getByRole('button', { name: 'Counter-offer', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Accept trade' })).toBeVisible()

    // The store refuses a sixth round even if asked directly
    const round = await withStores(page, (s, id) => {
      s.useOffersStore.getState().counterOffer('offer-001', id, 'one more', ['x'])
      return s.useOffersStore.getState().getOfferById('offer-001').round
    }, USER_IDS.Sam)
    expect(round).toBe(5)
  })
})

test.describe('F-04 accept', () => {
  test('creates the agreement, puts the listing on hold, leaves other offers open', async ({ page }) => {
    await start(page, 'Jamie')
    // Priya also has an open offer on the record player
    const otherId = await withStores(page, (s, ids) =>
      s.useOffersStore.getState().createOffer({
        listingId: 'listing-001',
        fromUserId: ids.Priya,
        toUserId: ids.Jamie,
        content: 'Mugs for the record player?',
        items: ['Handmade Ceramic Mugs (set of 4)'],
      }), USER_IDS)

    await go(page, '/offers/offer-001')
    await page.getByRole('button', { name: 'Accept trade' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Accept this trade?' })).toBeVisible()
    await expect(dialog).toContainText('You give Vintage Record Player and get Yamaha FG800 Acoustic Guitar, Free Bike Tune-Up.')
    await dialog.getByRole('button', { name: 'Not yet' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(offerStatus(page)).toContainText('Your move')

    await page.getByRole('button', { name: 'Accept trade' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Accept trade' }).click()
    await expectToast(page, 'Trade accepted. Next, review and sign the trade agreement.')
    await expect(offerStatus(page)).toContainText('Trade accepted. Next: you both sign the trade agreement.')
    await expect(page.getByText('Accepted', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Message Sam' })).toBeVisible() // still free to arrange the swap

    await page.getByRole('button', { name: 'Review and sign agreement' }).click()
    await expect(page).toHaveURL(/\/agreements\/agreement-offer-001$/)
    const card = page.locator('article').filter({ hasText: 'Trade agreement' })
    await expect(card).toContainText('Waiting to sign')
    await expect(card).toContainText('You giveVintage Record Player')
    await expect(card).toContainText('You getYamaha FG800 Acoustic Guitar, Free Bike Tune-Up')

    // Listing on hold
    await go(page, '/listing/listing-001')
    await expect(page.getByText('Trade in progress', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'You have a trade in progress for this listing' })).toBeDisabled()

    // Priya's offer is still open and still waiting on Jamie
    const status = await withStores(page, (s, id) => s.useOffersStore.getState().getOfferById(id).status, otherId)
    expect(status).toBe('pending')
    await switchTo(page, 'Priya', `/offers/${otherId}`)
    await expect(offerStatus(page)).toContainText('Waiting for Jamie to reply.')

    // Sam sees it accepted and is pointed at the agreement
    await switchTo(page, 'Sam', '/offers/offer-001')
    await expect(offerStatus(page)).toContainText('Trade accepted. Next: you both sign the trade agreement.')
    await expect(page.getByRole('button', { name: 'Review and sign agreement' })).toBeVisible()
  })
})

test.describe('F-05 decline', () => {
  for (const [key, label] of Object.entries(DECLINE_REASON_LABELS)) {
    test(`with reason "${key}": the maker sees the reason`, async ({ page }) => {
      await start(page, 'Jamie', '/offers/offer-001')
      await page.getByRole('button', { name: 'Decline' }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByRole('heading', { name: 'Decline this offer?' })).toBeVisible()
      await expect(dialog).toContainText('This ends the negotiation. Pick a reason so Sam knows what to try next time.')
      await expect(dialog.getByRole('button', { name: 'Decline offer' })).toBeDisabled()
      await expect(dialog.getByText('Choose a reason to continue.')).toBeVisible()
      await dialog.getByRole('group', { name: 'Reason for declining' }).getByRole('button', { name: label }).click()
      await dialog.getByRole('button', { name: 'Decline offer' }).click()
      await expectToast(page, 'Offer declined. We let Sam know.')
      await expect(offerStatus(page)).toContainText('You declined this offer.')

      await switchTo(page, 'Sam', '/offers/offer-001')
      await expect(offerStatus(page)).toContainText('Jamie declined this offer. Their reason is in the thread above.')
      await expect(page.locator('main').getByText(`Declined: ${label}`)).toBeVisible()
      await expect(page.getByRole('link', { name: 'Find another trade' })).toBeVisible()
      await expect(page.getByRole('textbox', { name: 'Message Jamie' })).toHaveCount(0)
    })
  }

  test('with a reason and a note: the maker still sees the reason', async ({ page }, testInfo) => {
    await start(page, 'Jamie', '/offers/offer-001')
    await page.getByRole('button', { name: 'Decline' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: DECLINE_REASON_LABELS.not_fair }).click()
    await dialog.getByRole('textbox', { name: 'Add a note (optional)' }).fill('Maybe add a capo?')
    await dialog.getByRole('button', { name: 'Decline offer' }).click()
    await switchTo(page, 'Sam', '/offers/offer-001')
    await expect(page.getByText('Maybe add a capo?')).toBeVisible()
    try {
      await expect(page.locator('main').getByText(DECLINE_REASON_LABELS.not_fair)).toBeVisible({ timeout: 2000 })
    } catch (e) {
      await shot(page, 'F-05-decline-note-hides-reason', testInfo.project.name)
      throw e
    }
  })
})

test.describe('F-06 withdraw', () => {
  test('maker withdraws from the thread; both sides see it; dashboard row moves to Closed', async ({ page }) => {
    await start(page, 'Jamie', '/offers/offer-001')
    await counter(page, 'Yamaha FG800 Acoustic Guitar') // now waiting on Sam (the maker)
    await switchTo(page, 'Sam', '/offers/offer-001')
    await counter(page, 'Yamaha FG800 Acoustic Guitar\nStrings') // now waiting on Jamie: Sam can still withdraw
    await expect(page.getByRole('button', { name: 'Waiting for Jamie to reply' })).toBeDisabled()

    await page.getByRole('button', { name: 'Withdraw offer' }).click()
    let dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Withdraw this offer?' })).toBeVisible()
    await expect(dialog).toContainText('This ends the negotiation for Vintage Record Player.')
    await expect(dialog).toContainText("We'll let Jamie know you withdrew it.")
    await expect(dialog).toContainText("You can't undo this.")
    await dialog.getByRole('button', { name: 'Keep my offer' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(offerStatus(page)).toContainText('Waiting for Jamie to reply.')

    await page.getByRole('button', { name: 'Withdraw offer' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Withdraw offer' }).click()
    await expectToast(page, 'Offer withdrawn. We let Jamie know.')
    await expect(offerStatus(page)).toContainText('You withdrew this offer.')
    await expect(page.getByText('Withdrawn').first()).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Message Jamie' })).toHaveCount(0)

    await go(page, '/dashboard')
    await page.getByRole('tab', { name: /Offers sent/ }).click()
    await expect(page.getByRole('link', { name: 'Your offer to Jamie Oakley' })).toHaveCount(0)
    const closed = page.getByText('Closed', { exact: true })
    await expect(closed).toBeVisible()
    await expect(page.getByRole('link', { name: /Jamie Oakley: Vintage Record Player/ })).toContainText('Withdrawn')

    await switchTo(page, 'Jamie', '/offers/offer-001')
    await expect(offerStatus(page)).toContainText('Sam withdrew this offer.')
    await go(page, '/offers')
    await expect(page.getByRole('link', { name: /Sam Nguyen/ })).toContainText('Sam withdrew this offer.')
    await expect(page.getByRole('link', { name: /Sam Nguyen/ })).toContainText('Withdrawn')
  })

  test('from the dashboard Offers sent tab, with the same confirm step', async ({ page }) => {
    await start(page, 'Sam', '/dashboard')
    await page.getByRole('tab', { name: /Offers sent/ }).click()
    await page.getByRole('button', { name: 'Withdraw offer to Jamie' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('button', { name: 'Keep my offer' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Withdraw offer' }).click()
    await expect(page.getByRole('button', { name: 'Withdraw offer to Jamie' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Jamie Oakley: Vintage Record Player/ })).toContainText('Withdrawn')
  })

  test('only the maker, and only while pending or countered', async ({ page }) => {
    // Listing owner: no withdraw, only decline
    await start(page, 'Jamie', '/offers/offer-001')
    await expect(page.getByRole('button', { name: /Withdraw/ })).toHaveCount(0)
    // Accepted offer Jamie made: no withdraw
    await go(page, '/offers/offer-002')
    await expect(page.getByRole('button', { name: /Withdraw/ })).toHaveCount(0)
    // The store refuses an owner's withdraw too
    const refused = await withStores(page, (s, id) => s.useOffersStore.getState().withdrawOffer('offer-001', id), USER_IDS.Jamie)
    expect(refused).toBe(false)
    await expectToast(page, 'Only the neighbor who made this offer can withdraw it.')

    // Declined offer Jordan made: no withdraw
    await switchTo(page, 'Jordan', '/offers/offer-003')
    await expect(offerStatus(page)).toContainText('Sam declined this offer.')
    await expect(page.getByRole('button', { name: /Withdraw/ })).toHaveCount(0)
  })
})

test.describe('F-07 expired offers and lists', () => {
  test('an expired offer moves to Closed and both sides see why', async ({ page }) => {
    await start(page, 'Sam')
    await withStores(page, (s) => {
      const st = s.useOffersStore.getState()
      st.setOffers(st.offers.map((o: Loose) => (o.id === 'offer-001' ? { ...o, expiresAt: new Date(Date.now() - 1000).toISOString() } : o)))
    })
    await go(page, '/offers/offer-001')
    await expect(offerStatus(page)).toContainText(
      "This offer expired after 72 hours without a reply. Make a new offer if you're still interested.",
    )
    await expect(page.getByText('Expired', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Withdraw|Accept trade|Counter-offer/ })).toHaveCount(0)

    await go(page, '/dashboard')
    await page.getByRole('tab', { name: /Offers sent/ }).click()
    await expect(page.getByRole('link', { name: /Jamie Oakley: Vintage Record Player/ })).toContainText('Expired')

    await switchTo(page, 'Jamie', '/offers/offer-001')
    await expect(offerStatus(page)).toContainText('This offer expired after 72 hours without a reply.')
    await expect(page.getByRole('button', { name: 'Decline' })).toHaveCount(0)
  })

  test('inbox and dashboard show the right tabs, counts, badges and previews for every status', async ({ page }) => {
    await start(page, 'Jamie')
    // One offer per status, sent and received by Jamie (built on the mock data)
    await withStores(page, (s, ids) => {
      const st = s.useOffersStore.getState()
      const now = Date.now()
      const iso = (ms: number) => new Date(now + ms).toISOString()
      const mk = (id: string, listingId: string, from: string, to: string, status: string, lastFrom: string, text: string) => ({
        id,
        listingId,
        fromUserId: from,
        toUserId: to,
        messages: [
          { id: `${id}-m1`, fromUserId: from, content: 'First offer', items: ['Thing'], type: 'offer', createdAt: iso(-7200_000) },
          ...(lastFrom !== from || text !== 'First offer'
            ? [{ id: `${id}-m2`, fromUserId: lastFrom, content: text, items: ['Thing 2'], type: status === 'declined' ? 'decline' : 'counter', createdAt: iso(-3600_000) }]
            : []),
        ],
        status,
        round: lastFrom === from ? 1 : 2,
        maxRounds: 5,
        expiresAt: status === 'expired' ? iso(-1000) : iso(48 * 3600_000),
        createdAt: iso(-7200_000),
      })
      const J = ids.Jamie
      st.setOffers([
        ...st.offers,
        // received
        mk('t-in-pending', 'listing-013', ids.Priya, J, 'pending', ids.Priya, 'First offer'),
        mk('t-in-waiting', 'listing-013', ids.Alex, J, 'countered', J, 'Jamie countered'),
        mk('t-in-declined', 'listing-013', ids.Maria, J, 'declined', J, 'Not for me, thanks'),
        mk('t-in-expired', 'listing-013', ids.Jordan, J, 'expired', ids.Jordan, 'First offer'),
        // sent
        mk('t-out-pending', 'listing-005', J, ids.Priya, 'pending', J, 'First offer'),
        mk('t-out-yourturn', 'listing-008', J, ids.Alex, 'countered', ids.Alex, 'Alex countered'),
        mk('t-out-declined', 'listing-006', J, ids.Jordan, 'declined', ids.Jordan, 'Not for me, thanks'),
        mk('t-out-withdrawn', 'listing-012', J, ids.Jordan, 'withdrawn', J, 'First offer'),
        mk('t-out-expired', 'listing-007', J, ids.Nina, 'expired', J, 'First offer'),
      ])
    }, USER_IDS)

    // ── Offers inbox ──
    await go(page, '/offers')
    const received = page.getByRole('tab', { name: /Received/ })
    const sent = page.getByRole('tab', { name: /Sent/ })
    await expect(received).toHaveAttribute('aria-selected', 'true')
    await expect(received).toContainText('5') // offer-001 + 4
    await expect(sent).toContainText('6') // offer-002 + 5
    const row = (name: RegExp) => page.locator('main a[href^="/offers/"]').filter({ hasText: name })
    await expect(row(/Sam Nguyen/)).toContainText('Your turn')
    await expect(row(/Priya Patel/)).toContainText('Your turn')
    await expect(row(/Alex Chen/)).toContainText('Counter-offer')
    await expect(row(/Alex Chen/)).toContainText('Jamie countered')
    await expect(row(/Maria Santos/)).toContainText('Declined')
    await expect(row(/Jordan Williams/)).toContainText('Expired')

    await sent.click()
    await expect(sent).toHaveAttribute('aria-selected', 'true')
    await expect(row(/Dave Morrison/)).toContainText('Accepted')
    await expect(row(/Priya Patel/)).toContainText('Waiting for reply')
    await expect(row(/Alex Chen/)).toContainText('Your turn')
    await expect(row(/Alex Chen/)).toContainText('Alex countered')
    await expect(row(/IKEA Kallax/)).toContainText('Declined')
    await expect(row(/Pet Sitting/)).toContainText('Withdrawn')
    await expect(row(/Pet Sitting/)).toContainText('You withdrew this offer.')
    await expect(row(/Custom Logo Design/)).toContainText('Expired')

    // ── Dashboard ──
    await go(page, '/dashboard')
    const tabs = page.getByRole('tablist', { name: 'Dashboard sections' })
    await expect(tabs.getByRole('tab', { name: /Offers sent/ })).toContainText('2') // pending + your turn
    await tabs.getByRole('tab', { name: /Offers sent/ }).click()
    await expect(page.getByRole('link', { name: 'Your offer to Priya Patel' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Your offer to Alex Chen' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Your offer to Dave Morrison' })).toHaveCount(0) // accepted lives under Active trades
    const closedRows = page.locator('main a').filter({ hasText: /(Jordan Williams|Nina Rodriguez): / })
    await expect(closedRows).toHaveCount(3)
    await expect(page.getByRole('link', { name: /IKEA Kallax/ })).toContainText('Declined')
    await expect(page.getByRole('link', { name: /Pet Sitting/ })).toContainText('Withdrawn')
    await expect(page.getByRole('link', { name: /Custom Logo Design/ })).toContainText('Expired')

    await tabs.getByRole('tab', { name: /Offers received/ }).click()
    await expect(page.getByRole('link', { name: /Sam Nguyen wants to trade/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Priya Patel wants to trade/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Maria Santos wants to trade/ })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Jordan Williams wants to trade/ })).toHaveCount(0)

    await tabs.getByRole('tab', { name: /Active trades/ }).click()
    await expect(page.getByRole('link', { name: /Trade with Dave Morrison/ })).toContainText('Waiting to sign')
  })

  test('dashboard "Offers to answer" counts only offers waiting on you', async ({ page }, testInfo) => {
    await start(page, 'Jamie', '/offers/offer-001')
    await counter(page, 'Yamaha FG800 Acoustic Guitar') // now waiting on Sam
    await go(page, '/dashboard')
    const stat = page.locator('dl > div').filter({ hasText: 'Offers to answer' })
    try {
      await expect(stat.locator('dd')).toHaveText('0', { timeout: 2000 })
    } catch (e) {
      await shot(page, 'F-07-dashboard-offers-to-answer', testInfo.project.name)
      throw e
    }
  })

  test('dashboard lists say "Your turn" when it is your move', async ({ page }, testInfo) => {
    await start(page, 'Jamie', '/dashboard')
    await page.getByRole('tab', { name: /Offers received/ }).click()
    try {
      await expect(page.getByRole('link', { name: /Sam Nguyen wants to trade/ })).toContainText('Your turn', { timeout: 2000 })
    } catch (e) {
      await shot(page, 'F-07-dashboard-your-turn', testInfo.project.name)
      throw e
    }
  })

  test('inbox preview of a declined offer shows the reason in words, not a code', async ({ page }, testInfo) => {
    await start(page, 'Jamie', '/offers/offer-001')
    await page.getByRole('button', { name: 'Decline' }).click()
    await page.getByRole('dialog').getByRole('button', { name: DECLINE_REASON_LABELS.not_fair }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Decline offer' }).click()
    await switchTo(page, 'Sam', '/offers')
    await page.getByRole('tab', { name: /Sent/ }).click()
    const row = page.getByRole('link', { name: /Jamie Oakley/ })
    await expect(row).toContainText('Declined')
    try {
      await expect(row).not.toContainText('not_fair', { timeout: 2000 })
    } catch (e) {
      await shot(page, 'F-07-inbox-raw-decline-reason', testInfo.project.name)
      throw e
    }
  })

  test('inbox keeps "Your turn" after you send a chat message', async ({ page }, testInfo) => {
    await start(page, 'Jamie', '/offers/offer-001')
    await page.getByRole('textbox', { name: 'Message Sam' }).fill('Let me think about it overnight.')
    await page.getByRole('button', { name: 'Send message' }).click()
    await expect(offerStatus(page)).toContainText('Your move') // the thread itself is right
    await go(page, '/offers')
    try {
      await expect(page.getByRole('link', { name: /Sam Nguyen/ })).toContainText('Your turn', { timeout: 2000 })
    } catch (e) {
      await shot(page, 'F-07-inbox-your-turn-after-message', testInfo.project.name)
      throw e
    }
  })

  test('dashboard keeps declined received offers under Closed, like sent ones', async ({ page }) => {
    await start(page, 'Jamie', '/offers/offer-001')
    await page.getByRole('button', { name: 'Decline' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: DECLINE_REASON_LABELS.not_fair }).click()
    await dialog.getByRole('button', { name: 'Decline offer' }).click()
    await go(page, '/dashboard')
    await page.getByRole('tab', { name: /Offers received/ }).click()
    await expect(page.getByRole('link', { name: /Sam Nguyen wants to trade/ })).toHaveCount(0)
    await expect(page.getByText('Closed', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: /Sam Nguyen: Vintage Record Player/ })).toContainText('Declined')
  })
})
