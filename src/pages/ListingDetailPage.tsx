import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { MapPin, Star, ChevronLeft, ChevronRight, Pencil, XCircle, RefreshCw, PartyPopper } from 'lucide-react'
import { useState, useRef, useMemo } from 'react'
import { Button, Badge, Avatar, ShareButton, BackLink } from '@/components/ui'
import { TradeCard, OfferBuilder } from '@/components/bartrrr'
import { useListingsStore, useUsersStore } from '@/stores'
import { useAuth } from '@/providers/AuthProvider'
import { formatDistance } from '@/lib/utils'
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/types'

const badgeVariant = CATEGORY_COLORS as Record<string, 'clay' | 'teal' | 'gold' | 'moss'>

export default function ListingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser } = useAuth()
  const listing = useListingsStore((s) => s.getListingById(id || ''))
  const listings = useListingsStore((s) => s.listings)
  const withdrawListing = useListingsStore((s) => s.withdrawListing)
  const renewListing = useListingsStore((s) => s.renewListing)
  const getUserById = useUsersStore((s) => s.getUserById)
  const user = listing ? getUserById(listing.userId) : undefined
  const [imageIndex, setImageIndex] = useState(0)
  const [showOfferBuilder, setShowOfferBuilder] = useState(false)
  const galleryRef = useRef<HTMLDivElement>(null)
  const justCreated = Boolean(location.state?.justCreated)

  const scrollToImage = (i: number) => {
    const el = galleryRef.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  const relatedListings = useMemo(
    () =>
      listing
        ? listings
            .filter((l) => l.category === listing.category && l.id !== listing.id && l.status === 'active')
            .slice(0, 4)
        : [],
    [listings, listing],
  )

  if (!listing || !user) {
    return (
      <div className="px-5 py-24 text-center">
        <p className="font-display text-[28px] text-ink">Listing not found.</p>
        <Link to="/browse" className="text-label link-underline mt-4 inline-block text-ink">Back to browse</Link>
      </div>
    )
  }

  const isOwner = currentUser?.id === listing.userId

  return (
    <div className="max-w-6xl mx-auto pb-36 lg:pb-28">
      {/* Back button */}
      <div className="px-4 sm:px-6 py-2">
        <BackLink to="/browse">Back to browse</BackLink>
      </div>

      {/* Just-created banner */}
      {justCreated && isOwner && (
        <div className="animate-slide-up mx-4 sm:mx-6 mb-4 flex flex-wrap items-center gap-3 rounded-none border border-teal bg-teal-light p-4">
          <PartyPopper className="h-6 w-6 text-teal-dark shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-base font-medium text-teal-dark">Your listing is live!</p>
            <p className="text-small text-teal-dark">Share it so neighbors know what you're trading for.</p>
          </div>
          <ShareButton
            title={listing.title}
            text={`I'm trading "${listing.title}" on Bartrrr — looking for ${listing.seeking}. Come barter!`}
            card={{
              title: listing.title,
              seeking: listing.seeking,
              neighborhood: listing.location.neighborhood,
              imageUrl: listing.images[0],
            }}
            variant="confirm"
          />
        </div>
      )}

      <div className="lg:grid lg:grid-cols-12 lg:gap-10 lg:px-6">
      {/* Photo gallery — swipe on touch, arrows on desktop */}
      <div className="lg:col-span-7">
      <div className="relative bg-sand-light aspect-[4/3] sm:aspect-[3/2] lg:aspect-[4/5] overflow-hidden sm:mx-6 lg:mx-0 sm:border sm:border-ink lg:sticky lg:top-24">
        <div
          ref={galleryRef}
          onScroll={(e) => {
            const el = e.currentTarget
            const i = Math.round(el.scrollLeft / el.clientWidth)
            if (i !== imageIndex) setImageIndex(i)
          }}
          tabIndex={0}
          role="region"
          aria-label={`Photo gallery, ${listing.images.length} photos. Use arrow keys to browse.`}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') scrollToImage(Math.min(listing.images.length - 1, imageIndex + 1))
            if (e.key === 'ArrowLeft') scrollToImage(Math.max(0, imageIndex - 1))
          }}
          className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto"
        >
          {listing.images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`${listing.title} photo ${i + 1}`}
              className="photo-warm h-full w-full shrink-0 snap-center object-cover"
              draggable={false}
            />
          ))}
        </div>
        {listing.images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => scrollToImage(Math.max(0, imageIndex - 1))}
              className="pressable absolute left-3 top-1/2 hidden -translate-y-1/2 sm:flex w-11 h-11 rounded-full border border-ink bg-cream/90 backdrop-blur-sm items-center justify-center hover:bg-ink hover:text-cream transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => scrollToImage(Math.min(listing.images.length - 1, imageIndex + 1))}
              className="pressable absolute right-3 top-1/2 hidden -translate-y-1/2 sm:flex w-11 h-11 rounded-full border border-ink bg-cream/90 backdrop-blur-sm items-center justify-center hover:bg-ink hover:text-cream transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-ink/40 px-2.5 py-1.5 backdrop-blur-sm">
              {listing.images.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ease-out-soft ${i === imageIndex ? 'w-5 bg-cream' : 'w-1.5 bg-cream/55'}`} />
              ))}
            </div>
          </>
        )}
      </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 lg:px-0 mt-6 lg:mt-0 lg:col-span-5">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Badge variant={badgeVariant[listing.category]}>{CATEGORY_LABELS[listing.category]}</Badge>
              {listing.condition && <Badge variant="closed">{listing.condition.replace('_', ' ')}</Badge>}
              {listing.status === 'closed' && <Badge variant="closed">Closed</Badge>}
            </div>
            <h1 className="text-heading-page text-ink">{listing.title}</h1>
          </div>
          <ShareButton
            title={listing.title}
            text={`Check out "${listing.title}" on Bartrrr — they're looking to trade for ${listing.seeking}.`}
            card={{
              title: listing.title,
              seeking: listing.seeking,
              neighborhood: listing.location.neighborhood,
              imageUrl: listing.images[0],
            }}
            size="sm"
            className="shrink-0 mt-1"
          />
        </div>

        <div className="flex items-center gap-2 mt-3 text-[15px] text-muted">
          <MapPin className="h-4 w-4 text-clay" />
          <span>{listing.distanceMi !== undefined ? formatDistance(listing.distanceMi) : listing.location.neighborhood}</span>
          <span>&middot;</span>
          <span>{listing.location.neighborhood}</span>
        </div>

        <p className="mt-6 max-w-[60ch] text-[17px] text-ink-2 leading-[1.6]">{listing.description}</p>

        <div className="mt-8 border-t border-ink pt-6">
          <p className="eyebrow mb-3">Looking for</p>
          <p className="font-display text-[22px] leading-[1.35] tracking-[-0.01em] text-ink">{listing.seeking}</p>
        </div>

        {/* Owner profile */}
        <Link to={`/profile/${user.username}`} className="group mt-8 flex items-center gap-4 border-y border-ink py-5 transition-colors hover:bg-paper">
          <Avatar src={user.avatarUrl} name={user.displayName} userId={user.id} size="xl" />
          <div className="flex-1 min-w-0">
            <p className="font-display text-[20px] leading-tight text-ink group-hover:text-clay-dark transition-colors">{user.displayName}</p>
            <p className="text-small text-muted mt-1">{user.neighborhood}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center justify-end gap-1.5 text-[17px] font-medium tabular-nums text-ink">
              <Star className="h-4 w-4 fill-gold text-gold" />
              {user.reputationScore.toFixed(1)}
            </div>
            <p className="text-label text-muted mt-1">{user.tradeCount} trades</p>
          </div>
        </Link>
      </div>
      </div>

      {/* Related listings */}
      {relatedListings.length > 0 && (
        <div className="mt-16 border-t border-ink px-4 sm:px-6 pt-10">
            <p className="eyebrow mb-3">{CATEGORY_LABELS[listing.category]}</p>
            <h2 className="text-heading-section text-ink mb-6 !text-[28px]">Similar listings</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {relatedListings.map((rl) => {
                const rlUser = getUserById(rl.userId)
                if (!rlUser) return null
                return <TradeCard key={rl.id} listing={rl} user={rlUser} onOffer={() => navigate(`/listing/${rl.id}`)} />
              })}
            </div>
        </div>
      )}

      {/* Sticky CTA */}
      <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:bottom-0 left-0 lg:left-60 right-0 bg-cream/90 backdrop-blur-md border-t border-ink px-4 py-3 sm:p-4 z-30">
        <div className="max-w-6xl mx-auto flex items-center gap-6 sm:px-2">
          <div className="hidden min-w-0 flex-1 sm:block">
            <p className="font-display text-[19px] leading-tight text-ink truncate">{listing.title}</p>
            <p className="text-small text-muted truncate">{user.displayName} · {listing.location.neighborhood}</p>
          </div>
          <div className="flex-1 sm:flex-none sm:min-w-[320px]">
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
