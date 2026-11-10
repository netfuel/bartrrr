import type { Category, Listing, ListingStatus } from '@/types'

/**
 * Listing lifecycle as the app shows it.
 *
 * The server closes a listing once its 30 days are up, but the client only
 * learns that on the next fetch. Until then a stored `status: 'active'` with
 * a past `expiresAt` must already read as closed (T-48), so screens ask these
 * helpers instead of comparing `status` themselves.
 */

/** Its 30 days have run out (whatever its stored status). */
export function isPastExpiry(listing: Pick<Listing, 'expiresAt'>, now = Date.now()): boolean {
  if (!listing.expiresAt) return false
  const ends = Date.parse(listing.expiresAt)
  return Number.isFinite(ends) && ends <= now
}

/** Active in the store, but its 30 days have run out. */
export function isListingExpired(listing: Pick<Listing, 'status' | 'expiresAt'>, now = Date.now()): boolean {
  return listing.status === 'active' && isPastExpiry(listing, now)
}

/** The status to show: an expired active listing reads as closed. */
export function listingStatus(listing: Pick<Listing, 'status' | 'expiresAt'>, now = Date.now()): ListingStatus {
  return isListingExpired(listing, now) ? 'closed' : listing.status
}

/** Open for offers right now. */
export function isListingLive(listing: Pick<Listing, 'status' | 'expiresAt'>, now = Date.now()): boolean {
  return listingStatus(listing, now) === 'active'
}

/** Only goods and outdoor listings carry a condition (New, Like new, Good, Fair). */
export function categoryTakesCondition(category: Category | '' | null | undefined): boolean {
  return category === 'goods' || category === 'outdoor'
}

/** Anchor of the dashboard's "Taken down and expired" section (your profile links to it). */
export const CLOSED_LISTINGS_ID = 'closed-listings'
