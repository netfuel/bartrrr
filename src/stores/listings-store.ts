import { create } from 'zustand'
import { LISTING_TTL_DAYS, type Listing, type Category, type ListingCondition } from '@/types'
import { mockListings } from '@/data/mock-listings'
import { DEMO_MODE } from '@/lib/env'
import { generateId } from '@/lib/utils'
import * as svc from '@/lib/supabase/supabase-service'
import { persist } from './persist'
import { deleteListingPhotos } from '@/lib/photos'

interface NewListingData {
  title: string
  description: string
  category: Category
  condition?: ListingCondition
  seeking: string
  images: string[]
  userId: string
  location: { lat: number; lng: number; neighborhood: string }
}

interface ListingsState {
  listings: Listing[]
  setListings: (listings: Listing[]) => void
  getListingById: (id: string) => Listing | undefined
  getListingsByUser: (userId: string) => Listing[]
  addListing: (data: NewListingData) => string
  updateListing: (id: string, data: Partial<Listing>) => void
  withdrawListing: (id: string) => void
  renewListing: (id: string) => void
}

const ttlFromNow = () =>
  new Date(Date.now() + LISTING_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()

/**
 * Never keep more precision than ~1 km. Listings are public; the PRD only
 * allows neighborhood-level location until both parties agree to a trade.
 * The database enforces the same rounding (migration 004).
 */
const coarsen = (n: number) => Math.round(n * 100) / 100

export const initialListings = (): Listing[] => (DEMO_MODE ? [...mockListings] : [])

export const useListingsStore = create<ListingsState>((set, get) => {
  const replace = (id: string, listing: Listing | undefined) => {
    if (!listing) return
    set((state) => ({
      listings: state.listings.map((l) => (l.id === id ? listing : l)),
    }))
  }

  const patch = (id: string, data: Partial<Listing>, error: string) => {
    const previous = get().listings.find((l) => l.id === id)
    set((state) => ({
      listings: state.listings.map((l) => (l.id === id ? { ...l, ...data } : l)),
    }))
    persist(() => svc.updateListing(id, data), {
      error,
      onSuccess: (saved) => {
        replace(id, saved)
        // Photos dropped from the listing are no longer used anywhere
        if (data.images && previous) {
          deleteListingPhotos(previous.images.filter((u) => !saved.images.includes(u)))
        }
      },
      rollback: () => replace(id, previous),
    })
  }

  return {
    listings: initialListings(),

    setListings: (listings) => set({ listings }),

    getListingById: (id) => get().listings.find((l) => l.id === id),

    getListingsByUser: (userId) =>
      get().listings.filter((l) => l.userId === userId),

    addListing: (data) => {
      // Same id format as the DB so links made right away stay valid
      const id = generateId('listing')
      const location = {
        neighborhood: data.location.neighborhood,
        lat: coarsen(data.location.lat),
        lng: coarsen(data.location.lng),
      }
      const listing: Listing = {
        id,
        ...data,
        location,
        distanceMi: 0,
        createdAt: new Date().toISOString(),
        expiresAt: ttlFromNow(),
        status: 'active',
      }
      set((state) => ({ listings: [listing, ...state.listings] }))
      persist(() => svc.createListing({ ...data, location, id }), {
        error: "Couldn't save your new listing",
        onSuccess: (saved) => replace(id, saved),
        rollback: () =>
          set((state) => ({ listings: state.listings.filter((l) => l.id !== id) })),
      })
      return id
    },

    updateListing: (id, data) => {
      // Ownership, status and dates are server-controlled; only content edits here
      const { title, description, category, condition, seeking, images, status } = data
      const location = data.location && {
        neighborhood: data.location.neighborhood,
        lat: coarsen(data.location.lat),
        lng: coarsen(data.location.lng),
      }
      const clean = Object.fromEntries(
        Object.entries({ title, description, category, condition, seeking, images, status, location })
          .filter(([, v]) => v !== undefined),
      ) as Partial<Listing>
      patch(id, clean, "Couldn't save your listing changes")
    },

    withdrawListing: (id) => {
      patch(id, { status: 'closed' }, "Couldn't take down your listing")
    },

    renewListing: (id) => {
      // The server restarts the 30-day window when a listing is reactivated
      patch(
        id,
        { status: 'active', expiresAt: ttlFromNow() },
        "Couldn't relist your listing",
      )
    },
  }
})
