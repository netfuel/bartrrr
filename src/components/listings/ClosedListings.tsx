import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui'
import { TradeCard } from '@/components/bartrrr'
import { useRelistableListings, useUsersStore, relistListing } from '@/stores'
import { CLOSED_LISTINGS_ID, isPastExpiry } from '@/lib/listings'

/**
 * Your taken-down and expired listings, each with Relist (T-47). Lives under
 * My listings on the dashboard so a listing never disappears for good.
 * Renders nothing when there are none.
 */
export function ClosedListings({ userId }: { userId: string }) {
  const listings = useRelistableListings(userId)
  const getUserById = useUsersStore((s) => s.getUserById)
  const { hash } = useLocation()
  const ref = useRef<HTMLElement>(null)
  const hasListings = listings.length > 0

  // /dashboard#closed-listings: bring the section into view once it renders
  useEffect(() => {
    if (hash === `#${CLOSED_LISTINGS_ID}` && hasListings) {
      ref.current?.scrollIntoView({ block: 'start' })
    }
  }, [hash, hasListings])

  if (!hasListings) return null

  return (
    <section
      ref={ref}
      id={CLOSED_LISTINGS_ID}
      aria-labelledby="closed-listings-heading"
      className="mt-12 scroll-mt-24 border-t border-ink pt-8"
    >
      <h2 id="closed-listings-heading" className="text-heading-section text-ink">
        Taken down and expired
      </h2>
      <p className="mt-2 mb-6 max-w-[60ch] text-small text-muted">
        Neighbors can't see these. Relist one to put it back up for 30 days.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {listings.map((listing) => {
          const user = getUserById(listing.userId)
          if (!user) return null
          return (
            <TradeCard
              key={listing.id}
              listing={listing}
              user={user}
              statusLabel={isPastExpiry(listing) ? 'Expired' : 'Taken down'}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => relistListing(listing.id)}
                  aria-label={`Relist ${listing.title}`}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" /> Relist
                </Button>
              }
            />
          )
        })}
      </div>
    </section>
  )
}

