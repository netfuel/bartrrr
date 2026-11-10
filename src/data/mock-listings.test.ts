import { describe, expect, it } from 'vitest'
import { mockListings } from './mock-listings'
import { knownNeighborhood, neighborhoodCenter } from './neighborhoods'

/** Same ~1 km rounding the listings store applies to new listings. */
const coarsen = (n: number) => Math.round(n * 100) / 100

describe('sample listings (T-58)', () => {
  it.each(mockListings.map((l) => [l.title, l] as const))('%s sits at its neighborhood center', (_, listing) => {
    expect(knownNeighborhood(listing.location.neighborhood)).not.toBeNull()
    const center = neighborhoodCenter(listing.location.neighborhood)
    expect(listing.location.lat).toBe(coarsen(center.lat))
    expect(listing.location.lng).toBe(coarsen(center.lng))
  })
})
