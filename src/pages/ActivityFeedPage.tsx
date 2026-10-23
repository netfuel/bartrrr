import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Repeat, Rss } from 'lucide-react'
import { useListingsStore, useAgreementsStore, useUsersStore } from '@/stores'
import { useAuth } from '@/providers/AuthProvider'
import { CATEGORY_LABELS } from '@/types'
import { usePageTitle } from '@/lib/utils'

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
  usePageTitle('Neighborhood feed')

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
          displayerName: poster?.displayName ?? 'A neighbor',
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
          partyAName: pA?.displayName ?? 'A neighbor',
          partyBName: pB?.displayName ?? 'A neighbor',
          timestamp: a.completedAt ?? a.createdAt,
        }
      })

    return [...neighborhoodListings, ...neighborhoodTrades].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
  }, [currentUser, listings, agreements, getUserById])

  if (!currentUser) return null

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      {/* Header */}
      <div className="mb-10">
        <p className="eyebrow mb-4">
          New listings and finished trades near you
        </p>
        <h1 className="text-heading-page text-ink">
          What's happening in <em>{currentUser.neighborhood}</em>
        </h1>
      </div>

      {/* Feed */}
      {feedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full border border-ink flex items-center justify-center mb-6">
            <Rss className="h-6 w-6 text-clay" />
          </div>
          <p className="font-display text-[28px] text-ink mb-2">
            No activity yet
          </p>
          <p className="text-base text-ink-2 max-w-xs">
            When neighbors in {currentUser.neighborhood} post listings or finish
            trades, you'll see them here. Get things started with a listing of your own.
          </p>
          <Link to="/listing/new" className="mt-4 text-ink underline underline-offset-4 text-sm">
            Post a listing
          </Link>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-2 bottom-6 w-px bg-ink/25" />

          <div className="space-y-0">
            {feedItems.map((item) => (
              <div key={`${item.type}-${item.id}`} className="relative flex gap-5 pb-8">
                {/* Icon bubble */}
                <div
                  className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full border flex items-center justify-center ${
                    item.type === 'listing'
                      ? 'border-clay bg-cream text-clay'
                      : 'border-forest bg-forest text-cream'
                  }`}
                >
                  {item.type === 'listing' ? (
                    <MapPin className="h-4 w-4" />
                  ) : (
                    <Repeat className="h-4 w-4" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pt-1.5 min-w-0">
                  {item.type === 'listing' ? (
                    <>
                      <p className="text-[16px] text-ink-2 leading-snug">
                        <span className="font-medium text-ink">{item.displayerName}</span>{' '}
                        listed{' '}
                        <span className="font-display text-[19px] text-ink">{item.title}</span>
                      </p>
                      <p className="text-small text-muted mt-1">
                        {item.neighborhood} · {item.category}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[16px] text-ink-2 leading-snug">
                        <span className="font-medium text-ink">{item.partyAName}</span>{' '}
                        &amp;{' '}
                        <span className="font-medium text-ink">{item.partyBName}</span>{' '}
                        traded with each other
                      </p>
                    </>
                  )}
                  <p className="text-label text-muted mt-2">{timeAgo(item.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
