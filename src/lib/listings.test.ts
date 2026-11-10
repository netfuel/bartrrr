import { describe, expect, it } from 'vitest'
import { categoryTakesCondition, isListingExpired, isListingLive, isPastExpiry, listingStatus } from './listings'

const NOW = Date.parse('2026-11-10T12:00:00Z')
const past = '2026-11-10T11:00:00Z'
const future = '2026-12-10T12:00:00Z'

describe('listing expiry (T-48)', () => {
  it('an active listing past its 30 days reads as closed', () => {
    const l = { status: 'active' as const, expiresAt: past }
    expect(isListingExpired(l, NOW)).toBe(true)
    expect(listingStatus(l, NOW)).toBe('closed')
    expect(isListingLive(l, NOW)).toBe(false)
  })

  it('an active listing within its 30 days stays active', () => {
    const l = { status: 'active' as const, expiresAt: future }
    expect(listingStatus(l, NOW)).toBe('active')
    expect(isListingLive(l, NOW)).toBe(true)
  })

  it('no or unreadable expiresAt never expires a listing', () => {
    expect(isListingLive({ status: 'active' }, NOW)).toBe(true)
    expect(isListingLive({ status: 'active', expiresAt: 'soon' }, NOW)).toBe(true)
  })

  it('pending and closed listings keep their status', () => {
    expect(listingStatus({ status: 'pending', expiresAt: past }, NOW)).toBe('pending')
    expect(listingStatus({ status: 'closed', expiresAt: future }, NOW)).toBe('closed')
    expect(isListingExpired({ status: 'closed', expiresAt: past }, NOW)).toBe(false)
    expect(isPastExpiry({ expiresAt: past }, NOW)).toBe(true)
  })
})

describe('categoryTakesCondition (T-49)', () => {
  it('only goods and outdoor listings carry a condition', () => {
    expect(categoryTakesCondition('goods')).toBe(true)
    expect(categoryTakesCondition('outdoor')).toBe(true)
    expect(categoryTakesCondition('services')).toBe(false)
    expect(categoryTakesCondition('skills')).toBe(false)
    expect(categoryTakesCondition(null)).toBe(false)
  })
})
