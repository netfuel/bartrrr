import { describe, expect, it } from 'vitest'
import { NOTIFICATION_TYPES, notificationLink, notificationMeta } from './notifications'

describe('notification types (T-04, migration 014)', () => {
  it('cancel, flag and withdraw have their own labels and icons', () => {
    expect(NOTIFICATION_TYPES.trade_canceled.label).toBe('Trade canceled')
    expect(NOTIFICATION_TYPES.trade_flagged.label).toBe('Trade flagged')
    expect(NOTIFICATION_TYPES.offer_withdrawn.label).toBe('Offer withdrawn')
    expect(NOTIFICATION_TYPES.trade_flagged.icon).not.toBe(NOTIFICATION_TYPES.agreement_ready.icon)
    expect(NOTIFICATION_TYPES.offer_withdrawn.icon).not.toBe(NOTIFICATION_TYPES.offer_declined.icon)
  })

  it('settings switches match the server (notification_pref_key, 012/014)', () => {
    const prefs = Object.fromEntries(Object.entries(NOTIFICATION_TYPES).map(([type, m]) => [type, m.pref ?? null]))
    expect(prefs).toEqual({
      new_offer: 'newOffers',
      counter_offer: 'newOffers',
      offer_accepted: null,
      offer_declined: null,
      offer_withdrawn: null,
      new_message: 'messages',
      agreement_ready: 'agreementUpdates',
      trade_canceled: null,
      trade_flagged: null,
      trade_complete: 'tradeCompletions',
      review_request: 'tradeCompletions',
      match: 'perfectMatches',
    })
  })

  it('an unknown type (newer server) still renders', () => {
    expect(notificationMeta('something_new').label).toBe('Update')
    expect(notificationMeta('trade_canceled').label).toBe('Trade canceled')
  })
})

describe('notificationLink', () => {
  it('trade updates open the agreement', () => {
    expect(notificationLink({ type: 'trade_canceled', data: { agreementId: 'a1' } })).toBe('/agreements/a1')
    expect(notificationLink({ type: 'trade_flagged', data: { agreementId: 'a1', offerId: 'o1' } })).toBe('/agreements/a1')
  })
  it('offer updates open the offer, even with an agreement id (accepted)', () => {
    expect(notificationLink({ type: 'offer_accepted', data: { offerId: 'o1', agreementId: 'a1' } })).toBe('/offers/o1')
    expect(notificationLink({ type: 'offer_withdrawn', data: { offerId: 'o1' } })).toBe('/offers/o1')
  })
  it('matches open the listing; nothing to go on opens the offers list', () => {
    expect(notificationLink({ type: 'match', data: { listingId: 'l1' } })).toBe('/listing/l1')
    expect(notificationLink({ type: 'new_message', data: undefined })).toBe('/offers')
  })
})
