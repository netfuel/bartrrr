import type { AgreementStatus, TradeAgreement } from '@/types'

/** Statuses where the terms are still being agreed (both haven't signed). */
export const OPEN_FOR_EDITS: AgreementStatus[] = ['draft', 'under_review', 'pending_signatures']

export const LATE_CANCEL_HOURS = 24

export const isBeingAgreed = (a: Pick<TradeAgreement, 'status'>) => OPEN_FOR_EDITS.includes(a.status)

/** Either neighbor can cancel until the swap is done (migration 004). */
export const canCancel = (a: Pick<TradeAgreement, 'status'>) =>
  isBeingAgreed(a) || a.status === 'active'

/** Active or completed trades can be flagged for review (migration 004). */
export const canFlag = (a: Pick<TradeAgreement, 'status'>) =>
  a.status === 'active' || a.status === 'completed'

/** The swap time, or null when unset or not a real timestamp (older rows). */
export function exchangeTime(a: Pick<TradeAgreement, 'exchangeDate'>): Date | null {
  if (!a.exchangeDate) return null
  const t = new Date(a.exchangeDate)
  return Number.isNaN(t.getTime()) ? null : t
}

/**
 * Mirrors agreements_details_guard (migration 009): late when the swap was
 * agreed (both signed) and is under 24 hours away, or already past. The
 * server decides for real; this only drives the warning.
 */
export function isLateCancellation(a: TradeAgreement, now = Date.now()): boolean {
  if (a.status !== 'active') return false
  const at = exchangeTime(a)
  return at !== null && now > at.getTime() - LATE_CANCEL_HOURS * 3_600_000
}

/** What's still needed before anyone can sign, in reading order. */
export function missingDetails(a: TradeAgreement): string[] {
  const missing: string[] = []
  if (!a.exchangeMethod) missing.push("how you'll swap")
  if (!exchangeTime(a)) missing.push('a date and time')
  if (!a.exchangeLocation?.trim()) missing.push('a place')
  return missing
}

/** "how you'll swap, date and time and place" → readable list */
export function listPhrase(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** "Saturday, November 1 at 10:00 AM" (style guide §2) */
export function formatExchangeTime(at: Date): string {
  const day = at.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${day} at ${time}`
}

/** "Oct 28" */
export const formatShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const pad = (n: number) => String(n).padStart(2, '0')

/** ISO → value for <input type="datetime-local"> in the viewer's time zone */
export function toLocalInputValue(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** <input type="datetime-local"> value (local time) → ISO in UTC, or undefined */
export function fromLocalInputValue(value: string): string | undefined {
  if (!value) return undefined
  const d = new Date(value) // no offset in the string: parsed as local time
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}
