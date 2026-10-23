import { useEffect } from 'react'
import { useOffersStore } from './offers-store'

/**
 * Re-evaluate the 72-hour offer window every minute so offers flip to
 * "expired" while the app is open. The server's expire_stale_offers() job
 * (migration 004) is the source of truth; this keeps the UI honest between
 * sweeps.
 */
export function useOfferExpiryTicker(intervalMs = 60_000) {
  useEffect(() => {
    const tick = () => useOffersStore.getState().expireStale()
    tick()
    const id = setInterval(tick, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
}
