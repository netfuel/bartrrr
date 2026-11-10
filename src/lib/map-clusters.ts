import type { Listing } from '@/types'

/**
 * Map pins at the same spot (T-62).
 *
 * Listings are only ever placed at their neighborhood center (privacy: never
 * finer than the neighborhood), so many share exactly one point and their
 * pins would stack with only the top one clickable. They're grouped into one
 * pin per location instead; a group of more than one opens a short list.
 */
export interface ListingCluster {
  /** Stable for a location while the map is open */
  key: string
  lat: number
  lng: number
  listings: Listing[]
}

/** ~1 m: anything closer than this is the same spot on the map. */
const keyFor = (lat: number, lng: number) => `${lat.toFixed(5)},${lng.toFixed(5)}`

/** One group per location, in the order each location first appears. Listings without coordinates are left off. */
export function groupByLocation(listings: Listing[]): ListingCluster[] {
  const groups = new Map<string, ListingCluster>()
  for (const listing of listings) {
    const { lat, lng } = listing.location
    if (!lat || !lng) continue
    const key = keyFor(lat, lng)
    const group = groups.get(key)
    if (group) group.listings.push(listing)
    else groups.set(key, { key, lat, lng, listings: [listing] })
  }
  return [...groups.values()]
}

/** "3 listings in Midtown", or "3 listings here" when they name different neighborhoods. */
export function clusterLabel(cluster: Pick<ListingCluster, 'listings'>): string {
  const n = cluster.listings.length
  const hoods = new Set(cluster.listings.map((l) => l.location.neighborhood).filter(Boolean))
  const [hood] = hoods
  return hoods.size === 1 ? `${n} listings in ${hood}` : `${n} listings here`
}
