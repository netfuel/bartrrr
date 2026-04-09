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
  skills: 'Skills & Expertise',
  outdoor: 'Outdoor & Garden',
}

// ─── Listing ─────────────────────────────────────────────────
export type ListingCondition = 'new' | 'like_new' | 'good' | 'fair'

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
  status: ListingStatus
}

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

export type OfferStatus = 'pending' | 'countered' | 'accepted' | 'declined'

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

export type OfferDeclineReason =
  | 'not_interested'
  | 'looking_for_specific'
  | 'not_fair'
  | 'accepted_another'
  | 'no_longer_available'

export const DECLINE_REASON_LABELS: Record<OfferDeclineReason, string> = {
  not_interested: "Not interested in what's being offered",
  looking_for_specific:
    "I'm looking for something specific — check my listing tags",
  not_fair: "Offer doesn't feel like a fair trade",
  accepted_another: "I've already accepted another offer",
  no_longer_available: 'Item/service is no longer available',
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
}

// ─── User Profile ────────────────────────────────────────────
export type UserProfile = {
  id: string
  username: string
  displayName: string
  avatarUrl?: string
  bio?: string
  neighborhood: string
  lookingFor?: string[]
  reputationScore: number
  tradeCount: number
  joinedAt: string
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
