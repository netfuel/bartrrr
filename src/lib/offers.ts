import { DECLINE_REASON_LABELS, type Offer, type OfferDeclineReason, type OfferMessage } from '@/types'

/** Pending or countered: the negotiation is still going. */
export function isOpenOffer(offer: Pick<Offer, 'status'>): boolean {
  return offer.status === 'pending' || offer.status === 'countered'
}

/** The latest offer or counter-offer in the thread (chat messages don't count). */
export function lastMove(messages: OfferMessage[]): OfferMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.type === 'offer' || m.type === 'counter') return m
  }
  return undefined
}

/**
 * Whose move it is on an offer, from `userId`'s side.
 * - 'mine': the other neighbor made the latest offer or counter-offer
 * - 'theirs': you made it and are waiting on them
 * - 'closed': accepted, declined, withdrawn or expired
 * Chat messages never change whose move it is.
 */
export function whoseMove(
  offer: Pick<Offer, 'status' | 'fromUserId' | 'messages'>,
  userId: string,
): 'mine' | 'theirs' | 'closed' {
  if (!isOpenOffer(offer)) return 'closed'
  const mover = lastMove(offer.messages)?.fromUserId ?? offer.fromUserId
  return mover === userId ? 'theirs' : 'mine'
}

// ─── Declines ────────────────────────────────────────────────
// respond_to_offer (migration 004) stores one text field per decline. A
// decline without a note stores the reason key, which the server's
// notification trigger (migration 005) turns into its label. With a note it
// stores "<reason label>. <note>", so the notification reads naturally and
// the app can still split it back into reason and note.

const SEPARATOR = '. '

/** The text to store for a decline. */
export function declineContent(reason: OfferDeclineReason, note?: string): string {
  const trimmed = note?.trim()
  return trimmed ? `${DECLINE_REASON_LABELS[reason]}${SEPARATOR}${trimmed}` : reason
}

/** Split a stored decline back into its reason and note. Older declines may hold only a note. */
export function parseDecline(content: string): { reason?: OfferDeclineReason; note?: string } {
  const text = content.trim()
  for (const [key, label] of Object.entries(DECLINE_REASON_LABELS) as [OfferDeclineReason, string][]) {
    if (text === key || text === label) return { reason: key }
    if (text.startsWith(label + SEPARATOR)) {
      const note = text.slice(label.length + SEPARATOR.length).trim()
      return note ? { reason: key, note } : { reason: key }
    }
  }
  return text ? { note: text } : {}
}

/** One line for previews: "Declined: <reason>. <note>". */
export function declineSummary(content: string): string {
  const { reason, note } = parseDecline(content)
  if (!reason) return note ?? 'Declined'
  const label = `Declined: ${DECLINE_REASON_LABELS[reason]}`
  return note ? `${label}${SEPARATOR}${note}` : label
}

/** Preview text for a thread message (inbox rows, notifications). */
export function messagePreview(message: Pick<OfferMessage, 'type' | 'content'>): string {
  return message.type === 'decline' ? declineSummary(message.content) : message.content
}
