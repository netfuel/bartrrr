import { useParams, Link, useNavigate } from 'react-router-dom'
import { MapPin, Star, ArrowLeft, ChevronLeft, ChevronRight, Pencil, XCircle, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Button, Badge, Avatar } from '@/components/ui'
import { TradeCard, OfferBuilder } from '@/components/bartrrr'
import { useListingsStore, useUsersStore } from '@/stores'
import { useAuth } from '@/providers/AuthProvider'
import { formatDistance } from '@/lib/utils'
import { CATEGORY_LABELS } from '@/types'

const badgeVariant: Record<string, 'clay' | 'teal' | 'gold' | 'moss'> = {
  goods: 'clay',
  services: 'teal',
  skills: 'gold',
  outdoor: 'moss',
}

export default function ListingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const listing = useListingsStore((s) => s.getListingById(id || ''))
  const listings = useListingsStore((s) => s.listings)
  const withdrawListing = useListingsStore((s) => s.withdrawListing)
  const renewListing = useListingsStore((s) => s.renewListing)
  const getUserById = useUsersStore((s) => s.getUserById)
  const user = listing ? getUserById(listing.userId) : undefined
  const [imageIndex, setImageIndex] = useState(0)
  const [showOfferBuilder, setShowOfferBuilder] = useState(false)

  if (!listing || !user) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted">Listing not found.</p>
        <Link to="/browse" className="text-clay text-sm mt-2 inline-block">Back to browse</Link>
      </div>
    )
  }

  const isOwner = currentUser?.id === listing.userId
  const relatedListings = listings
    .filter((l) => l.category === listing.category && l.id !== listing.id && l.status === 'active')
    .slice(0, 4)

  return (
    <div className="max-w-3xl mx-auto pb-24">
      {/* Back button */}
      <div className="px-4 py-3">
        <Link to="/browse" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to browse
        </Link>
      </div>

      {/* Photo carousel */}
      <div className="relative bg-clay-light aspect-[4/3] sm:aspect-[16/9] overflow-hidden sm:mx-4 sm:rounded-lg">
        {listing.images[imageIndex] && (
          <img src={listing.images[imageIndex]} alt={`${listing.title} photo ${imageIndex + 1}`} className="w-full h-full object-cover" />
        )}
        {listing.images.length > 1 && (
          <>
            <button type="button" onClick={() => setImageIndex((i) => i === 0 ? listing.images.length - 1 : i - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setImageIndex((i) => i === listing.images.length - 1 ? 0 : i + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center">
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {listing.images.map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === imageIndex ? 'bg-white' : 'bg-white/40'}`} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div className="px-4 mt-4">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={badgeVariant[listing.category]}>{CATEGORY_LABELS[listing.category]}</Badge>
              {listing.condition && <Badge variant="closed">{listing.condition.replace('_', ' ')}</Badge>}
              {listing.status === 'closed' && <Badge variant="closed">Closed</Badge>}
            </div>
            <h1 className="font-display text-2xl font-bold text-ink">{listing.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2 text-sm text-muted">
          <MapPin className="h-4 w-4" />
          <span>{listing.distanceMi !== undefined ? formatDistance(listing.distanceMi) : listing.location.neighborhood}</span>
          <span>&middot;</span>
          <span>{listing.location.neighborhood}</span>
        </div>

        <p className="mt-4 text-sm text-ink-2 leading-relaxed">{listing.description}</p>

        <div className="mt-6 bg-forest-light rounded-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-forest mb-1">Looking for</p>
          <p className="text-sm text-forest-dark leading-relaxed">{listing.seeking}</p>
        </div>

        {/* Owner profile */}
        <Link to={`/profile/${user.username}`} className="flex items-center gap-3 mt-6 p-3 bg-white rounded-lg border border-sand-light hover:border-sand transition-colors">
          <Avatar src={user.avatarUrl} name={user.displayName} userId={user.id} size="lg" />
          <div className="flex-1">
            <p className="text-sm font-medium text-ink">{user.displayName}</p>
            <p className="text-xs text-muted">{user.neighborhood}</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-sm text-gold">
              <Star className="h-4 w-4 fill-gold" />
              {user.reputationScore.toFixed(1)}
            </div>
            <p className="text-xs text-muted">{user.tradeCount} trades</p>
          </div>
        </Link>

        {/* Related listings */}
        {relatedListings.length > 0 && (
          <div className="mt-8">
            <h2 className="font-display text-lg font-semibold text-ink mb-3">Similar listings</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {relatedListings.map((rl) => {
                const rlUser = getUserById(rl.userId)
                if (!rlUser) return null
                return <TradeCard key={rl.id} listing={rl} user={rlUser} onOffer={() => navigate(`/listing/${rl.id}`)} />
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-16 lg:bottom-0 left-0 lg:left-60 right-0 bg-white border-t border-sand-light p-4 z-30">
        <div className="max-w-3xl mx-auto">
          {isOwner ? (
            <div className="flex gap-3">
              {listing.status === 'active' ? (
                <>
                  <Button variant="outline" className="flex-1" onClick={() => navigate(`/listing/${listing.id}/edit`)}>
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                  <Button variant="ghost" className="flex-1" onClick={() => { withdrawListing(listing.id); navigate('/browse') }}>
                    <XCircle className="h-4 w-4" /> Withdraw
                  </Button>
                </>
              ) : (
                <Button variant="primary" className="flex-1" onClick={() => { renewListing(listing.id) }}>
                  <RefreshCw className="h-4 w-4" /> Renew listing
                </Button>
              )}
            </div>
          ) : listing.status === 'active' ? (
            <Button variant="primary" size="lg" className="w-full" onClick={() => setShowOfferBuilder(true)}>
              Make an offer
            </Button>
          ) : (
            <Button variant="ghost" size="lg" className="w-full" disabled>
              This listing is no longer active
            </Button>
          )}
        </div>
      </div>

      {/* OfferBuilder modal */}
      {showOfferBuilder && (
        <OfferBuilder
          listingId={listing.id}
          toUserId={listing.userId}
          onClose={() => setShowOfferBuilder(false)}
        />
      )}
    </div>
  )
}
