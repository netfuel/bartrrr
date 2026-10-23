/**
 * Approximate centers of Memphis-area neighborhoods. Listings are placed
 * here, never at anyone's address: per the PRD, location stays at the
 * neighborhood level until both neighbors agree to a trade.
 */
export const NEIGHBORHOOD_CENTERS: Record<string, { lat: number; lng: number }> = {
  'Downtown Memphis': { lat: 35.145, lng: -90.051 },
  Midtown: { lat: 35.137, lng: -90.007 },
  'Cooper-Young': { lat: 35.119, lng: -89.991 },
  'South Main Arts District': { lat: 35.133, lng: -90.057 },
  'Overton Square': { lat: 35.149, lng: -89.993 },
  'East Memphis': { lat: 35.108, lng: -89.9 },
  Germantown: { lat: 35.087, lng: -89.81 },
  Cordova: { lat: 35.156, lng: -89.776 },
  Bartlett: { lat: 35.205, lng: -89.874 },
  Binghampton: { lat: 35.144, lng: -89.96 },
  Whitehaven: { lat: 35.03, lng: -90.02 },
  Collierville: { lat: 35.042, lng: -89.665 },
  'Harbor Town': { lat: 35.158, lng: -90.056 },
  Frayser: { lat: 35.223, lng: -90.008 },
  Millington: { lat: 35.342, lng: -89.897 },
  Raleigh: { lat: 35.203, lng: -89.937 },
}

/** Memphis service-area center, for neighborhoods we don't know */
export const MEMPHIS_CENTER = { lat: 35.1495, lng: -90.049 }

export function neighborhoodCenter(name: string | undefined | null) {
  if (!name) return MEMPHIS_CENTER
  const key = Object.keys(NEIGHBORHOOD_CENTERS).find(
    (n) => n.toLowerCase() === name.trim().toLowerCase(),
  )
  return key ? NEIGHBORHOOD_CENTERS[key] : MEMPHIS_CENTER
}
