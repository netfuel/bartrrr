import { Link } from 'react-router-dom'
import { MapPin, Star, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistance } from '@/lib/utils'
import { Badge, Avatar, Button } from '@/components/ui'
import type { Listing, UserProfile } from '@/types'
import { CATEGORY_LABELS } from '@/types'
import { useAuth } from '@/providers/AuthProvider'

export interface TradeCardProps {
  listing: Listing
  user: UserProfile
  onOffer?: () => void
  className?: string
}

const badgeVariant: Record<string, 'clay' | 'teal' | 'gold' | 'moss'> = {
  goods: 'clay',
  services: 'teal',
  skills: 'gold',
  outdoor: 'moss',
}

export function TradeCard({
  listing,
  user,
  onOffer,
  className,
}: TradeCardProps) {
  const { currentUser } = useAuth()
  const isPerfectMatch =
    currentUser?.interests?.includes(listing.category) ?? false

  return (
    <div
      className={cn(
        'rounded-lg bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow',
        className,
      )}
    >
      {/* Image area */}
      <Link to={`/listing/${listing.id}`} className="block relative">
        <div className="h-[140px] bg-clay-light overflow-hidden">
          {listing.images[0] ? (
            <img
              src={listing.images[0]}
              alt={listing.title}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-clay-mid">
              <ImageIcon className="h-10 w-10" />
            </div>
          )}
        </div>
        <div className="absolute top-2 left-2">
          <Badge variant={badgeVariant[listing.category]}>
            {CATEGORY_LABELS[listing.category]}
          </Badge>
        </div>
        {isPerfectMatch && (
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold text-white text-[11px] font-semibold shadow-sm">
              ✦ Match
            </span>
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="p-4">
        {/* Title — Fraunces 16px/600 per §6.3 */}
        <Link to={`/listing/${listing.id}`}>
          <h3 className="font-display text-[16px] font-semibold leading-snug text-ink truncate hover:text-clay transition-colors">
            {listing.title}
          </h3>
        </Link>

        {/* Meta row — small token: 13px per §5.3 */}
        <div className="flex items-center gap-1.5 mt-1.5 text-[13px] text-muted">
          <MapPin className="h-3.5 w-3.5" />
          <span>
            {listing.distanceMi !== undefined
              ? formatDistance(listing.distanceMi)
              : listing.location.neighborhood}
          </span>
          <span>&middot;</span>
          <span>{listing.location.neighborhood}</span>
        </div>

        {/* Seeking section — forest-light bg per §6.3 */}
        <div className="mt-3 bg-forest-light rounded-md p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-forest mb-1">
            Looking for
          </p>
          <p className="text-[13px] text-forest-dark leading-relaxed">
            {listing.seeking || 'What would you like in return?'}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-3">
          <Link
            to={`/profile/${user.username}`}
            className="flex items-center gap-2 min-w-0"
          >
            <Avatar
              src={user.avatarUrl}
              name={user.displayName}
              userId={user.id}
              size="sm"
            />
            <span className="text-[13px] text-ink-2 truncate">
              {user.displayName}
            </span>
            <span className="flex items-center gap-0.5 text-[13px] text-gold shrink-0">
              <Star className="h-3 w-3 fill-gold" />
              {user.reputationScore.toFixed(1)}
            </span>
          </Link>
          <Button variant="primary" size="sm" onClick={onOffer}>
            Offer
          </Button>
        </div>
      </div>
    </div>
  )
}
