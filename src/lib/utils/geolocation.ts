import { ZIP_CENTROIDS } from './zipCentroids'

/** Farther than this from every known ZIP centroid counts as outside the service area. */
const MAX_ZIP_DISTANCE_KM = 8

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLng = (lng2 - lng1) * rad
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(a))
}

/**
 * Work out the ZIP code for a set of coordinates entirely on the device:
 * the nearest Memphis-area ZIP centroid within MAX_ZIP_DISTANCE_KM.
 * Coordinates never leave the browser. Returns null when nothing is close
 * enough (outside the area), so signup falls back to manual ZIP entry.
 * Async to keep the signature the network lookup used to have.
 */
export async function getZipFromCoords(lat: number, lng: number): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  let best: string | null = null
  let bestKm = MAX_ZIP_DISTANCE_KM
  for (const [zip, zLat, zLng] of ZIP_CENTROIDS) {
    const d = distanceKm(lat, lng, zLat, zLng)
    if (d <= bestKm) {
      best = zip
      bestKm = d
    }
  }
  return best
}

/** Promisified geolocation with a 10-second timeout */
export function requestLocation(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => reject(err),
      { timeout: 10_000, maximumAge: 300_000 },
    )
  })
}
