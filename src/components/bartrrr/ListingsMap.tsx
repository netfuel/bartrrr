import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type * as maplibregl from 'maplibre-gl'
import { Map as MapIcon } from 'lucide-react'
import type { Listing, UserProfile } from '@/types'
import { formatDistance } from '@/lib/utils'

type MaplibreModule = typeof maplibregl

// maplibre-gl (~1 MB plus its worker) is fetched only when a map actually
// mounts, so the Browse list view (and phones that never open the map)
// never download it. The worker is emitted as a same-origin asset and
// pointed at explicitly: the default lookup assumes the unbundled dist/.
let maplibrePromise: Promise<MaplibreModule> | null = null
function loadMaplibre(): Promise<MaplibreModule> {
  maplibrePromise ??= Promise.all([
    import('maplibre-gl'),
    import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
    import('maplibre-gl/dist/maplibre-gl.css'),
  ])
    .then(([mod, worker]) => {
      mod.setWorkerUrl(worker.default)
      return mod
    })
    .catch((err) => {
      maplibrePromise = null // allow a retry on the next mount
      throw err
    })
  return maplibrePromise
}

// OpenFreeMap: free OpenStreetMap vector tiles, no API key. Positron is the
// calm, low-contrast base; a few paint overrides below warm it up to match
// globals.css. Style, tiles, glyphs and sprites all come from this host
// (allowed in public/_headers CSP connect-src).
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

// Same text OpenFreeMap's TileJSON carries, so MapLibre de-duplicates it once
// tiles load, and the credit still shows if they don't. OSM attribution is required.
const MAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> ' +
  '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">&copy; OpenMapTiles</a> ' +
  'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'

/** Warm the neutral positron palette toward the linen/teal/forest tokens. Best-effort. */
function warmStyle(map: maplibregl.Map) {
  const layers = map.getStyle()?.layers ?? []
  for (const layer of layers) {
    try {
      const sourceLayer = 'source-layer' in layer ? layer['source-layer'] : undefined
      if (layer.type === 'background') {
        map.setPaintProperty(layer.id, 'background-color', '#f6f1eb') // linen
      } else if (layer.type === 'fill' && sourceLayer === 'water') {
        map.setPaintProperty(layer.id, 'fill-color', '#dbe3df') // soft teal
      } else if (layer.type === 'fill' && (sourceLayer === 'park' || /park|wood|grass/.test(layer.id))) {
        map.setPaintProperty(layer.id, 'fill-color', '#e4e6da') // forest-light
      }
    } catch {
      // A layer we don't recognize: leave the stock style alone.
    }
  }
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
  const map = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const maplibreRef = useRef<MaplibreModule | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapFailed, setMapFailed] = useState(false)
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!mapContainer.current || map.current) return
    let cancelled = false
    let failed = false
    const container = mapContainer.current
    const fail = (err: unknown) => {
      if (cancelled || failed) return
      failed = true
      console.warn('[Bartrrr] Map failed to load', err)
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      map.current?.remove()
      map.current = null
      setMapReady(false)
      setMapFailed(true)
    }

    loadMaplibre()
      .then((maplibre) => {
        if (cancelled || map.current) return
        maplibreRef.current = maplibre

        const instance = new maplibre.Map({
          container,
          style: MAP_STYLE_URL,
          center: [DEFAULT_LNG, DEFAULT_LAT],
          zoom: 13,
          attributionControl: false,
        })
        map.current = instance

        instance.addControl(
          new maplibre.AttributionControl({ compact: true, customAttribution: MAP_ATTRIBUTION }),
          'bottom-right',
        )
        instance.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right')

        // A missing tile now and then is normal; the style itself failing
        // (offline, blocked, host down) before first load means no map.
        let loaded = false
        instance.on('style.load', () => warmStyle(instance))
        instance.once('load', () => {
          loaded = true
        })
        instance.on('error', (e) => {
          if (!loaded) fail(e.error)
        })

        setMapReady(true)
      })
      .catch(fail)

    return () => {
      cancelled = true
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      map.current?.remove()
      map.current = null
      setMapReady(false)
    }
  }, [])

  // Add/update markers when listings change
  useEffect(() => {
    const maplibre = maplibreRef.current
    if (!mapReady || !map.current || !maplibre) return

    // Remove old markers
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    listings.forEach((listing) => {
      const { lat, lng } = listing.location
      if (!lat || !lng) return

      const color = CATEGORY_COLORS[listing.category] || '#9c5b3c'

      // Outer wrapper — MapLibre owns the transform on this element for positioning.
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

      const marker = new maplibre.Marker({ element: wrapper })
        .setLngLat([lng, lat])
        .addTo(map.current!)

      markersRef.current.push(marker)
    })
  }, [listings, mapReady])

  // Couldn't load the map library, its style or WebGL: point to the list view
  if (mapFailed) {
    return (
      <div
        role="status"
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
        <p className="text-[15px] text-forest max-w-xs">
          You can still see every nearby listing in the list view.
        </p>
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
