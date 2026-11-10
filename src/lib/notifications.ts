import {
  ArrowLeftRight,
  CheckCircle2,
  FileCheck,
  Flag,
  MessageSquare,
  PartyPopper,
  Repeat,
  RotateCcw,
  Sparkles,
  Star,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import type { AppNotification, NotificationPrefs, NotificationType } from '@/types'

/**
 * Per-type label, icon and Settings switch for notifications. Keep in step
 * with the server: notifications_type_check and notification_pref_key()
 * (migrations 012 and 014).
 *
 * `pref` is the Settings → Notifications switch that turns a type off; types
 * without one are always sent. Canceled and flagged trades are never skipped
 * (the server sends them through notify_always()), and offer outcomes
 * (accepted, declined, withdrawn, expired) have no switch.
 */
export const NOTIFICATION_TYPES: Record<
  NotificationType,
  { label: string; icon: LucideIcon; pref?: keyof NotificationPrefs }
> = {
  new_offer: { label: 'New offer', icon: ArrowLeftRight, pref: 'newOffers' },
  counter_offer: { label: 'Counter-offer', icon: Repeat, pref: 'newOffers' },
  offer_accepted: { label: 'Offer accepted', icon: CheckCircle2 },
  offer_declined: { label: 'Offer declined', icon: XCircle },
  offer_withdrawn: { label: 'Offer withdrawn', icon: RotateCcw },
  new_message: { label: 'Message', icon: MessageSquare, pref: 'messages' },
  agreement_ready: { label: 'Trade agreement', icon: FileCheck, pref: 'agreementUpdates' },
  trade_canceled: { label: 'Trade canceled', icon: XCircle },
  trade_flagged: { label: 'Trade flagged', icon: Flag },
  trade_complete: { label: 'Trade complete', icon: PartyPopper, pref: 'tradeCompletions' },
  review_request: { label: 'Review', icon: Star, pref: 'tradeCompletions' },
  match: { label: 'Listing match', icon: Sparkles, pref: 'perfectMatches' },
}

/** Meta for a type, with a neutral fallback for a type this build doesn't know yet. */
export function notificationMeta(type: string) {
  return (NOTIFICATION_TYPES as Record<string, (typeof NOTIFICATION_TYPES)[NotificationType]>)[type]
    ?? { label: 'Update', icon: FileCheck }
}

const AGREEMENT_TYPES: ReadonlySet<string> = new Set([
  'agreement_ready',
  'trade_canceled',
  'trade_flagged',
  'trade_complete',
  'review_request',
])

/** Where tapping a notification goes: the agreement for trade updates, else the offer, else the listing. */
export function notificationLink(n: Pick<AppNotification, 'type' | 'data'>): string {
  const { agreementId, offerId, listingId } = n.data ?? {}
  if (agreementId && AGREEMENT_TYPES.has(n.type)) return `/agreements/${agreementId}`
  if (offerId) return `/offers/${offerId}`
  if (agreementId) return `/agreements/${agreementId}`
  if (listingId) return `/listing/${listingId}`
  return '/offers'
}
