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
// Since migration 014 a decline is stored as a reason code
// (offer_messages.decline_reason, sent as respond_to_offer's p_reason) plus
// the neighbor's note as the message content, or the code itself as content
// when there's no note (content can't be empty). The server's notification
// renders "<label>" or "<label>. <note>".
//
// Before 014 there was one text field: the reason key alone, or
// "<reason label>. <note>" (declineContent). Those rows are still read here
// (014 backfills their code but leaves content as written), and
// declineContent is still what the app sends to a database without 014.

const SEPARATOR = '. '

function isReason(code: unknown): code is OfferDeclineReason {
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(DECLINE_REASON_LABELS, code)
}

/** What to send for a decline (migration 014): the code, and the note (or the code) as content. */
export function declinePayload(reason: OfferDeclineReason, note?: string): { reason: OfferDeclineReason; content: string } {
  return { reason, content: note?.trim() || reason }
}

/** The pre-014 single text for a decline: the key, or "<label>. <note>". */
export function declineContent(reason: OfferDeclineReason, note?: string): string {
  const trimmed = note?.trim()
  return trimmed ? `${DECLINE_REASON_LABELS[reason]}${SEPARATOR}${trimmed}` : reason
}

function parseLegacy(text: string): { reason?: OfferDeclineReason; note?: string } {
  for (const [key, label] of Object.entries(DECLINE_REASON_LABELS) as [OfferDeclineReason, string][]) {
    if (text === key || text === label) return { reason: key }
    if (text.startsWith(label + SEPARATOR)) {
      const note = text.slice(label.length + SEPARATOR.length).trim()
      return note ? { reason: key, note } : { reason: key }
    }
  }
  return text ? { note: text } : {}
}

/**
 * Split a stored decline into its reason and note. `code` is the message's
 * decline_reason when the server sent one; without it (a database before
 * 014, or a note-only decline) the reason is read out of the content, as
 * before. Note-only declines have no reason.
 */
export function parseDecline(
  content: string,
  code?: string | null,
): { reason?: OfferDeclineReason; note?: string } {
  const text = content.trim()
  const legacy = parseLegacy(text)
  // Old-shape content (key, label, "label. note") already agrees with the code
  if (!isReason(code) || legacy.reason === code) return legacy
  return text ? { reason: code, note: text } : { reason: code }
}

/** One line for previews: "Declined: <reason>. <note>". */
export function declineSummary(content: string, code?: string | null): string {
  const { reason, note } = parseDecline(content, code)
  if (!reason) return note ?? 'Declined'
  const label = `Declined: ${DECLINE_REASON_LABELS[reason]}`
  return note ? `${label}${SEPARATOR}${note}` : label
}

/** Preview text for a thread message (inbox rows, notifications). */
export function messagePreview(message: Pick<OfferMessage, 'type' | 'content' | 'declineReason'>): string {
  return message.type === 'decline' ? declineSummary(message.content, message.declineReason) : message.content
}
