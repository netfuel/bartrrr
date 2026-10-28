// ─── Category ────────────────────────────────────────────────
export type Category = 'goods' | 'services' | 'skills' | 'outdoor'

export const CATEGORY_COLORS: Record<Category, string> = {
  goods: 'clay',
  services: 'teal',
  skills: 'gold',
  outdoor: 'moss',
}

export const CATEGORY_LABELS: Record<Category, string> = {
  goods: 'Goods',
  services: 'Services',
  skills: 'Skills & expertise',
  outdoor: 'Outdoor & garden',
}

// ─── Listing ─────────────────────────────────────────────────
export type ListingCondition = 'new' | 'like_new' | 'good' | 'fair'

export const CONDITION_LABELS: Record<ListingCondition, string> = {
  new: 'New',
  like_new: 'Like new',
  good: 'Good',
  fair: 'Fair',
}

export type ListingStatus = 'active' | 'pending' | 'closed'

export type Listing = {
  id: string
  title: string
  description: string
  category: Category
  condition?: ListingCondition
  seeking: string
  images: string[]
  userId: string
  location: {
    lat: number
    lng: number
    neighborhood: string
  }
  distanceMi?: number
  createdAt: string
  /** Listings auto-expire 30 days after posting/renewal (PRD 5.2) */
  expiresAt?: string
  status: ListingStatus
}

export const LISTING_TTL_DAYS = 30
export const OFFER_TTL_HOURS = 72
export const MAX_OFFER_ROUNDS = 5

// ─── Offer ───────────────────────────────────────────────────
export type OfferMessageType =
  | 'offer'
  | 'counter'
  | 'accept'
  | 'decline'
  | 'message'

export type OfferMessage = {
  id: string
  fromUserId: string
  content: string
  items?: string[]
  type: OfferMessageType
  createdAt: string
}

export type OfferStatus =
  | 'pending'
  | 'countered'
  | 'accepted'
  | 'declined'
  | 'withdrawn'
  | 'expired'

export type Offer = {
  id: string
  listingId: string
  fromUserId: string
  toUserId: string
  messages: OfferMessage[]
  status: OfferStatus
  round: number
  maxRounds: number
  expiresAt: string
  createdAt: string
}

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  pending: 'Waiting for reply',
  countered: 'Counter-offer',
  accepted: 'Accepted',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  expired: 'Expired',
}

export type OfferDeclineReason =
  | 'not_interested'
  | 'looking_for_specific'
  | 'not_fair'
  | 'accepted_another'
  | 'no_longer_available'

export const DECLINE_REASON_LABELS: Record<OfferDeclineReason, string> = {
  not_interested: "Not interested in what's being offered",
  looking_for_specific:
    "I'm looking for something specific: check what my listing asks for",
  not_fair: "Offer doesn't feel like a fair trade",
  accepted_another: "I've already accepted another offer",
  no_longer_available: "It's no longer available",
}

// ─── Trade Agreement ─────────────────────────────────────────
export type AgreementStatus =
  | 'draft'
  | 'under_review'
  | 'pending_signatures'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'disputed'

export type TradeAgreement = {
  id: string
  offerId: string
  partyA: { userId: string; item: string; signed: boolean }
  partyB: { userId: string; item: string; signed: boolean }
  exchangeMethod?: 'in_person' | 'dropoff' | 'service_at_location'
  exchangeDate?: string
  exchangeLocation?: string
  specialInstructions?: string
  status: AgreementStatus
  createdAt: string
  completedAt?: string
  /** Who last changed the exchange details, and when (server-stamped, migration 009) */
  termsUpdatedBy?: string
  termsUpdatedAt?: string
  cancelledBy?: string
  cancelledAt?: string
  /** Canceled less than 24 hours before an agreed swap (computed server-side) */
  cancelledLate?: boolean
  disputedBy?: string
  disputedAt?: string
  disputeReason?: string
}

export type ExchangeMethod = NonNullable<TradeAgreement['exchangeMethod']>

/** The parts of an agreement either neighbor can edit before both sign */
export type ExchangeDetails = Pick<
  TradeAgreement,
  'exchangeMethod' | 'exchangeDate' | 'exchangeLocation' | 'specialInstructions'
>

export const AGREEMENT_STATUS_LABELS: Record<AgreementStatus, string> = {
  draft: 'Draft',
  under_review: 'In review',
  pending_signatures: 'Waiting to sign',
  active: 'Ready to swap',
  completed: 'Completed',
  cancelled: 'Canceled',
  disputed: 'Flagged',
}

export const EXCHANGE_METHOD_LABELS: Record<NonNullable<TradeAgreement['exchangeMethod']>, string> = {
  in_person: 'Meet up in person',
  dropoff: 'Drop-off',
  service_at_location: 'Service on site',
}

// ─── User Profile ────────────────────────────────────────────
export type NotificationPrefs = {
  newOffers: boolean
  messages: boolean
  agreementUpdates: boolean
  tradeCompletions: boolean
  perfectMatches: boolean
}

export type UserProfile = {
  id: string
  username: string
  displayName: string
  avatarUrl?: string
  bio?: string
  neighborhood: string
  lookingFor?: string[]
  interests?: string[]
  reputationScore: number
  tradeCount: number
  /** Late cancellations (within 24 hours of an agreed swap), server-maintained */
  lateCancellations?: number
  joinedAt: string
  notificationPrefs?: NotificationPrefs
}

// ─── Review ──────────────────────────────────────────────────
export type Review = {
  id: string
  agreementId: string
  reviewerId: string
  revieweeId: string
  rating: number
  comment: string
  createdAt: string
}

// ─── Notification ────────────────────────────────────────────
export type NotificationType =
  | 'new_offer'
  | 'counter_offer'
  | 'offer_accepted'
  | 'offer_declined'
  | 'new_message'
  | 'agreement_ready'
  | 'trade_complete'
  | 'review_request'
  | 'match'

export type AppNotification = {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, string>
  readAt?: string
  createdAt: string
}
