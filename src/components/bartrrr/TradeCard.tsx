import { memo } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Star, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistance } from '@/lib/utils'
import { Badge, Avatar, Button } from '@/components/ui'
import type { Listing, UserProfile } from '@/types'
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/types'
import { useAuth } from '@/providers/AuthProvider'

export interface TradeCardProps {
  listing: Listing
  user: UserProfile
  onOffer?: () => void
  className?: string
}

function TradeCardInner({
  listing,
  user,
  onOffer,
  className,
}: TradeCardProps) {
  const { currentUser } = useAuth()
  const isPerfectMatch =
    currentUser?.interests?.includes(listing.category) ?? false

  return (
    <article
      className={cn(
        'group/card flex flex-col border border-ink bg-paper overflow-hidden transition-colors duration-500 ease-out-soft hover:bg-cream',
        className,
      )}
    >
      {/* Image area */}
      <Link to={`/listing/${listing.id}`} tabIndex={-1} aria-hidden="true" className="block relative">
        <div className="aspect-[4/3] bg-sand-light overflow-hidden border-b border-ink">
          {listing.images[0] ? (
            <img
              src={listing.images[0]}
              alt=""
              loading="lazy"
              decoding="async"
              className="photo-warm w-full h-full object-cover transition-transform duration-[1200ms] ease-out-soft group-hover/card:scale-[1.04]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted/60">
              <ImageIcon className="h-9 w-9" strokeWidth={1.25} />
            </div>
          )}
        </div>
        <div className="absolute top-3 left-3">
          <Badge variant={CATEGORY_COLORS[listing.category] as 'clay' | 'teal' | 'gold' | 'moss'}>
            {CATEGORY_LABELS[listing.category]}
          </Badge>
        </div>
        {isPerfectMatch && (
          <div className="absolute top-3 right-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-[5px] text-label leading-none text-cream">
              ✦ Match
            </span>
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        {/* Title — Fraunces, the card's one serif moment */}
        <Link to={`/listing/${listing.id}`} className="rounded-sm">
          <h3 className="font-display text-[21px] font-normal leading-[1.2] tracking-[-0.012em] text-ink line-clamp-2 transition-colors group-hover/card:text-clay-dark">
            {listing.title}
          </h3>
        </Link>

        {/* Meta row */}
        <div className="flex min-w-0 items-center gap-1.5 mt-2 text-small text-muted">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="shrink-0">
            {listing.distanceMi !== undefined
              ? formatDistance(listing.distanceMi)
              : listing.location.neighborhood}
          </span>
          <span aria-hidden="true">&middot;</span>
          <span className="truncate">{listing.location.neighborhood}</span>
        </div>

        {/* Seeking section — the other half of every trade, never blank */}
        <div className="mt-4 mb-4 border-l-2 border-clay bg-clay-light/60 py-2.5 pl-3.5 pr-3">
          <p className="text-label text-clay-dark mb-1">
            Looking for
          </p>
          <p className="text-[14px] text-ink-2 leading-snug line-clamp-2">
            {listing.seeking || 'What would you like in return?'}
          </p>
        </div>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-ink/15 pt-4">
          <Link
            to={`/profile/${user.username}`}
            className="flex items-center gap-2 min-w-0 rounded-sm"
          >
            <Avatar
              src={user.avatarUrl}
              name={user.displayName}
              userId={user.id}
              size="sm"
            />
            <span className="text-small text-ink-2 truncate">
              {user.displayName}
            </span>
            <span className="flex items-center gap-1 text-small tabular-nums text-ink-2 shrink-0">
              <Star className="h-3 w-3 fill-gold text-gold" />
              {user.reputationScore.toFixed(1)}
            </span>
          </Link>
          {onOffer && (
            <Button variant="primary" size="sm" onClick={onOffer} className="shrink-0">
              Offer
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}

export const TradeCard = memo(TradeCardInner)
