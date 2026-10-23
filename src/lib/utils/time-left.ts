/**
 * Plain-language countdown for offer expiry ("2 days", "5 hours").
 * Returns null once the time has passed.
 */
export function formatTimeLeft(iso: string, now: number = Date.now()): string | null {
  const ms = new Date(iso).getTime() - now
  if (!Number.isFinite(ms) || ms <= 0) return null
  const hours = Math.floor(ms / 3_600_000)
  if (hours >= 48) {
    const days = Math.floor(hours / 24)
    return `${days} days`
  }
  if (hours >= 1) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
  const minutes = Math.max(1, Math.floor(ms / 60_000))
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
}
