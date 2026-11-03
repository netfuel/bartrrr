import { describe, expect, it } from 'vitest'
import { cn, formatDistance, hashToColor } from './index'

describe('formatDistance', () => {
  it('says "Nearby" under 0.1 mi', () => {
    expect(formatDistance(0)).toBe('Nearby')
    expect(formatDistance(0.099)).toBe('Nearby')
  })
  it('shows one decimal otherwise', () => {
    expect(formatDistance(0.1)).toBe('0.1 mi away')
    expect(formatDistance(0.96)).toBe('1.0 mi away')
    expect(formatDistance(2)).toBe('2.0 mi away')
    expect(formatDistance(12.34)).toBe('12.3 mi away')
  })
})

describe('hashToColor', () => {
  const palette = ['#9c5b3c', '#4a5240', '#4d6a62', '#86662a', '#5f6532']
  it('is stable for an id and always from the palette', () => {
    for (const id of ['', 'u1', 'user-abc', '🚲', 'x'.repeat(500)]) {
      expect(hashToColor(id)).toBe(hashToColor(id))
      expect(palette).toContain(hashToColor(id))
    }
  })
  it('spreads ids across more than one color', () => {
    const colors = new Set(Array.from({ length: 20 }, (_, i) => hashToColor(`user-${i}`)))
    expect(colors.size).toBeGreaterThan(1)
  })
})

describe('cn', () => {
  it('merges conflicting utilities, last wins', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('text-clay', undefined, null, 'font-bold')).toBe('text-clay font-bold')
  })
  it('keeps custom type-scale classes alongside text colors', () => {
    expect(cn('text-cream', 'text-label')).toBe('text-cream text-label')
    expect(cn('text-label', 'text-clay')).toBe('text-label text-clay')
  })
  it('custom type-scale classes still override each other', () => {
    expect(cn('text-label', 'text-small')).toBe('text-small')
  })
})
