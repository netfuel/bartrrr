import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TradeAgreement } from '@/types'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/supabase/supabase-service', () => ({
  signAgreement: vi.fn(),
  completeAgreement: vi.fn(),
  updateExchangeDetails: vi.fn(),
  cancelAgreement: vi.fn(),
  flagAgreement: vi.fn(),
}))
vi.mock('@/lib/push', () => ({ sendPushNotification: vi.fn() }))

import * as svc from '@/lib/supabase/supabase-service'
import { sendPushNotification } from '@/lib/push'
import { agreementIdForOffer, useAgreementsStore } from './agreements-store'
import { useToastStore } from './toast-store'

const flush = () => new Promise((r) => setTimeout(r, 0))
const lastToast = () => useToastStore.getState().toasts.at(-1)?.message
const H = 3_600_000
const SWAP = '2026-11-07T16:00:00.000Z'

const agreement = (over: Partial<TradeAgreement> = {}): TradeAgreement => ({
  id: 'agreement-offer-1',
  offerId: 'offer-1',
  partyA: { userId: 'a', item: 'Bike', signed: true },
  partyB: { userId: 'b', item: 'Gardening', signed: true },
  exchangeMethod: 'in_person',
  exchangeDate: SWAP,
  exchangeLocation: 'Overton Park',
  status: 'active',
  createdAt: '2026-11-01T00:00:00Z',
  ...over,
})
const get = () => useAgreementsStore.getState().getAgreementById('agreement-offer-1')!

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-03T12:00:00Z'))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  useAgreementsStore.setState({ agreements: [agreement()] })
  useToastStore.setState({ toasts: [] })
})
afterEach(() => vi.useRealTimers())

describe('createAgreement', () => {
  it('drafts once per offer with the server id', () => {
    useAgreementsStore.setState({ agreements: [] })
    const data = { offerId: 'offer-9', partyA: { userId: 'a', item: 'x' }, partyB: { userId: 'b', item: 'y' } }
    const id = useAgreementsStore.getState().createAgreement(data)
    expect(id).toBe(agreementIdForOffer('offer-9'))
    expect(useAgreementsStore.getState().createAgreement(data)).toBe(id)
    expect(useAgreementsStore.getState().agreements).toHaveLength(1)
    expect(useAgreementsStore.getState().agreements[0]).toMatchObject({
      status: 'pending_signatures',
      partyA: { signed: false },
      partyB: { signed: false },
    })
  })
})

describe('cancelAgreement', () => {
  it('more than 24 h out: not late', () => {
    vi.mocked(svc.cancelAgreement).mockReturnValue(new Promise(() => {}))
    expect(useAgreementsStore.getState().cancelAgreement('agreement-offer-1', 'a')).toBe(false)
    expect(get()).toMatchObject({ status: 'cancelled', cancelledBy: 'a', cancelledLate: false })
  })

  it('under 24 h before an agreed swap: late', () => {
    vi.setSystemTime(Date.parse(SWAP) - 23 * H)
    vi.mocked(svc.cancelAgreement).mockReturnValue(new Promise(() => {}))
    expect(useAgreementsStore.getState().cancelAgreement('agreement-offer-1', 'a')).toBe(true)
    expect(get().cancelledLate).toBe(true)
  })

  it('exactly 24 h before: not late', () => {
    vi.setSystemTime(Date.parse(SWAP) - 24 * H)
    vi.mocked(svc.cancelAgreement).mockReturnValue(new Promise(() => {}))
    expect(useAgreementsStore.getState().cancelAgreement('agreement-offer-1', 'a')).toBe(false)
  })

  it('before both signed it is never late', () => {
    vi.setSystemTime(Date.parse(SWAP) - H)
    useAgreementsStore.setState({ agreements: [agreement({ status: 'pending_signatures' })] })
    vi.mocked(svc.cancelAgreement).mockReturnValue(new Promise(() => {}))
    expect(useAgreementsStore.getState().cancelAgreement('agreement-offer-1', 'a')).toBe(false)
  })

  it.each(['completed', 'cancelled', 'disputed'] as const)('refuses a %s agreement', (status) => {
    useAgreementsStore.setState({ agreements: [agreement({ status })] })
    expect(useAgreementsStore.getState().cancelAgreement('agreement-offer-1', 'a')).toBe(false)
    expect(svc.cancelAgreement).not.toHaveBeenCalled()
    expect(get().status).toBe(status)
  })

  it('applies the server copy and notifies the other neighbor', async () => {
    vi.mocked(svc.cancelAgreement).mockResolvedValue(agreement({ status: 'cancelled', cancelledLate: true }))
    useAgreementsStore.getState().cancelAgreement('agreement-offer-1', 'b')
    await flush()
    expect(get().cancelledLate).toBe(true)
    expect(sendPushNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'a', title: 'Trade canceled' }))
  })

  it('rolls back on failure', async () => {
    vi.mocked(svc.cancelAgreement).mockRejectedValue({ code: 'P0001', message: 'Already done.' })
    useAgreementsStore.getState().cancelAgreement('agreement-offer-1', 'a')
    await flush()
    expect(get()).toEqual(agreement())
    expect(lastToast()).toBe("Couldn't cancel the trade: Already done.")
  })
})

