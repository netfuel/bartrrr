import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type mapboxgl from 'mapbox-gl'
import { Map as MapIcon } from 'lucide-react'
import type { Listing, UserProfile } from '@/types'
import { formatDistance } from '@/lib/utils'
import { MAPBOX_TOKEN } from '@/lib/env'

type MapboxModule = typeof mapboxgl

// mapbox-gl (~1.7 MB) is fetched only when a map actually mounts, so the
// Browse list view (and phones that never open the map) never download it.
let mapboxPromise: Promise<MapboxModule> | null = null
function loadMapbox(): Promise<MapboxModule> {
  mapboxPromise ??= Promise.all([
    import('mapbox-gl'),
    import('mapbox-gl/dist/mapbox-gl.css'),
  ]).then(([mod]) => mod.default)
  return mapboxPromise
}

// Memphis, TN service area center
const DEFAULT_LNG = -90.049
const DEFAULT_LAT = 35.1495

// Category pin colors match the design tokens in globals.css
const CATEGORY_COLORS: Record<string, string> = {
  goods: '#9c5b3c',    // clay
  services: '#4d6a62', // teal
  skills: '#86662a',   // gold
  outdoor: '#5f6532',  // moss
}

export interface ListingsMapProps {
  listings: Listing[]
  users: Record<string, UserProfile>
  className?: string
}

export function ListingsMap({ listings, users, className = '' }: ListingsMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const mapboxRef = useRef<MapboxModule | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainer.current || map.current) return
    let cancelled = false
    const container = mapContainer.current

    loadMapbox()
      .then((mapboxgl) => {
        if (cancelled || map.current) return
        mapboxRef.current = mapboxgl
        mapboxgl.accessToken = MAPBOX_TOKEN

        map.current = new mapboxgl.Map({
          container,
          style: 'mapbox://styles/mapbox/light-v11',
          center: [DEFAULT_LNG, DEFAULT_LAT],
          zoom: 13,
        })

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
        setMapReady(true)
      })
      .catch((err) => console.warn('[Bartrrr] Map failed to load', err))

    return () => {
      cancelled = true
      markersRef.current.forEach((m) => m.remove())
      map.current?.remove()
      map.current = null
      setMapReady(false)
    }
  }, [])

  // Add/update markers when listings change
  useEffect(() => {
    const mapboxgl = mapboxRef.current
    if (!mapReady || !map.current || !mapboxgl || !MAPBOX_TOKEN) return

    // Remove old markers
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    listings.forEach((listing) => {
      const { lat, lng } = listing.location
      if (!lat || !lng) return

      const color = CATEGORY_COLORS[listing.category] || '#9c5b3c'

      // Outer wrapper — Mapbox owns the transform on this element for positioning.
      // Never touch its transform or the pin will jump to (0,0).
      const wrapper = document.createElement('div')
      wrapper.style.cssText = `width: 44px; height: 44px; cursor: pointer; display: grid; place-items: center;`
      wrapper.setAttribute('role', 'button')
      wrapper.setAttribute('aria-label', listing.title)

      // Inner element handles all visual styling & hover scale. A dot inside
      // a soft halo reads as "around here", not a doorstep: location is
      // neighborhood-level until both neighbors agree to a trade.
      const pin = document.createElement('div')
      pin.style.cssText = `
        width: 16px;
        height: 16px;
        border-radius: 9999px;
        background: ${color};
        border: 2px solid #f6f1eb;
        box-shadow: 0 0 0 10px ${color}29, 0 1px 3px rgba(64,58,52,0.3);
        transition: transform 0.3s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.3s;
      `
      wrapper.appendChild(pin)

      wrapper.addEventListener('mouseenter', () => {
        pin.style.transform = 'scale(1.25)'
        pin.style.boxShadow = `0 0 0 14px ${color}38, 0 2px 6px rgba(64,58,52,0.35)`
      })
      wrapper.addEventListener('mouseleave', () => {
        pin.style.transform = 'scale(1)'
        pin.style.boxShadow = `0 0 0 10px ${color}29, 0 1px 3px rgba(64,58,52,0.3)`
      })
      wrapper.addEventListener('click', () => {
        setSelectedListing(listing)
        map.current?.flyTo({ center: [lng, lat], zoom: 15 })
      })

      const marker = new mapboxgl.Marker({ element: wrapper })
        .setLngLat([lng, lat])
        .addTo(map.current!)

      markersRef.current.push(marker)
    })
  }, [listings, mapReady])

  // No token — show instructions
  if (!MAPBOX_TOKEN) {
    return (
      <div
        className={`relative flex flex-col items-center justify-center overflow-hidden bg-forest-light h-full text-center p-8 ${className}`}
        style={{
          backgroundImage:
            'linear-gradient(rgba(74,82,64,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(74,82,64,0.08) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      >
        <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-forest text-forest">
          <MapIcon className="h-6 w-6" />
        </span>
        <p className="font-display text-[24px] text-forest-dark mb-2">Map isn't available right now</p>
        <p className="text-[15px] text-forest max-w-xs mb-4">
          You can still see every nearby listing in the list view.
        </p>
        {import.meta.env.DEV && (
          <>
            <code className="text-small bg-cream/70 border border-forest/30 text-forest-dark px-3 py-2 rounded-none">
              VITE_MAPBOX_TOKEN=pk.your_token
            </code>
            <p className="text-label text-forest mt-3">Developers: add this to .env.local</p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={mapContainer} className="w-full h-full" />

      {/* Listing preview card on pin click */}
      {selectedListing && (
        <div className="animate-slide-up absolute bottom-4 left-4 right-4 mx-auto max-w-md bg-paper rounded-none border border-ink p-4 shadow-float z-10">
          <button
            type="button"
            aria-label="Close preview"
            className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-sand-light hover:text-ink text-xs"
            onClick={() => setSelectedListing(null)}
          >
            ✕
          </button>
          <div className="flex items-start gap-3">
            {selectedListing.images[0] && (
              <img
                src={selectedListing.images[0]}
                alt={selectedListing.title}
                className="photo-warm w-16 h-16 rounded-none object-cover shrink-0"
              />
            )}
            <div className="flex-1 min-w-0 pr-6">
              <p className="font-display text-[18px] leading-tight text-ink truncate">{selectedListing.title}</p>
              <p className="text-small text-muted">{selectedListing.location.neighborhood}</p>
              {selectedListing.distanceMi !== undefined && (
                <p className="text-small text-muted">
                  {formatDistance(selectedListing.distanceMi)}
                </p>
              )}
              {users[selectedListing.userId] && (
                <p className="text-small text-muted mt-0.5">
                  {users[selectedListing.userId].displayName}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/listing/${selectedListing.id}`)}
            className="pressable mt-3 w-full min-h-[44px] border border-ink bg-ink text-cream text-[15px] font-medium hover:bg-clay-dark hover:border-clay-dark transition-colors duration-300"
          >
            View listing
          </button>
        </div>
      )}
    </div>
  )
}
