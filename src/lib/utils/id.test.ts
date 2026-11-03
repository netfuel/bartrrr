import { describe, expect, it } from 'vitest'
import { generateId } from './id'

describe('generateId', () => {
  it('without a prefix returns a UUID', () => {
    expect(generateId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
  it('with a prefix matches the database id format (prefix-32 hex)', () => {
    expect(generateId('offer')).toMatch(/^offer-[0-9a-f]{32}$/)
    expect(generateId('listing')).toMatch(/^listing-[0-9a-f]{32}$/)
  })
  it('is unique across many calls', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => generateId('msg')))
    expect(ids.size).toBe(2000)
  })
})
