import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Map, List, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Chip, EmptyState } from '@/components/ui'
import { TradeCard, ListingsMap } from '@/components/bartrrr'
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
    <div className="flex flex-col h-[calc(100vh-57px)]">
      {/* Filters bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-sand-light overflow-x-auto">
        {/* View toggle (mobile) */}
        <div className="flex items-center rounded-full border border-sand overflow-hidden shrink-0 lg:hidden">
          <button
            type="button"
            onClick={() => setView('list')}
            className={cn('p-2 transition-colors', view === 'list' ? 'bg-clay text-white' : 'text-muted')}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView('map')}
            className={cn('p-2 transition-colors', view === 'map' ? 'bg-clay text-white' : 'text-muted')}
          >
            <Map className="h-4 w-4" />
          </button>
        </div>

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
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'p-2 rounded-full shrink-0 transition-colors',
            showFilters ? 'bg-clay text-white' : 'text-muted hover:bg-sand-light',
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Distance filter bar */}
      {showFilters && (
        <div className="flex items-center gap-2 px-4 py-2 bg-sand-light border-b border-sand overflow-x-auto">
          <span className="text-xs text-muted shrink-0">Distance:</span>
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
        <div className="px-4 py-2 bg-gold-light text-sm text-gold flex items-center justify-between">
          <span>Results for "{searchQuery}"</span>
          <button onClick={() => navigate('/browse')} className="text-xs underline">Clear</button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map panel */}
        <div className={cn('lg:w-1/2 lg:block', view === 'map' ? 'w-full' : 'hidden')}>
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
        </div>

        {/* Card grid */}
        <div className={cn('flex-1 overflow-y-auto p-4', 'lg:block', view === 'list' ? 'block' : 'hidden')}>
          {filteredListings.length === 0 ? (
            <EmptyState
              title="No listings here yet"
              description="Your neighbors haven't posted yet — be the first! Post something you'd love to trade."
              actionLabel="Post a listing"
              onAction={() => navigate('/listing/new')}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
