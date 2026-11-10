import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useOffersStore } from './offers-store'
import { useListingsStore } from './listings-store'
import { useAgreementsStore } from './agreements-store'
import { useNotificationsStore } from './notifications-store'
import { showToast } from './toast-store'
import { isListingLive, listingStatus } from '@/lib/listings'

/**
 * Memoized per-user selectors. useShallow compares the filtered result
 * element-by-element, so a change to someone else's offer/listing/
 * notification no longer re-renders every subscribed page.
 */

/** Offers where the user is sender or receiver. */
export function useOffersForUser(userId: string | undefined) {
  return useOffersStore(
    useShallow((s) =>
      s.offers.filter((o) => o.fromUserId === userId || o.toUserId === userId),
    ),
  )
}

/** The user's own listings that are open for offers (not past their 30 days). */
export function useMyActiveListings(userId: string | undefined) {
  return useListingsStore(
    useShallow((s) =>
      s.listings.filter((l) => l.userId === userId && isListingLive(l)),
    ),
  )
}

/**
 * The user's own listings that are closed: taken down, or past their 30
 * days (whether or not the server has closed them yet). Traded listings are
 * closed too; callers that know about trades filter those out.
 */
export function useMyClosedListings(userId: string | undefined) {
  return useListingsStore(
    useShallow((s) =>
      s.listings.filter((l) => l.userId === userId && listingStatus(l) === 'closed'),
    ),
  )
}

/**
 * Closed listings the user can bring back: taken down or expired, not
 * traded. A listing whose offer led to a completed trade stays in history.
 */
export function useRelistableListings(userId: string | undefined) {
  const closed = useMyClosedListings(userId)
  const offers = useOffersForUser(userId)
  const agreements = useAgreementsForUser(userId)
  return useMemo(() => {
    const listingByOffer = new Map(offers.map((o) => [o.id, o.listingId]))
    const traded = new Set(
      agreements
        .filter((a) => a.status === 'completed')
        .map((a) => listingByOffer.get(a.offerId))
        .filter(Boolean),
    )
    return closed.filter((l) => !traded.has(l.id))
  }, [closed, offers, agreements])
}

/** Relist a closed listing for another 30 days, with the confirmation toast. */
export function relistListing(id: string) {
  useListingsStore.getState().renewListing(id)
  showToast('Listing relisted. It stays up for another 30 days.', 'success')
}

/** Agreements where the user is a party. */
export function useAgreementsForUser(userId: string | undefined) {
  return useAgreementsStore(
    useShallow((s) =>
      s.agreements.filter(
        (a) => a.partyA.userId === userId || a.partyB.userId === userId,
      ),
    ),
  )
}

/** The user's notifications, newest first. */
export function useNotificationsForUser(userId: string | undefined) {
  return useNotificationsStore(
    useShallow((s) => s.notifications.filter((n) => n.userId === userId)),
  )
}

/** Unread badge count — primitive, so it re-renders only when it changes. */
export function useUnreadCount(userId: string | undefined) {
  return useNotificationsStore((s) =>
    userId
      ? s.notifications.filter((n) => n.userId === userId && !n.readAt).length
      : 0,
  )
}
