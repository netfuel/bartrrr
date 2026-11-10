/**
 * G-01..G-09: trade agreements.
 *
 * Mock data (src/data/mock-agreements.ts), times relative to page load:
 *   agreement-001  Jamie (A, signed) <-> Dave (B, not signed), waiting to
 *                  sign, swap about 4 days out, all details set.
 *   agreement-002  Dave (A) <-> Maria (B), both signed (Ready to swap), swap
 *                  about 20 hours out (inside the late-cancel window).
 *   agreement-003  Nina (A) <-> Alex (B), completed.
 * A fresh agreement with no details comes from accepting offer-001 as Jamie.
 * Both sides are seen by switching the signed-in neighbor in place.
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import { go, shot, start, switchTo, withStores, type Loose } from './helpers-trade'

// Two-sided journeys run many steps; keep headroom when the dev server is busy
test.describe.configure({ timeout: 60_000 })

const card = (page: Page) => page.locator('main article').filter({ hasText: 'Trade agreement' }).first()
const signBtn = (page: Page) => page.getByRole('button', { name: 'Sign agreement' })
const honesty = (page: Page) =>
  page.getByRole('checkbox', { name: "I've described what I'm giving honestly, including its condition, and I agree to these terms." })

/** datetime-local value `hours` from now, in the browser's time zone. */
async function localInput(page: Page, hours: number) {
  return page.evaluate((h) => {
    const d = new Date(Date.now() + h * 3_600_000)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  }, hours)
}

