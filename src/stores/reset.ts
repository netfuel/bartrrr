import { initialUsers, useUsersStore } from './users-store'
import { initialListings, useListingsStore } from './listings-store'
import { initialOffers, useOffersStore } from './offers-store'
import { initialAgreements, useAgreementsStore } from './agreements-store'
import { useNotificationsStore } from './notifications-store'
import { useReviewsStore } from './reviews-store'

/**
 * Wipe per-user data on sign-out so the next person on a shared device
 * never sees the previous user's offers, agreements or notifications.
 */
export function resetDataStores(): void {
  useUsersStore.setState({ users: initialUsers() })
  useListingsStore.setState({ listings: initialListings() })
  useOffersStore.setState({ offers: initialOffers() })
  useAgreementsStore.setState({ agreements: initialAgreements() })
  useNotificationsStore.setState({ notifications: [] })
  useReviewsStore.setState({ reviews: [] })
}
