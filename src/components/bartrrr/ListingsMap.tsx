import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Map as MapIcon } from 'lucide-react'
import type { Listing, UserProfile } from '@/types'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

// Memphis, TN service area center
const DEFAULT_LNG = -90.049
const DEFAULT_LAT = 35.1495

// Category pin colors match our design system
const CATEGORY_COLORS: Record<string, string> = {
  goods: '#C05A35',    // clay
  services: '#3AABA6', // teal
  skills: '#C88A2A',   // gold
  outdoor: '#7A9A3A',  // moss
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
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainer.current || map.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [DEFAULT_LNG, DEFAULT_LAT],
      zoom: 13,
    })

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    return () => {
      markersRef.current.forEach((m) => m.remove())
      map.current?.remove()
      map.current = null
    }
  }, [])

  // Add/update markers when listings change
  useEffect(() => {
    if (!map.current || !MAPBOX_TOKEN) return

    // Remove old markers
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    listings.forEach((listing) => {
      const { lat, lng } = listing.location
      if (!lat || !lng) return

      const color = CATEGORY_COLORS[listing.category] || '#C05A35'

      // Outer wrapper — Mapbox owns the transform on this element for positioning.
      // Never touch its transform or the pin will jump to (0,0).
      const wrapper = document.createElement('div')
      wrapper.style.cssText = `width: 32px; height: 32px; cursor: pointer;`

      // Inner element handles all visual styling & hover scale
      const pin = document.createElement('div')
      pin.style.cssText = `
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        background: ${color};
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        transition: transform 0.15s, box-shadow 0.15s;
      `
      wrapper.appendChild(pin)

      wrapper.addEventListener('mouseenter', () => {
        pin.style.transform = 'rotate(-45deg) scale(1.2)'
        pin.style.boxShadow = '0 4px 16px rgba(0,0,0,0.35)'
      })
      wrapper.addEventListener('mouseleave', () => {
        pin.style.transform = 'rotate(-45deg) scale(1)'
        pin.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)'
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
  }, [listings])

  // No token — show instructions
  if (!MAPBOX_TOKEN) {
    return (
      <div className={`flex flex-col items-center justify-center bg-forest-light h-full text-center p-8 ${className}`}>
        <MapIcon className="h-14 w-14 text-forest-mid mb-4" />
        <p className="font-display text-lg font-semibold text-forest mb-2">Map View</p>
        <p className="text-sm text-forest-mid max-w-xs mb-3">
          Add your Mapbox token to enable the interactive map with listing pins.
        </p>
        <code className="text-xs bg-forest/10 text-forest px-3 py-2 rounded-md">
          VITE_MAPBOX_TOKEN=pk.your_token
        </code>
        <p className="text-xs text-forest-mid mt-2">in .env.local</p>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={mapContainer} className="w-full h-full" />

      {/* Listing preview card on pin click */}
      {selectedListing && (
        <div className="absolute bottom-4 left-4 right-4 bg-white rounded-xl shadow-lg border border-sand-light p-3 z-10">
          <button
            type="button"
            className="absolute top-2 right-2 text-muted hover:text-ink text-xs"
            onClick={() => setSelectedListing(null)}
          >
            ✕
          </button>
          <div className="flex items-start gap-3">
            {selectedListing.images[0] && (
              <img
                src={selectedListing.images[0]}
                alt={selectedListing.title}
                className="w-16 h-16 rounded-lg object-cover shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink truncate">{selectedListing.title}</p>
              <p className="text-xs text-muted">{selectedListing.location.neighborhood}</p>
              {selectedListing.distanceMi !== undefined && (
                <p className="text-xs text-muted">
                  {selectedListing.distanceMi < 0.1
                    ? 'Nearby'
                    : selectedListing.distanceMi < 1
                    ? `${(selectedListing.distanceMi * 5280).toFixed(0)} ft away`
                    : `${selectedListing.distanceMi.toFixed(1)} mi away`}
                </p>
              )}
              {users[selectedListing.userId] && (
                <p className="text-xs text-muted mt-0.5">
                  {users[selectedListing.userId].displayName}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/listing/${selectedListing.id}`)}
            className="mt-3 w-full py-2 bg-clay text-white text-sm font-semibold rounded-full hover:bg-clay-dark transition-colors"
          >
            View listing
          </button>
        </div>
      )}
    </div>
  )
}
