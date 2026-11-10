import { Badge } from '@/components/ui'
import { whoseMove } from '@/lib/offers'
import { OFFER_STATUS_LABELS, type Offer, type OfferStatus } from '@/types'

const VARIANTS: Record<OfferStatus, 'teal' | 'gold' | 'clay' | 'closed'> = {
  pending: 'gold',
  countered: 'gold',
  accepted: 'teal',
  declined: 'clay',
  withdrawn: 'closed',
  expired: 'closed',
}

export interface OfferStatusBadgeProps {
  offer: Pick<Offer, 'status' | 'fromUserId' | 'messages'>
  /** The reader: "Your turn" shows when the next move is theirs */
  userId: string
  className?: string
}

/** An offer's status as one reader sees it: "Your turn" when it's their move. */
export function OfferStatusBadge({ offer, userId, className }: OfferStatusBadgeProps) {
  return whoseMove(offer, userId) === 'mine' ? (
    <Badge variant="teal" className={className}>Your turn</Badge>
  ) : (
    <Badge variant={VARIANTS[offer.status]} className={className}>{OFFER_STATUS_LABELS[offer.status]}</Badge>
  )
}
