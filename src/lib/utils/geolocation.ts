import { MAPBOX_TOKEN } from '@/lib/env'

/** Reverse geocode coordinates to a US zip code using Mapbox */
export async function getZipFromCoords(lat: number, lng: number): Promise<string | null> {
  if (!MAPBOX_TOKEN) return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  try {
    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng.toFixed(5)},${lat.toFixed(5)}.json`,
    )
    url.searchParams.set('types', 'postcode')
    url.searchParams.set('country', 'US')
    url.searchParams.set('access_token', MAPBOX_TOKEN)
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const zip = data.features?.[0]?.text
    return typeof zip === 'string' && /^\d{5}$/.test(zip) ? zip : null
  } catch {
    return null
  }
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