/** Accept offer-001 as Jamie: a brand-new agreement with no time or place. */
async function freshAgreement(page: Page) {
  await start(page, 'Jamie', '/offers/offer-001')
  await page.getByRole('button', { name: 'Accept trade' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Accept trade' }).click()
  await page.getByRole('button', { name: 'Review and sign agreement' }).click()
  await expect(page).toHaveURL(/\/agreements\/agreement-offer-001$/)
}

async function fillDetails(page: Page, opts: { method?: string; hours?: number; place?: string }) {
  if (opts.method) await page.getByRole('group', { name: "How you'll swap" }).getByRole('button', { name: opts.method }).click()
  if (opts.hours !== undefined) await page.getByLabel('Date and time').fill(await localInput(page, opts.hours))
  if (opts.place !== undefined) await page.getByRole('textbox', { name: 'Place' }).fill(opts.place)
  await page.getByRole('button', { name: 'Save changes' }).click()
}

test.describe('G-01 both sides', () => {
  test("each neighbor sees what they give and get, and both signature lines", async ({ page }) => {
    await start(page, 'Jamie', '/agreements/agreement-001')
    await expect(page.getByText(/This agreement is voluntary and not legally binding/)).toBeVisible()
    await expect(card(page)).toContainText('You giveComplete Gardening Tool Set (spade, rake, pruners, kneeling pad)')
    await expect(card(page)).toContainText('You getKitchenAid Stand Mixer (red, 5-quart, with all attachments)')
    await expect(card(page)).toContainText('You signed')
    await expect(card(page)).toContainText("Dave hasn't signed yet")
    await expect(card(page)).toContainText('You signed. Waiting for Dave to sign.')
    await expect(signBtn(page)).toHaveCount(0)

    await switchTo(page, 'Dave', '/agreements/agreement-001')
    await expect(card(page)).toContainText('You giveKitchenAid Stand Mixer')
    await expect(card(page)).toContainText('You getComplete Gardening Tool Set')
    await expect(card(page)).toContainText('Jamie signed')
    await expect(card(page)).toContainText("You haven't signed yet")
  })
})

test.describe('G-02 details required before signing', () => {
  test('method, time and place are all needed; sign stays disabled with the reason', async ({ page }) => {
    await freshAgreement(page)
    await expect(page.getByText('No time or place yet. Pick them with Sam, then add them here.')).toBeVisible()
    await expect(signBtn(page)).toBeDisabled()
    await expect(card(page)).toContainText("How you'll swap, a date and time and a place are still needed.")

    await page.getByRole('button', { name: 'Add time and place' }).click()
    await fillDetails(page, { method: 'Meet up in person' })
    await expect(page.getByText('Almost there: add a date and time and a place so you can both sign.')).toBeVisible()
    await expect(signBtn(page)).toBeDisabled()

    await page.getByRole('button', { name: 'Edit time and place' }).click()
    await fillDetails(page, { hours: 72 })
    await expect(page.getByText('Almost there: add a place so you can both sign.')).toBeVisible()
    await expect(signBtn(page)).toBeDisabled()
    await expect(card(page)).toContainText('A place is still needed.')

    await page.getByRole('button', { name: 'Edit time and place' }).click()
    await fillDetails(page, { place: 'Cossitt Library, front steps' })
    await expect(page.getByText(/Almost there/)).toHaveCount(0)
    await expect(honesty(page)).toBeVisible()
    await expect(page.getByText('Meet up in person')).toBeVisible()
    await expect(page.getByText('Cossitt Library, front steps')).toBeVisible()
  })
})

test.describe('G-03 time must be in the future', () => {
  test('a past date and time is refused with a fixable message', async ({ page }) => {
    await freshAgreement(page)
    await page.getByRole('button', { name: 'Add time and place' }).click()
    await fillDetails(page, { method: 'Drop-off', hours: -3, place: 'Overton Park gate' })
    await expect(page.getByText("Pick a time that hasn't happened yet.")).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible() // still editing
    // Editing the field clears the error
    await page.getByLabel('Date and time').fill(await localInput(page, 30))
    await expect(page.getByText("Pick a time that hasn't happened yet.")).toHaveCount(0)
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('button', { name: 'Edit time and place' })).toBeVisible()
  })
})

test.describe('G-04 editing details clears signatures', () => {
  test('the form warns first, then saving clears the signature', async ({ page }) => {
    await start(page, 'Jamie', '/agreements/agreement-001')
    await page.getByRole('button', { name: 'Edit time and place' }).click()
    await expect(page.getByText('Saving clears both signatures, so you and Dave will both sign again.')).toBeVisible()
    // Backing out keeps everything
    await page.getByRole('button', { name: 'Keep current details' }).click()
    await expect(card(page)).toContainText('You signed')

    await page.getByRole('button', { name: 'Edit time and place' }).click()
    await page.getByRole('textbox', { name: 'Place' }).fill('Poplar Library, front desk')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Saved. You and Dave will both sign again.').first()).toBeVisible()
    await expect(card(page)).toContainText("You haven't signed yet")
    await expect(card(page)).toContainText("Dave hasn't signed yet")
    await expect(page.getByText(/Last changed by you on/)).toBeVisible()
    await expect(page.getByText('Poplar Library, front desk')).toBeVisible()

    await switchTo(page, 'Dave', '/agreements/agreement-001')
    await expect(card(page)).toContainText("Jamie hasn't signed yet")
    await expect(page.getByText(/Last changed by Jamie on/)).toBeVisible()
  })
})

test.describe('G-05 details lock once both sign', () => {
  test('no edit control on a signed agreement, and the store refuses changes', async ({ page }) => {
    await start(page, 'Maria', '/agreements/agreement-002')
    await expect(card(page)).toContainText('Ready to swap')
    await expect(page.getByRole('heading', { name: 'When and where' })).toBeVisible()
    await expect(page.getByRole('button', { name: /time and place/ })).toHaveCount(0)
    const where = await withStores(page, (s) => {
      s.useAgreementsStore.getState().updateExchangeDetails('agreement-002', 'user-002', { exchangeMethod: 'dropoff', exchangeLocation: 'Elsewhere' })
      return s.useAgreementsStore.getState().getAgreementById('agreement-002').exchangeLocation
    })
    expect(where).toBe('Cossitt Library, second-floor study room')
  })
})

test.describe('G-06 signing', () => {
  test('needs the honesty checkbox; the second signature makes it ready to swap', async ({ page }) => {
    await start(page, 'Dave', '/agreements/agreement-001')
    await expect(signBtn(page)).toBeDisabled()
    await expect(card(page)).toContainText('Check the box above to sign.')
    await honesty(page).check()
    await expect(signBtn(page)).toBeEnabled()
    await expect(card(page)).toContainText("Signing isn't a legal contract. It's a shared record of what you both agreed to.")
    await signBtn(page).click()
    await expect(page.getByText('You both signed. Time to meet up and swap.').first()).toBeVisible()
    await expect(card(page)).toContainText('Ready to swap')
    await expect(page.getByRole('button', { name: 'We made the swap' })).toBeVisible()
    await expect(page.getByRole('button', { name: /time and place/ })).toHaveCount(0)

    await switchTo(page, 'Jamie', '/agreements/agreement-001')
    await expect(card(page)).toContainText('Dave signed')
    await expect(page.getByRole('button', { name: 'We made the swap' })).toBeVisible()
  })

  test('first signer is told who they are waiting on', async ({ page }) => {
    await freshAgreement(page)
    await page.getByRole('button', { name: 'Add time and place' }).click()
    await fillDetails(page, { method: 'Meet up in person', hours: 72, place: 'Cooper-Young gazebo' })
    await honesty(page).check()
    await signBtn(page).click()
    await expect(page.getByText("Signed. We'll let you know when Sam signs too.").first()).toBeVisible()
    await expect(card(page)).toContainText('You signed. Waiting for Sam to sign.')
    await expect(card(page)).toContainText('Waiting to sign')
  })
})

test.describe('T-03 signed before time and place were required (migration 009)', () => {
  test('both sides are told to add details first; saving them opens signing to both', async ({ page }) => {
    await start(page, 'Jamie', '/agreements/agreement-001')
    // An older row: Jamie signed, no time or place (009 now refuses the second signature)
    await withStores(page, (s) => {
      const st = s.useAgreementsStore.getState()
      const a = st.getAgreementById('agreement-001')
      st.upsertAgreement({ ...a, exchangeMethod: undefined, exchangeDate: undefined, exchangeLocation: undefined, specialInstructions: undefined })
    })
    const notice = page.locator('main [role="status"]').filter({ hasText: 'signed before these were required' })

    // The one who signed early
    await expect(notice).toContainText('Add a time and place before Dave signs.')
    await expect(notice).toContainText("You signed before these were required, so you'll sign again once they're in.")
    await expect(card(page)).not.toContainText('Waiting for Dave to sign')
    await expect(page.getByRole('button', { name: 'Add time and place' })).toHaveCount(1)

    // The other side: signing waits, details are the next step
    await switchTo(page, 'Dave', '/agreements/agreement-001')
    await expect(notice).toContainText('Add a time and place before signing.')
    await expect(notice).toContainText("Jamie signed before these were required, so they'll sign again once they're in.")
    await expect(signBtn(page)).toBeDisabled()
    await expect(honesty(page)).toHaveCount(0)
    await notice.getByRole('button', { name: 'Add time and place' }).click()
    await fillDetails(page, { method: 'Meet up in person', hours: 72, place: 'Overton Park shell' })
    await expect(page.getByText('Saved. You and Jamie can both sign now.').first()).toBeVisible()
    await expect(notice).toHaveCount(0)
    await expect(card(page)).toContainText("Jamie hasn't signed yet")

    await honesty(page).check()
    await signBtn(page).click()
    await expect(card(page)).toContainText('You signed. Waiting for Jamie to sign.')

    await switchTo(page, 'Jamie', '/agreements/agreement-001')
    await honesty(page).check()
    await signBtn(page).click()
    await expect(card(page)).toContainText('Ready to swap')
  })
})

test.describe('G-07 complete and review', () => {
  test('mark as done, then one 1 to 5 star review from each neighbor', async ({ page }) => {
    await start(page, 'Maria', '/agreements/agreement-002')
    await page.getByRole('button', { name: 'We made the swap' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Did the swap happen?' })).toBeVisible()
    await expect(dialog).toContainText("This closes the agreement and can't be undone.")
    await dialog.getByRole('button', { name: 'Not yet' }).click()
    await expect(card(page)).toContainText('Ready to swap')

    await page.getByRole('button', { name: 'We made the swap' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Yes, we swapped' }).click()
    await expect(card(page)).toContainText('Completed')
    await expect(page.getByRole('button', { name: 'We made the swap' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Cancel trade' })).toHaveCount(0)

    const stars = page.getByRole('radiogroup', { name: 'How was your trade with Dave Morrison?' })
    await expect(stars.getByRole('radio')).toHaveCount(5)
    for (const n of ['1 star', '2 stars', '3 stars', '4 stars', '5 stars']) await expect(stars.getByRole('radio', { name: n })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Post review' })).toBeDisabled()
    await expect(page.getByText('Tap a star to rate the trade.')).toBeVisible()
    await stars.getByRole('radio', { name: '4 stars' }).click()
    await expect(stars.getByRole('radio', { name: '4 stars' })).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('textbox', { name: 'Comment (optional)' }).fill('Great lasagna, on time.')
    await page.getByRole('button', { name: 'Post review' }).click()
    await expect(page.getByText('Great lasagna, on time.')).toBeVisible()
    await expect(page.getByRole('radiogroup')).toHaveCount(0) // one review each

    await switchTo(page, 'Dave', '/agreements/agreement-002')
    await expect(page.getByText('Great lasagna, on time.')).toBeVisible()
    const daveStars = page.getByRole('radiogroup', { name: 'How was your trade with Maria Santos?' })
    await daveStars.getByRole('radio', { name: '5 stars' }).click()
    await page.getByRole('button', { name: 'Post review' }).click()
    await expect(page.getByRole('radiogroup')).toHaveCount(0)

    const reviews = await withStores(page, (s) =>
      s.useReviewsStore.getState().reviews.map((r: Loose) => `${r.reviewerId}:${r.rating}`).sort())
    expect(reviews).toEqual(['user-002:4', 'user-008:5'])
    // A second review from the same neighbor is refused
    await withStores(page, (s) =>
      s.useReviewsStore.getState().addReview({ agreementId: 'agreement-002', reviewerId: 'user-008', revieweeId: 'user-002', rating: 1, comment: 'again' }))
    expect(await withStores(page, (s) => s.useReviewsStore.getState().reviews.length)).toBe(2)
  })
})

test.describe('G-08 cancel', () => {
  test('more than 24 hours out is not a late cancellation', async ({ page }) => {
    await start(page, 'Jamie', '/agreements/agreement-001')
    await expect(page.getByText(/Canceling within 24 hours of the meetup counts as a late cancellation on your profile/)).toBeVisible()
    await page.getByRole('button', { name: 'Cancel trade' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Cancel this trade?' })).toBeVisible()
    await expect(dialog).toContainText("This closes the agreement for both of you and can't be undone. We'll let Dave know.")
    await expect(dialog).not.toContainText('late cancellation')
    await dialog.getByRole('button', { name: 'Keep the trade' }).click()
    await expect(card(page)).toContainText('Waiting to sign')

    await page.getByRole('button', { name: 'Cancel trade' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel trade' }).click()
    await expect(page.getByText('Trade canceled. We let Dave know.').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Canceled' })).toBeVisible()
    await expect(page.getByText(/^You canceled this trade on/)).not.toContainText('late')
    await go(page, '/profile/me')
    await expect(page.getByText(/late cancellation/)).toHaveCount(0)
  })

  test('under 24 hours before an unsigned swap is not late either', async ({ page }) => {
    await freshAgreement(page)
    await page.getByRole('button', { name: 'Add time and place' }).click()
    await fillDetails(page, { method: 'Meet up in person', hours: 5, place: 'Overton Square' })
    await page.getByRole('button', { name: 'Cancel trade' }).click()
    await expect(page.getByRole('dialog')).not.toContainText('late cancellation')
  })

  test('under 24 hours after both signed warns first and shows on the profile', async ({ page }) => {
    await start(page, 'Maria', '/agreements/agreement-002')
    await page.getByRole('button', { name: 'Cancel trade' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('The swap is less than 24 hours away, so this counts as a late cancellation on your profile.')
    await dialog.getByRole('button', { name: 'Cancel trade' }).click()
    await expect(page.getByText(/You canceled this trade on .*It was less than 24 hours before the swap, so it shows as a late cancellation on your profile\./)).toBeVisible()
    await expect(card(page)).toContainText('Canceled')

    await go(page, '/profile/me')
    await expect(page.getByText('1 late cancellation (canceled less than 24 hours before a swap)')).toBeVisible()

    await switchTo(page, 'Dave', '/agreements/agreement-002')
    await expect(page.getByText(/Maria canceled this trade on .*late cancellation on their profile\./)).toBeVisible()
    await go(page, '/profile/maria_s')
    await expect(page.getByText('1 late cancellation (canceled less than 24 hours before a swap)')).toBeVisible()
  })
})

test.describe('G-09 flag for review', () => {
  test('needs a reason (blank refused, 500 max), shows the dispute copy and closes the trade', async ({ page }) => {
    await start(page, 'Maria', '/agreements/agreement-002')
    await page.getByRole('button', { name: 'Flag for review' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Flag this trade for review?' })).toBeVisible()
    await expect(dialog).toContainText("While it's flagged, neither of you can mark it done.")
    await expect(dialog).toContainText("it can't decide who's right or guarantee an outcome")
    const reason = dialog.getByRole('textbox', { name: 'What went wrong?' })

    await dialog.getByRole('button', { name: 'Flag trade' }).click()
    await expect(dialog.getByText('Say briefly what went wrong.')).toBeVisible()
    await reason.fill('     ')
    await dialog.getByRole('button', { name: 'Flag trade' }).click()
    await expect(dialog.getByText('Say briefly what went wrong.')).toBeVisible()
    await expect(dialog).toBeVisible()

    await reason.fill('a'.repeat(600))
    await expect(reason).toHaveValue('a'.repeat(500))
    await expect(dialog).toContainText('500 of 500 characters. Dave will see this.')

    await reason.fill('Dave moved the meetup twice and then stopped replying.')
    await dialog.getByRole('button', { name: 'Flag trade' }).click()
    await expect(page.getByText('Trade flagged. We let Dave know.').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Flagged for review' })).toBeVisible()
    await expect(page.locator('blockquote')).toHaveText('Dave moved the meetup twice and then stopped replying.')
    await expect(page.getByText(/Talk it through with Dave in your messages\. Bartrrr keeps the record of what you agreed to and can help you two talk, but it can't decide who's right or guarantee an outcome\./)).toBeVisible()
    await expect(card(page)).toContainText('Flagged')
    // Closed: none of the actions remain
    for (const name of ['We made the swap', 'Cancel trade', 'Flag for review', 'Sign agreement']) {
      await expect(page.getByRole('button', { name })).toHaveCount(0)
    }

    await switchTo(page, 'Dave', '/agreements/agreement-002')
    await expect(page.getByText(/Maria flagged this trade/)).toBeVisible()
    await expect(page.locator('blockquote')).toHaveText('Dave moved the meetup twice and then stopped replying.')
  })

  test('flagging a completed trade pauses reviews', async ({ page }) => {
    await start(page, 'Alex', '/agreements/agreement-003')
    await expect(page.getByRole('radiogroup', { name: /How was your trade with Nina/ })).toBeVisible()
    await page.getByRole('button', { name: 'Flag for review' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText("New reviews are paused while it's flagged.")
    await dialog.getByRole('textbox', { name: 'What went wrong?' }).fill('Two of the three logo concepts never arrived.')
    await dialog.getByRole('button', { name: 'Flag trade' }).click()
    await expect(page.getByRole('heading', { name: 'Flagged for review' })).toBeVisible()
    await expect(page.getByRole('radiogroup')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Post review' })).toHaveCount(0)
  })

  test('canceled and flagged trades cannot be reopened from the UI', async ({ page }) => {
    await start(page, 'Jamie', '/agreements/agreement-001')
    await withStores(page, (s) => {
      const st = s.useAgreementsStore.getState()
      st.cancelAgreement('agreement-001', 'user-001')
      st.flagAgreement('agreement-002', 'user-002', 'No show')
    })
    for (const [who, id] of [['Jamie', 'agreement-001'], ['Dave', 'agreement-001'], ['Maria', 'agreement-002'], ['Dave', 'agreement-002']] as const) {
      await switchTo(page, who, `/agreements/${id}`)
      await expect(card(page)).toContainText(/Canceled|Flagged/)
      for (const name of ['Sign agreement', 'Edit time and place', 'Add time and place', 'We made the swap', 'Cancel trade', 'Flag for review']) {
        await expect(page.getByRole('button', { name })).toHaveCount(0)
      }
      await expect(honesty(page)).toHaveCount(0)
    }
    // The store refuses to edit or cancel them too (signing: see the next test)
    const statuses = await withStores(page, (s) => {
      const st = s.useAgreementsStore.getState()
      st.updateExchangeDetails('agreement-001', 'user-008', { exchangeMethod: 'dropoff' })
      st.cancelAgreement('agreement-002', 'user-002')
      const now = s.useAgreementsStore.getState()
      return [now.getAgreementById('agreement-001').status, now.getAgreementById('agreement-001').exchangeMethod, now.getAgreementById('agreement-002').status]
    })
    expect(statuses).toEqual(['cancelled', 'in_person', 'disputed'])
  })

  test('the store refuses to sign a canceled agreement (T-42)', async ({ page }, testInfo) => {
    await start(page, 'Jamie', '/agreements/agreement-001')
    const status = await withStores(page, (s) => {
      const st = s.useAgreementsStore.getState()
      st.cancelAgreement('agreement-001', 'user-001')
      s.useAgreementsStore.getState().signAgreement('agreement-001', 'user-008')
      return s.useAgreementsStore.getState().getAgreementById('agreement-001').status
    })
    if (status !== 'cancelled') {
      await go(page, '/agreements/agreement-001')
      await shot(page, 'G-09-signed-after-cancel', testInfo.project.name)
    }
    expect(status).toBe('cancelled')
  })
})

test.describe('Agreements list', () => {
  test('tabs place every status correctly', async ({ page }) => {
    await start(page, 'Jamie')
    await withStores(page, (s) => {
      const st = s.useAgreementsStore.getState()
      const base = st.getAgreementById('agreement-001')
      const mk = (id: string, status: string, other: string, item: string) => ({
        ...base, id, offerId: `offer-${id}`, status,
        partyB: { userId: other, item, signed: status !== 'pending_signatures' && status !== 'draft' && status !== 'under_review' },
        partyA: { ...base.partyA, signed: !['draft', 'under_review'].includes(status) },
      })
      st.setAgreements([
        ...st.agreements,
        mk('t-draft', 'draft', 'user-003', 'Draft thing'),
        mk('t-review', 'under_review', 'user-003', 'Review thing'),
        mk('t-active', 'active', 'user-004', 'Active thing'),
        mk('t-done', 'completed', 'user-005', 'Done thing'),
        mk('t-cancel', 'cancelled', 'user-006', 'Canceled thing'),
        mk('t-flag', 'disputed', 'user-007', 'Flagged thing'),
      ])
    })
    await go(page, '/agreements')
    const tab = (name: string) => page.getByRole('tablist', { name: 'Agreement status' }).getByRole('tab', { name })
    const expectCards = async (items: [string, string][], absent: string[]) => {
      for (const [item, badge] of items) {
        await expect(page.locator('main article').filter({ hasText: item })).toContainText(badge)
      }
      for (const item of absent) await expect(page.locator('main article').filter({ hasText: item })).toHaveCount(0)
    }
    const all = ['KitchenAid', 'Draft thing', 'Review thing', 'Active thing', 'Done thing', 'Canceled thing', 'Flagged thing']
    await expect(tab('To sign')).toHaveAttribute('aria-selected', 'true')
    let shown: [string, string][] = [['KitchenAid', 'Waiting to sign'], ['Draft thing', 'Draft'], ['Review thing', 'In review']]
    await expectCards(shown, all.filter((a) => !shown.some(([i]) => i === a)))
    await tab('Ready to swap').click()
    shown = [['Active thing', 'Ready to swap']]
    await expectCards(shown, all.filter((a) => !shown.some(([i]) => i === a)))
    await tab('Done').click()
    shown = [['Done thing', 'Completed'], ['Canceled thing', 'Canceled'], ['Flagged thing', 'Flagged']]
    await expectCards(shown, all.filter((a) => !shown.some(([i]) => i === a)))
    // No raw enum values (style guide §3)
    await expect(page.locator('main')).not.toContainText(/pending_signatures|under_review|disputed|cancelled/)
  })

  test('empty tabs explain themselves', async ({ page }) => {
    await start(page, 'Priya', '/agreements')
    await expect(page.getByText('Nothing to sign')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Check your offers' })).toBeVisible()
    await page.getByRole('tab', { name: 'Ready to swap' }).click()
    await expect(page.getByText('No swaps scheduled')).toBeVisible()
    await page.getByRole('tab', { name: 'Done' }).click()
    await expect(page.getByText('No finished trades yet')).toBeVisible()
  })

  test('the agreements list is reachable from the main navigation', async ({ page }, testInfo) => {
    await start(page, 'Jamie', '/offers')
    const nav = page.locator('[aria-label="Main navigation"]:visible') // <aside> on desktop, <nav> on phones
    const link = nav.getByRole('link', { name: /Agreements/ })
    if ((await link.count()) === 0) await shot(page, 'G-agreements-no-mobile-nav', testInfo.project.name)
    await link.click({ timeout: 2000 })
    await expect(page).toHaveURL(/\/agreements$/)
  })
})
