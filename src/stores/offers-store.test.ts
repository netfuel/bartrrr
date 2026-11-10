import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Offer, TradeAgreement } from '@/types'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/supabase/supabase-service', () => ({
  createOffer: vi.fn(),
  acceptOffer: vi.fn(),
  declineOffer: vi.fn(),
  counterOffer: vi.fn(),
  withdrawOffer: vi.fn(),
  addOfferMessage: vi.fn(),
  fetchAgreement: vi.fn(),
}))
vi.mock('@/lib/push', () => ({ sendPushNotification: vi.fn() }))

import * as svc from '@/lib/supabase/supabase-service'
import { sendPushNotification } from '@/lib/push'
import { isOfferOpen, useOffersStore } from './offers-store'
import { useAgreementsStore } from './agreements-store'
import { useToastStore } from './toast-store'

const flush = () => new Promise((r) => setTimeout(r, 0))
const lastToast = () => useToastStore.getState().toasts.at(-1)?.message
const NOW = new Date('2026-11-03T12:00:00Z')

const offer = (over: Partial<Offer> = {}): Offer => ({
  id: 'offer-1',
  listingId: 'listing-1',
  fromUserId: 'maker',
  toUserId: 'owner',
  messages: [{ id: 'm1', fromUserId: 'maker', content: 'Bike for plants?', items: ['Monstera'], type: 'offer', createdAt: '2026-11-02T12:00:00Z' }],
  status: 'pending',
  round: 1,
  maxRounds: 5,
  expiresAt: '2026-11-05T12:00:00Z',
  createdAt: '2026-11-02T12:00:00Z',
  ...over,
})
const get = () => useOffersStore.getState().getOfferById('offer-1')!

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  useOffersStore.setState({ offers: [offer()] })
  useAgreementsStore.setState({ agreements: [] })
  useToastStore.setState({ toasts: [] })
})
afterEach(() => vi.useRealTimers())

describe('isOfferOpen', () => {
  it.each([
    ['pending', true],
    ['countered', true],
    ['accepted', false],
    ['declined', false],
    ['withdrawn', false],
    ['expired', false],
  ] as const)('%s → %s', (status, open) => {
    expect(isOfferOpen(offer({ status }))).toBe(open)
  })
})

describe('withdrawOffer', () => {
  it('refuses when you did not make the offer', () => {
    expect(useOffersStore.getState().withdrawOffer('offer-1', 'owner')).toBe(false)
    expect(svc.withdrawOffer).not.toHaveBeenCalled()
    expect(get().status).toBe('pending')
    expect(lastToast()).toBe('Only the neighbor who made this offer can withdraw it.')
  })

  it('refuses even when the listing owner sent the latest counter', () => {
    useOffersStore.setState({ offers: [offer({ status: 'countered', round: 2 })] })
    expect(useOffersStore.getState().withdrawOffer('offer-1', 'owner')).toBe(false)
  })

  it.each(['accepted', 'declined', 'withdrawn'] as const)('refuses a %s offer', (status) => {
    useOffersStore.setState({ offers: [offer({ status })] })
    expect(useOffersStore.getState().withdrawOffer('offer-1', 'maker')).toBe(false)
    expect(svc.withdrawOffer).not.toHaveBeenCalled()
    expect(lastToast()).toMatch(/^This offer is closed: /)
  })

  it('refuses an offer past its 72 hours and marks it expired', () => {
    useOffersStore.setState({ offers: [offer({ expiresAt: '2026-11-03T12:00:00Z' })] })
    expect(useOffersStore.getState().withdrawOffer('offer-1', 'maker')).toBe(false)
    expect(get().status).toBe('expired')
    expect(lastToast()).toBe('This offer expired after 72 hours without a reply. Make a new offer to keep trading.')
  })

  it('refuses an unknown offer quietly', () => {
    expect(useOffersStore.getState().withdrawOffer('nope', 'maker')).toBe(false)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('withdraws optimistically and notifies the listing owner', async () => {
    vi.mocked(svc.withdrawOffer).mockResolvedValue(offer({ status: 'withdrawn' }))
    expect(useOffersStore.getState().withdrawOffer('offer-1', 'maker')).toBe(true)
    expect(get().status).toBe('withdrawn')
    expect(get().messages).toHaveLength(1) // no thread message for a withdrawal
    await flush()
    expect(sendPushNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'owner', url: '/offers/offer-1' }))
  })

  it('rolls back when the server refuses', async () => {
    vi.mocked(svc.withdrawOffer).mockRejectedValue({ code: 'P0001', message: 'Only the offer maker can withdraw.' })
    useOffersStore.getState().withdrawOffer('offer-1', 'maker')
    await flush()
    expect(get()).toEqual(offer())
    expect(lastToast()).toBe("Couldn't withdraw your offer: Only the offer maker can withdraw.")
    expect(sendPushNotification).not.toHaveBeenCalled()
  })
})

describe('createOffer', () => {
  const data = { listingId: 'listing-9', fromUserId: 'maker', toUserId: 'owner', content: 'Hi', items: ['Lamp'] }

  it('adds a pending 72-hour offer with a DB-format id', () => {
    vi.mocked(svc.createOffer).mockReturnValue(new Promise(() => {}))
    const id = useOffersStore.getState().createOffer(data)
    expect(id).toMatch(/^offer-[0-9a-f]{32}$/)
    const o = useOffersStore.getState().getOfferById(id)!
    expect(o).toMatchObject({ status: 'pending', round: 1, maxRounds: 5, expiresAt: '2026-11-06T12:00:00.000Z' })
    expect(o.messages[0]).toMatchObject({ type: 'offer', content: 'Hi', items: ['Lamp'] })
  })

  it('removes it when the save fails', async () => {
    vi.mocked(svc.createOffer).mockRejectedValue(new TypeError('Failed to fetch'))
    const id = useOffersStore.getState().createOffer(data)
    await flush()
    expect(useOffersStore.getState().getOfferById(id)).toBeUndefined()
    expect(lastToast()).toBe("Couldn't send your offer. Check your connection and try again.")
  })
})

