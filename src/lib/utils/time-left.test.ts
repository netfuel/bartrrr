import { describe, expect, it } from 'vitest'
import { formatTimeLeft } from './time-left'

const NOW = Date.parse('2026-11-03T12:00:00Z')
const at = (ms: number) => new Date(NOW + ms).toISOString()
const H = 3_600_000
const M = 60_000

describe('formatTimeLeft', () => {
  it('a fresh 72-hour offer reads "3 days"', () => {
    expect(formatTimeLeft(at(72 * H), NOW)).toBe('3 days')
  })
  it('switches from days to hours below 48 hours', () => {
    expect(formatTimeLeft(at(48 * H), NOW)).toBe('2 days')
    expect(formatTimeLeft(at(48 * H - 1), NOW)).toBe('47 hours')
  })
  it('uses whole days (floors)', () => {
    expect(formatTimeLeft(at(71 * H + 59 * M), NOW)).toBe('2 days')
  })
  it('singular hour and minute', () => {
    expect(formatTimeLeft(at(H), NOW)).toBe('1 hour')
    expect(formatTimeLeft(at(2 * H), NOW)).toBe('2 hours')
    expect(formatTimeLeft(at(M), NOW)).toBe('1 minute')
    expect(formatTimeLeft(at(59 * M), NOW)).toBe('59 minutes')
  })
  it('never says 0 minutes while time remains', () => {
    expect(formatTimeLeft(at(1), NOW)).toBe('1 minute')
    expect(formatTimeLeft(at(59_999), NOW)).toBe('1 minute')
  })
  it('returns null at or after the deadline', () => {
    expect(formatTimeLeft(at(0), NOW)).toBeNull()
    expect(formatTimeLeft(at(-H), NOW)).toBeNull()
  })
  it('returns null for an unparseable date', () => {
    expect(formatTimeLeft('soon', NOW)).toBeNull()
    expect(formatTimeLeft('', NOW)).toBeNull()
  })
  it('defaults now to the clock', () => {
    expect(formatTimeLeft(new Date(Date.now() + 5 * H + M).toISOString())).toBe('5 hours')
  })
})
