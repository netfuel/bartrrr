import { useShallow } from 'zustand/react/shallow'
import { useOffersStore } from './offers-store'
import { useListingsStore } from './listings-store'
import { useAgreementsStore } from './agreements-store'
import { useNotificationsStore } from './notifications-store'

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

/** The user's own active listings. */
export function useMyActiveListings(userId: string | undefined) {
  return useListingsStore(
    useShallow((s) =>
      s.listings.filter((l) => l.userId === userId && l.status === 'active'),
    ),
  )
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
