import { describe, expect, it } from 'vitest'
import { DECLINE_REASON_LABELS, type Offer, type OfferMessage } from '@/types'
import { declineContent, declineSummary, isOpenOffer, lastMove, messagePreview, parseDecline, whoseMove } from './offers'

let n = 0
const msg = (fromUserId: string, type: OfferMessage['type'], content = 'x'): OfferMessage => ({
  id: `m${++n}`,
  fromUserId,
  type,
  content,
  createdAt: '2026-11-01T12:00:00.000Z',
})

const offer = (messages: OfferMessage[], status: Offer['status'] = 'pending'): Pick<Offer, 'status' | 'fromUserId' | 'messages'> => ({
  status,
  fromUserId: 'maker',
  messages,
})

describe('whoseMove', () => {
  it('is the owner’s move on a new offer and the maker waits', () => {
    const o = offer([msg('maker', 'offer')])
    expect(whoseMove(o, 'owner')).toBe('mine')
    expect(whoseMove(o, 'maker')).toBe('theirs')
  })

  it('flips with each counter-offer', () => {
    const o = offer([msg('maker', 'offer'), msg('owner', 'counter')], 'countered')
    expect(whoseMove(o, 'owner')).toBe('theirs')
    expect(whoseMove(o, 'maker')).toBe('mine')
  })

  it('ignores chat messages', () => {
    const o = offer([msg('maker', 'offer'), msg('owner', 'message'), msg('owner', 'message')])
    expect(whoseMove(o, 'owner')).toBe('mine')
    expect(whoseMove(o, 'maker')).toBe('theirs')
  })

  it('falls back to the maker when the thread has no offer message', () => {
    expect(whoseMove(offer([]), 'owner')).toBe('mine')
    expect(whoseMove(offer([msg('owner', 'message')]), 'maker')).toBe('theirs')
  })

  it.each(['accepted', 'declined', 'withdrawn', 'expired'] as const)('is closed once %s', (status) => {
    const o = offer([msg('maker', 'offer')], status)
    expect(whoseMove(o, 'owner')).toBe('closed')
    expect(whoseMove(o, 'maker')).toBe('closed')
    expect(isOpenOffer(o)).toBe(false)
  })

  it('lastMove returns the latest offer or counter', () => {
    const counter = msg('owner', 'counter')
    expect(lastMove([msg('maker', 'offer'), counter, msg('maker', 'message')])).toBe(counter)
    expect(lastMove([msg('maker', 'message')])).toBeUndefined()
  })
})

describe('declines', () => {
  const label = DECLINE_REASON_LABELS.not_fair

  it('stores the reason key alone when there is no note', () => {
    expect(declineContent('not_fair')).toBe('not_fair')
    expect(declineContent('not_fair', '   ')).toBe('not_fair')
  })

  it('stores the reason label and the note together', () => {
    expect(declineContent('not_fair', '  Maybe add a capo?  ')).toBe(`${label}. Maybe add a capo?`)
  })

  it('round-trips every reason, with and without a note', () => {
    for (const key of Object.keys(DECLINE_REASON_LABELS) as (keyof typeof DECLINE_REASON_LABELS)[]) {
      expect(parseDecline(declineContent(key))).toEqual({ reason: key })
      expect(parseDecline(declineContent(key, 'A note. With dots.'))).toEqual({ reason: key, note: 'A note. With dots.' })
    }
  })

  it('reads older declines that hold only a note', () => {
    expect(parseDecline('Too low')).toEqual({ note: 'Too low' })
    expect(parseDecline('')).toEqual({})
  })

  it('summarizes for previews without raw codes', () => {
    expect(declineSummary('not_fair')).toBe(`Declined: ${label}`)
    expect(declineSummary(declineContent('not_fair', 'Too low'))).toBe(`Declined: ${label}. Too low`)
    expect(declineSummary('Too low')).toBe('Too low')
    expect(messagePreview({ type: 'decline', content: 'not_fair' })).toBe(`Declined: ${label}`)
    expect(messagePreview({ type: 'message', content: 'not_fair' })).toBe('not_fair')
  })
})