describe('counterOffer', () => {
  it('bumps the round and restarts the 72 hours', () => {
    vi.mocked(svc.counterOffer).mockReturnValue(new Promise(() => {}))
    useOffersStore.getState().counterOffer('offer-1', 'owner', 'How about a lamp?', ['Lamp'])
    expect(get()).toMatchObject({ status: 'countered', round: 2, expiresAt: '2026-11-06T12:00:00.000Z' })
    expect(get().messages.at(-1)).toMatchObject({ type: 'counter', fromUserId: 'owner' })
  })

  it('refuses past the 5-round cap', () => {
    useOffersStore.setState({ offers: [offer({ status: 'countered', round: 5 })] })
    useOffersStore.getState().counterOffer('offer-1', 'owner', 'again', [])
    expect(svc.counterOffer).not.toHaveBeenCalled()
    expect(lastToast()).toBe('Counter-offers are limited to 5 rounds. Accept or decline this one.')
  })

  it('rolls back on failure', async () => {
    vi.mocked(svc.counterOffer).mockRejectedValue(new Error('x'))
    useOffersStore.getState().counterOffer('offer-1', 'owner', 'x', [])
    await flush()
    expect(get()).toEqual(offer())
  })
})

describe('acceptOffer and declineOffer', () => {
  it('accept loads the server-drafted agreement', async () => {
    const agreement = { id: 'agreement-offer-1', offerId: 'offer-1' } as TradeAgreement
    vi.mocked(svc.acceptOffer).mockResolvedValue(offer({ status: 'accepted' }))
    vi.mocked(svc.fetchAgreement).mockResolvedValue(agreement)
    useOffersStore.getState().acceptOffer('offer-1', 'owner')
    expect(get().status).toBe('accepted')
    await flush()
    expect(svc.fetchAgreement).toHaveBeenCalledWith('agreement-offer-1')
    expect(useAgreementsStore.getState().getAgreementById('agreement-offer-1')).toBe(agreement)
    expect(sendPushNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'maker' }))
  })

  it('a failed accept removes the optimistic agreement too', async () => {
    useAgreementsStore.getState().createAgreement({
      offerId: 'offer-1',
      partyA: { userId: 'maker', item: 'Monstera' },
      partyB: { userId: 'owner', item: 'Bike' },
    })
    vi.mocked(svc.acceptOffer).mockRejectedValue(new Error('x'))
    useOffersStore.getState().acceptOffer('offer-1', 'owner')
    await flush()
    expect(get().status).toBe('pending')
    expect(useAgreementsStore.getState().agreements).toHaveLength(0)
  })

  it('decline keeps both the reason and the note, and rolls back on failure', async () => {
    vi.mocked(svc.declineOffer).mockRejectedValue(new Error('x'))
    useOffersStore.getState().declineOffer('offer-1', 'owner', 'not_fair', 'Too low')
    expect(get().messages.at(-1)).toMatchObject({ type: 'decline', content: "Offer doesn't feel like a fair trade. Too low" })
    expect(svc.declineOffer).toHaveBeenCalledWith('offer-1', expect.any(String), 'not_fair', 'Too low')
    await flush()
    expect(get()).toEqual(offer())
  })
})

describe('addMessage', () => {
  it('removes only the failed message', async () => {
    vi.mocked(svc.addOfferMessage).mockRejectedValue(new Error('x'))
    useOffersStore.getState().addMessage('offer-1', 'owner', 'Is it still available?')
    expect(get().messages).toHaveLength(2)
    await flush()
    expect(get().messages.map((m) => m.id)).toEqual(['m1'])
  })
})

describe('expiry', () => {
  it('expireStale flips only open offers past their window', () => {
    useOffersStore.setState({
      offers: [
        offer({ id: 'a', expiresAt: '2026-11-03T11:59:59Z' }),
        offer({ id: 'b', expiresAt: '2026-11-03T12:00:01Z' }),
        offer({ id: 'c', status: 'accepted', expiresAt: '2026-01-01T00:00:00Z' }),
        offer({ id: 'd', status: 'countered', expiresAt: '2026-11-03T12:00:00Z' }),
      ],
    })
    useOffersStore.getState().expireStale()
    expect(useOffersStore.getState().offers.map((o) => o.status)).toEqual(['expired', 'pending', 'accepted', 'expired'])
  })

  it('expireStale does not touch state when nothing changed', () => {
    const before = useOffersStore.getState().offers
    useOffersStore.getState().expireStale()
    expect(useOffersStore.getState().offers).toBe(before)
  })

  it('setOffers applies expiry on load', () => {
    useOffersStore.getState().setOffers([offer({ expiresAt: '2026-11-01T00:00:00Z' })])
    expect(get().status).toBe('expired')
  })

  it('getOffersByUser splits incoming and outgoing', () => {
    const { incoming, outgoing } = useOffersStore.getState().getOffersByUser('owner')
    expect(incoming.map((o) => o.id)).toEqual(['offer-1'])
    expect(outgoing).toEqual([])
  })
})
