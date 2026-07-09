import { useMemo } from 'react'
import { MapPin, Repeat, Rss } from 'lucide-react'
import { useListingsStore, useAgreementsStore, useUsersStore } from '@/stores'
import { useAuth } from '@/providers/AuthProvider'
import { CATEGORY_LABELS } from '@/types'

type FeedItem =
  | {
      type: 'listing'
      id: string
      title: string
      neighborhood: string
      category: string
      displayerName: string
      timestamp: string
    }
  | {
      type: 'trade'
      id: string
      partyAName: string
      partyBName: string
      timestamp: string
    }

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function ActivityFeedPage() {
  const { currentUser } = useAuth()
  const listings = useListingsStore((s) => s.listings)
  const agreements = useAgreementsStore((s) => s.agreements)
  const getUserById = useUsersStore((s) => s.getUserById)

  const feedItems = useMemo<FeedItem[]>(() => {
    if (!currentUser) return []

    const neighborhood = currentUser.neighborhood

    // Recent listings in the same neighborhood (last 20, sorted newest first)
    const neighborhoodListings = listings
      .filter((l) => l.location.neighborhood === neighborhood && l.status === 'active')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20)
      .map<FeedItem>((l) => {
        const poster = getUserById(l.userId)
        return {
          type: 'listing',
          id: l.id,
          title: l.title,
          neighborhood: l.location.neighborhood,
          category: CATEGORY_LABELS[l.category] ?? l.category,
          displayerName: poster?.displayName ?? 'Someone',
          timestamp: l.createdAt,
        }
      })

    // Completed agreements where either party is in the same neighborhood
    const neighborhoodTrades = agreements
      .filter((a) => {
        if (a.status !== 'completed') return false
        const pA = getUserById(a.partyA.userId)
        const pB = getUserById(a.partyB.userId)
        return (
          pA?.neighborhood === neighborhood || pB?.neighborhood === neighborhood
        )
      })
      .map<FeedItem>((a) => {
        const pA = getUserById(a.partyA.userId)
        const pB = getUserById(a.partyB.userId)
        return {
          type: 'trade',
          id: a.id,
          partyAName: pA?.displayName ?? 'Someone',
          partyBName: pB?.displayName ?? 'Someone',
          timestamp: a.completedAt ?? a.createdAt,
        }
      })

    return [...neighborhoodListings, ...neighborhoodTrades].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
  }, [currentUser, listings, agreements, getUserById])

  if (!currentUser) return null

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Rss className="h-5 w-5 text-clay" />
          <h1 className="font-display text-xl font-bold text-ink">
            What's happening in {currentUser.neighborhood}
          </h1>
        </div>
        <p className="text-sm text-muted pl-7">
          Recent listings and completed trades in your neighborhood
        </p>
      </div>

      {/* Feed */}
      {feedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-sand-light flex items-center justify-center mb-4">
            <Rss className="h-7 w-7 text-muted" />
          </div>
          <p className="font-display text-base font-semibold text-ink mb-1">
            No activity yet
          </p>
          <p className="text-sm text-muted max-w-xs">
            When neighbors in {currentUser.neighborhood} post listings or complete
            trades, you'll see them here.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-sand" />

          <div className="space-y-0">
            {feedItems.map((item) => (
              <div key={`${item.type}-${item.id}`} className="relative flex gap-4 pb-6">
                {/* Icon bubble */}
                <div
                  className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${
                    item.type === 'listing'
                      ? 'bg-clay-light'
                      : 'bg-forest-light'
                  }`}
                >
                  {item.type === 'listing' ? (
                    <MapPin className="h-4.5 w-4.5 text-clay" />
                  ) : (
                    <Repeat className="h-4.5 w-4.5 text-forest" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pt-1 min-w-0">
                  {item.type === 'listing' ? (
                    <>
                      <p className="text-sm font-medium text-ink leading-snug">
                        <span className="text-clay">{item.displayerName}</span>{' '}
                        listed{' '}
                        <span className="font-semibold">{item.title}</span>
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {item.neighborhood} · {item.category}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-ink leading-snug">
                        <span className="text-forest">{item.partyAName}</span>{' '}
                        &amp;{' '}
                        <span className="text-forest">{item.partyBName}</span>{' '}
                        completed a trade
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        2 items exchanged
                      </p>
                    </>
                  )}
                  <p className="text-xs text-muted mt-1">{timeAgo(item.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
