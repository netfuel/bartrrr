import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Map, List, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Chip, EmptyState, Skeleton } from '@/components/ui'
import { lazy, Suspense } from 'react'
import { TradeCard } from '@/components/bartrrr'

const ListingsMap = lazy(() =>
  import('@/components/bartrrr/ListingsMap').then((m) => ({ default: m.ListingsMap })),
)
import { useListingsStore, useUsersStore } from '@/stores'
import type { Category } from '@/types'
import { CATEGORY_LABELS } from '@/types'

const categories: Category[] = ['goods', 'services', 'skills', 'outdoor']
const distanceOptions = [
  { label: 'Any', value: null },
  { label: '0.5 mi', value: 0.5 },
  { label: '1 mi', value: 1 },
  { label: '2 mi', value: 2 },
  { label: '5 mi', value: 5 },
  { label: '10 mi', value: 10 },
]

function matchesSearch(listing: { title: string; description: string; seeking: string; location: { neighborhood: string } }, query: string): boolean {
  const q = query.toLowerCase()
  return (
    listing.title.toLowerCase().includes(q) ||
    listing.description.toLowerCase().includes(q) ||
    listing.seeking.toLowerCase().includes(q) ||
    listing.location.neighborhood.toLowerCase().includes(q)
  )
}

export default function BrowsePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [view, setView] = useState<'list' | 'map'>('list')
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [maxDistance, setMaxDistance] = useState<number | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const searchQuery = searchParams.get('q') || ''
  const listings = useListingsStore((s) => s.listings)
  const getUserById = useUsersStore((s) => s.getUserById)

  const filteredListings = listings
    .filter((l) => l.status === 'active')
    .filter((l) => !searchQuery || matchesSearch(l, searchQuery))
    .filter((l) => !maxDistance || (l.distanceMi !== undefined && l.distanceMi <= maxDistance))
    .filter((l) => !selectedCategory || l.category === selectedCategory)

  return (
    <div className="flex flex-col h-[calc(100svh-4rem-4.75rem)] -mb-28 lg:mb-0 lg:h-[calc(100svh-4rem)]">
      {/* Filters bar */}
      <div className="no-scrollbar flex items-center gap-3 px-4 lg:px-6 py-3 bg-cream border-b border-ink overflow-x-auto">
        {/* View toggle (mobile) */}
        <div className="flex items-center rounded-full border border-ink p-0.5 shrink-0 lg:hidden">
          <button
            type="button"
            aria-label="List view"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
            className={cn('flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-300', view === 'list' ? 'bg-ink text-cream' : 'text-ink hover:bg-sand-light')}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Map view"
            aria-pressed={view === 'map'}
            onClick={() => setView('map')}
            className={cn('flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-300', view === 'map' ? 'bg-ink text-cream' : 'text-ink hover:bg-sand-light')}
          >
            <Map className="h-4 w-4" />
          </button>
        </div>

        <span aria-hidden="true" className="h-6 w-px shrink-0 bg-ink/20 lg:hidden" />

        {/* Category chips */}
        <div className="flex items-center gap-2">
          <Chip label="All" selected={selectedCategory === null} onToggle={() => setSelectedCategory(null)} />
          {categories.map((cat) => (
            <Chip
              key={cat}
              label={CATEGORY_LABELS[cat]}
              selected={selectedCategory === cat}
              onToggle={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            />
          ))}
        </div>

        {/* Distance filter toggle */}
        <button
          type="button"
          aria-label="Distance"
          aria-expanded={showFilters}
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'ml-auto flex h-10 w-10 items-center justify-center rounded-full border shrink-0 transition-colors duration-300',
            showFilters || maxDistance ? 'border-ink bg-ink text-cream' : 'border-ink/30 text-ink hover:border-ink hover:bg-sand-light',
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Distance filter bar */}
      {showFilters && (
        <div className="no-scrollbar animate-fade-in flex items-center gap-2 px-4 lg:px-6 py-2.5 bg-paper border-b border-ink overflow-x-auto">
          <span className="text-label text-muted shrink-0 mr-1">Distance:</span>
          {distanceOptions.map((opt) => (
            <Chip
              key={opt.label}
              label={opt.label}
              selected={maxDistance === opt.value}
              onToggle={() => setMaxDistance(opt.value)}
            />
          ))}
        </div>
      )}

      {/* Search indicator */}
      {searchQuery && (
        <div className="px-4 lg:px-6 py-2.5 bg-paper border-b border-ink text-[15px] text-ink-2 flex items-center justify-between gap-4">
          <span className="min-w-0 truncate">Results for <span className="font-display italic text-ink">"{searchQuery}"</span></span>
          <button type="button" onClick={() => navigate('/browse')} className="text-label link-underline shrink-0 text-ink">Clear</button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map panel */}
        <div className={cn('lg:w-[46%] xl:w-1/2 lg:block lg:border-r lg:border-ink', view === 'map' ? 'w-full' : 'hidden')}>
          <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
            <ListingsMap
              listings={filteredListings}
              users={Object.fromEntries(
                filteredListings
                  .map((l) => getUserById(l.userId))
                  .filter(Boolean)
                  .map((u) => [u!.id, u!])
              )}
              className="h-full"
            />
          </Suspense>
        </div>

        {/* Card grid */}
        <div className={cn('flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6', 'lg:block', view === 'list' ? 'block' : 'hidden')}>
          {filteredListings.length === 0 ? (
            <EmptyState
              title="No listings here yet"
              description="Your neighbors haven't posted yet — be the first! Post something you'd love to trade."
              actionLabel="Post a listing"
              onAction={() => navigate('/listing/new')}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 min-[1800px]:grid-cols-3 gap-4 lg:gap-5">
              {filteredListings.map((listing) => {
                const user = getUserById(listing.userId)
                if (!user) return null
                return (
                  <TradeCard
                    key={listing.id}
                    listing={listing}
                    user={user}
                    onOffer={() => navigate(`/listing/${listing.id}`)}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
