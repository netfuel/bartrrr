import { describe, expect, it } from 'vitest'
import { DECLINE_REASON_LABELS, type Offer, type OfferMessage } from '@/types'
import { declineContent, declinePayload, declineSummary, isOpenOffer, lastMove, messagePreview, parseDecline, whoseMove } from './offers'

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

describe('decline reason codes (migration 014, T-67)', () => {
  const label = DECLINE_REASON_LABELS.not_fair

  it('sends the code, and the note or the code as content', () => {
    expect(declinePayload('not_fair', '  Too low  ')).toEqual({ reason: 'not_fair', content: 'Too low' })
    expect(declinePayload('not_fair', '   ')).toEqual({ reason: 'not_fair', content: 'not_fair' })
    expect(declinePayload('not_fair')).toEqual({ reason: 'not_fair', content: 'not_fair' })
  })

  it('round-trips every reason through the new shape, with and without a note', () => {
    for (const key of Object.keys(DECLINE_REASON_LABELS) as (keyof typeof DECLINE_REASON_LABELS)[]) {
      const bare = declinePayload(key)
      expect(parseDecline(bare.content, bare.reason)).toEqual({ reason: key })
      const noted = declinePayload(key, 'A note. With dots.')
      expect(parseDecline(noted.content, noted.reason)).toEqual({ reason: key, note: 'A note. With dots.' })
    }
  })

  it('a note that happens to read like another reason stays a note under its code', () => {
    const other = DECLINE_REASON_LABELS.not_interested
    expect(parseDecline(other, 'not_fair')).toEqual({ reason: 'not_fair', note: other })
  })

  it('reads old rows the 014 backfill gave a code (content left as written)', () => {
    expect(parseDecline(declineContent('not_fair', 'Too low'), 'not_fair')).toEqual({ reason: 'not_fair', note: 'Too low' })
    expect(parseDecline(label, 'not_fair')).toEqual({ reason: 'not_fair' })
    expect(parseDecline('not_fair', 'not_fair')).toEqual({ reason: 'not_fair' })
  })

  it('without a code (database before 014, note-only decline) reads content as before', () => {
    expect(parseDecline(declineContent('not_fair', 'Too low'), null)).toEqual({ reason: 'not_fair', note: 'Too low' })
    expect(parseDecline('Too low', undefined)).toEqual({ note: 'Too low' })
  })

  it('ignores a code the app doesn\'t know', () => {
    expect(parseDecline('Too low', 'rude')).toEqual({ note: 'Too low' })
    expect(parseDecline('Too low', 'toString')).toEqual({ note: 'Too low' })
  })

  it('previews use the code', () => {
    expect(declineSummary('Too low', 'not_fair')).toBe(`Declined: ${label}. Too low`)
    expect(messagePreview({ type: 'decline', content: 'Too low', declineReason: 'not_fair' })).toBe(`Declined: ${label}. Too low`)
    expect(messagePreview({ type: 'decline', content: 'not_fair', declineReason: 'not_fair' })).toBe(`Declined: ${label}`)
  })
})