describe('flagAgreement', () => {
  it('flags with a trimmed reason', () => {
    vi.mocked(svc.flagAgreement).mockReturnValue(new Promise(() => {}))
    useAgreementsStore.getState().flagAgreement('agreement-offer-1', 'a', '  no show  ')
    expect(get()).toMatchObject({ status: 'disputed', disputedBy: 'a', disputeReason: 'no show' })
    expect(svc.flagAgreement).toHaveBeenCalledWith('agreement-offer-1', 'no show')
  })

  it('ignores an empty reason', () => {
    useAgreementsStore.getState().flagAgreement('agreement-offer-1', 'a', '   ')
    expect(svc.flagAgreement).not.toHaveBeenCalled()
    expect(get().status).toBe('active')
  })

  it.each(['pending_signatures', 'cancelled', 'disputed'] as const)('refuses a %s agreement', (status) => {
    useAgreementsStore.setState({ agreements: [agreement({ status })] })
    useAgreementsStore.getState().flagAgreement('agreement-offer-1', 'a', 'x')
    expect(svc.flagAgreement).not.toHaveBeenCalled()
  })

  it('a completed trade can be flagged', () => {
    vi.mocked(svc.flagAgreement).mockReturnValue(new Promise(() => {}))
    useAgreementsStore.setState({ agreements: [agreement({ status: 'completed' })] })
    useAgreementsStore.getState().flagAgreement('agreement-offer-1', 'a', 'Broken')
    expect(get().status).toBe('disputed')
  })

  it('rolls back on failure', async () => {
    vi.mocked(svc.flagAgreement).mockRejectedValue(new Error('x'))
    useAgreementsStore.getState().flagAgreement('agreement-offer-1', 'a', 'no show')
    await flush()
    expect(get()).toEqual(agreement())
  })
})

describe('updateExchangeDetails', () => {
  const draft = () =>
    agreement({ status: 'pending_signatures', partyA: { userId: 'a', item: 'Bike', signed: true }, partyB: { userId: 'b', item: 'G', signed: false } })

  it('saves trimmed details and clears both signatures', () => {
    useAgreementsStore.setState({ agreements: [draft()] })
    vi.mocked(svc.updateExchangeDetails).mockReturnValue(new Promise(() => {}))
    useAgreementsStore.getState().updateExchangeDetails('agreement-offer-1', 'b', {
      exchangeMethod: 'dropoff',
      exchangeDate: SWAP,
      exchangeLocation: '  Porch  ',
      specialInstructions: '   ',
    })
    expect(get()).toMatchObject({
      exchangeMethod: 'dropoff',
      exchangeLocation: 'Porch',
      specialInstructions: undefined,
      partyA: { signed: false },
      partyB: { signed: false },
      termsUpdatedBy: 'b',
    })
  })

  it('refuses once both signed (active)', () => {
    useAgreementsStore.getState().updateExchangeDetails('agreement-offer-1', 'a', { exchangeLocation: 'x' })
    expect(svc.updateExchangeDetails).not.toHaveBeenCalled()
  })

  it('rolls back on failure, restoring the signature', async () => {
    useAgreementsStore.setState({ agreements: [draft()] })
    vi.mocked(svc.updateExchangeDetails).mockRejectedValue(new Error('x'))
    useAgreementsStore.getState().updateExchangeDetails('agreement-offer-1', 'b', { exchangeLocation: 'Porch' })
    await flush()
    expect(get()).toEqual(draft())
    expect(lastToast()).toBe("Couldn't save the time and place. Try again in a moment.")
  })

  it('notifies the other neighbor after saving', async () => {
    useAgreementsStore.setState({ agreements: [draft()] })
    vi.mocked(svc.updateExchangeDetails).mockResolvedValue(draft())
    useAgreementsStore.getState().updateExchangeDetails('agreement-offer-1', 'b', { exchangeLocation: 'Porch' })
    await flush()
    expect(sendPushNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'a' }))
  })
})

describe('sign and complete', () => {
  it('second signature makes it active', () => {
    useAgreementsStore.setState({
      agreements: [agreement({ status: 'pending_signatures', partyB: { userId: 'b', item: 'G', signed: false } })],
    })
    vi.mocked(svc.signAgreement).mockReturnValue(new Promise(() => {}))
    useAgreementsStore.getState().signAgreement('agreement-offer-1', 'b')
    expect(get().status).toBe('active')
  })

  it('complete with a backend only from active', () => {
    useAgreementsStore.setState({ agreements: [agreement({ status: 'pending_signatures' })] })
    useAgreementsStore.getState().completeAgreement('agreement-offer-1')
    expect(svc.completeAgreement).not.toHaveBeenCalled()
  })

  it('complete rolls back on failure', async () => {
    vi.mocked(svc.completeAgreement).mockRejectedValue(new Error('x'))
    useAgreementsStore.getState().completeAgreement('agreement-offer-1')
    expect(get().status).toBe('completed')
    await flush()
    expect(get()).toEqual(agreement())
  })
})
