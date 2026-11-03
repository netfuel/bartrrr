import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { TradeAgreement } from '@/types'
import {
  canCancel,
  canFlag,
  exchangeTime,
  formatExchangeTime,
  formatShortDate,
  fromLocalInputValue,
  isBeingAgreed,
  isLateCancellation,
  LATE_CANCEL_HOURS,
  listPhrase,
  missingDetails,
  toLocalInputValue,
} from './agreements'

const H = 3_600_000

const agreement = (over: Partial<TradeAgreement> = {}): TradeAgreement => ({
  id: 'agreement-offer-1',
  offerId: 'offer-1',
  partyA: { userId: 'a', item: 'Bike', signed: true },
  partyB: { userId: 'b', item: 'Gardening help', signed: true },
  exchangeMethod: 'in_person',
  exchangeDate: '2026-11-07T16:00:00.000Z',
  exchangeLocation: 'Overton Park',
  status: 'active',
  createdAt: '2026-11-01T12:00:00.000Z',
  ...over,
})

// Z-03 runs in Memphis time so DST and midnight cases mean something
beforeAll(() => {
  vi.stubEnv('TZ', 'America/Chicago')
})
afterAll(() => {
  vi.unstubAllEnvs()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('time zone setup', () => {
  it('runs in America/Chicago (CDT before Nov 1 2026, CST after)', () => {
    expect(new Date('2026-10-31T12:00:00Z').getTimezoneOffset()).toBe(300)
    expect(new Date('2026-11-02T12:00:00Z').getTimezoneOffset()).toBe(360)
  })
})

describe('status helpers', () => {
  it.each([
    ['draft', true, true, false],
    ['under_review', true, true, false],
    ['pending_signatures', true, true, false],
    ['active', false, true, true],
    ['completed', false, false, true],
    ['cancelled', false, false, false],
    ['disputed', false, false, false],
  ] as const)('%s: beingAgreed=%s canCancel=%s canFlag=%s', (status, agreed, cancel, flag) => {
    const a = { status }
    expect(isBeingAgreed(a)).toBe(agreed)
    expect(canCancel(a)).toBe(cancel)
    expect(canFlag(a)).toBe(flag)
  })
})

describe('exchangeTime', () => {
  it('parses an ISO time', () => {
    expect(exchangeTime(agreement())?.toISOString()).toBe('2026-11-07T16:00:00.000Z')
  })
  it('null for unset or legacy free text', () => {
    expect(exchangeTime({ exchangeDate: undefined })).toBeNull()
    expect(exchangeTime({ exchangeDate: '' })).toBeNull()
    expect(exchangeTime({ exchangeDate: 'Saturday morning' })).toBeNull()
  })
})

describe('isLateCancellation (Z-03)', () => {
  const swap = Date.parse('2026-11-07T16:00:00.000Z') // Saturday 10:00 AM CST

  it('LATE_CANCEL_HOURS is 24', () => expect(LATE_CANCEL_HOURS).toBe(24))

  it('exactly 24 hours before is not late; one ms later is', () => {
    const a = agreement()
    expect(isLateCancellation(a, swap - 24 * H)).toBe(false)
    expect(isLateCancellation(a, swap - 24 * H + 1)).toBe(true)
    expect(isLateCancellation(a, swap - 24 * H - 1)).toBe(false)
  })

  it('after the swap time is late', () => {
    expect(isLateCancellation(agreement(), swap + H)).toBe(true)
  })

  it('only counts once both signed (status active)', () => {
    for (const status of ['draft', 'under_review', 'pending_signatures', 'completed', 'cancelled', 'disputed'] as const) {
      expect(isLateCancellation(agreement({ status }), swap - H)).toBe(false)
    }
  })

  it('no swap time means never late', () => {
    expect(isLateCancellation(agreement({ exchangeDate: undefined }), swap)).toBe(false)
    expect(isLateCancellation(agreement({ exchangeDate: 'tomorrow' }), swap)).toBe(false)
  })

  it('uses the clock by default (fake timers)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(swap - 23 * H)
    expect(isLateCancellation(agreement())).toBe(true)
    vi.setSystemTime(swap - 25 * H)
    expect(isLateCancellation(agreement())).toBe(false)
  })

  describe('across the Nov 1 2026 fall-back (2:00 AM CDT becomes 1:00 AM CST)', () => {
    // Swap Sunday Nov 1, 10:00 AM CST = 16:00Z. The day before is 25 wall-clock hours long.
    const dstSwap = agreement({ exchangeDate: '2026-11-01T16:00:00.000Z' })
    const swapMs = Date.parse('2026-11-01T16:00:00.000Z')

    it('the window is 24 real hours: 11:00 AM CDT Saturday, not 10:00 AM', () => {
      const boundary = swapMs - 24 * H
      expect(new Date(boundary).toISOString()).toBe('2026-10-31T16:00:00.000Z')
      expect(new Date(boundary).getHours()).toBe(11) // 11:00 AM CDT wall clock
      expect(isLateCancellation(dstSwap, boundary)).toBe(false)
      expect(isLateCancellation(dstSwap, boundary + 1)).toBe(true)
    })

    it('10:30 AM Saturday (same wall-clock time + 30 min, but 24.5 real hours out) is not late', () => {
      const tenThirtySat = Date.parse('2026-10-31T15:30:00.000Z') // 10:30 CDT
      expect(new Date(tenThirtySat).getHours()).toBe(10)
      expect(isLateCancellation(dstSwap, tenThirtySat)).toBe(false)
    })

    it('during the repeated 1 AM hour both instants are handled by real time', () => {
      const firstOneAm = Date.parse('2026-11-01T06:30:00.000Z') // 1:30 CDT
      const secondOneAm = Date.parse('2026-11-01T07:30:00.000Z') // 1:30 CST
      expect(new Date(firstOneAm).getHours()).toBe(1)
      expect(new Date(secondOneAm).getHours()).toBe(1)
      expect(isLateCancellation(dstSwap, firstOneAm)).toBe(true)
      expect(isLateCancellation(dstSwap, secondOneAm)).toBe(true)
    })
  })

  describe('around midnight', () => {
    // Swap just after midnight Sunday: 12:05 AM CST Nov 8 = 06:05Z
    const midnightSwap = agreement({ exchangeDate: '2026-11-08T06:05:00.000Z' })
    const swapMs = Date.parse('2026-11-08T06:05:00.000Z')

    it('11:59 PM Friday (24h06m before) is not late, 12:06 AM Saturday is', () => {
      expect(isLateCancellation(midnightSwap, swapMs - 24 * H - 6 * 60_000)).toBe(false)
      expect(isLateCancellation(midnightSwap, swapMs - 24 * H + 60_000)).toBe(true)
    })
  })
})

describe('missingDetails and listPhrase', () => {
  it('nothing missing when complete', () => {
    expect(missingDetails(agreement())).toEqual([])
  })
  it('lists everything in reading order', () => {
    expect(
      missingDetails(agreement({ exchangeMethod: undefined, exchangeDate: undefined, exchangeLocation: undefined })),
    ).toEqual(["how you'll swap", 'a date and time', 'a place'])
  })
  it('whitespace place and free-text date count as missing', () => {
    expect(missingDetails(agreement({ exchangeLocation: '   ', exchangeDate: 'soon' }))).toEqual([
      'a date and time',
      'a place',
    ])
  })
  it('a past date is still a date (the server rejects past times on save)', () => {
    expect(missingDetails(agreement({ exchangeDate: '2020-01-01T00:00:00Z' }))).toEqual([])
  })
  it.each([
    [[], ''],
    [['a place'], 'a place'],
    [['a', 'b'], 'a and b'],
    [["how you'll swap", 'a date and time', 'a place'], "how you'll swap, a date and time and a place"],
  ])('listPhrase(%j) = %j', (items, out) => {
    expect(listPhrase(items)).toBe(out)
  })
})

describe('formatting in the viewer time zone', () => {
  it('formatExchangeTime: "Saturday, November 7 at 10:00 AM"', () => {
    expect(formatExchangeTime(new Date('2026-11-07T16:00:00Z'))).toMatch(/^Saturday, November 7 at 10:00\sAM$/)
  })
  it('formatExchangeTime on the DST day uses CST after the change', () => {
    expect(formatExchangeTime(new Date('2026-11-01T16:00:00Z'))).toMatch(/^Sunday, November 1 at 10:00\sAM$/)
  })
  it('formatExchangeTime just before midnight stays on the same day', () => {
    expect(formatExchangeTime(new Date('2026-11-08T05:59:00Z'))).toMatch(/^Saturday, November 7 at 11:59\sPM$/)
  })
  it('formatShortDate', () => {
    expect(formatShortDate('2026-10-28T17:00:00Z')).toBe('Oct 28')
    // 11:30 PM Oct 28 in Memphis is Oct 29 in UTC
    expect(formatShortDate('2026-10-29T04:30:00Z')).toBe('Oct 28')
  })
})

describe('datetime-local round trip', () => {
  it('toLocalInputValue shows Memphis wall-clock time', () => {
    expect(toLocalInputValue('2026-11-07T16:00:00.000Z')).toBe('2026-11-07T10:00')
    expect(toLocalInputValue('2026-10-31T15:00:00.000Z')).toBe('2026-10-31T10:00')
  })
  it('toLocalInputValue: empty for unset or garbage', () => {
    expect(toLocalInputValue(undefined)).toBe('')
    expect(toLocalInputValue('soon')).toBe('')
  })
  it('fromLocalInputValue reads the value as Memphis time', () => {
    expect(fromLocalInputValue('2026-11-07T10:00')).toBe('2026-11-07T16:00:00.000Z')
    expect(fromLocalInputValue('2026-10-31T10:00')).toBe('2026-10-31T15:00:00.000Z')
    expect(fromLocalInputValue('2026-11-08T00:00')).toBe('2026-11-08T06:00:00.000Z')
  })
  it('fromLocalInputValue: undefined for empty or invalid', () => {
    expect(fromLocalInputValue('')).toBeUndefined()
    expect(fromLocalInputValue('not-a-date')).toBeUndefined()
  })
  it('round-trips on both sides of the DST change', () => {
    for (const iso of ['2026-10-31T23:15:00.000Z', '2026-11-01T05:00:00.000Z', '2026-11-01T08:00:00.000Z', '2026-11-02T06:00:00.000Z']) {
      expect(fromLocalInputValue(toLocalInputValue(iso))).toBe(iso)
    }
  })
  it('the ambiguous 1:30 AM on Nov 1 resolves to one real instant (the first, CDT)', () => {
    expect(fromLocalInputValue('2026-11-01T01:30')).toBe('2026-11-01T06:30:00.000Z')
  })
})
