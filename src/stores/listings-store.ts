import { create } from 'zustand'
import type { Listing, Category, ListingCondition } from '@/types'
import { mockListings } from '@/data/mock-listings'
import { generateId } from '@/lib/utils'

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
  getListingById: (id: string) => Listing | undefined
  getListingsByUser: (userId: string) => Listing[]
  addListing: (data: NewListingData) => string
  updateListing: (id: string, data: Partial<Listing>) => void
  withdrawListing: (id: string) => void
  renewListing: (id: string) => void
}

export const useListingsStore = create<ListingsState>((set, get) => ({
  listings: [...mockListings],

  getListingById: (id) => get().listings.find((l) => l.id === id),

  getListingsByUser: (userId) =>
    get().listings.filter((l) => l.userId === userId),

  addListing: (data) => {
    const id = generateId()
    const listing: Listing = {
      id,
      ...data,
      distanceMi: Math.random() * 3,
      createdAt: new Date().toISOString(),
      status: 'active',
    }
    set((state) => ({ listings: [listing, ...state.listings] }))
    return id
  },

  updateListing: (id, data) =>
    set((state) => ({
      listings: state.listings.map((l) =>
        l.id === id ? { ...l, ...data } : l,
      ),
    })),

  withdrawListing: (id) =>
    set((state) => ({
      listings: state.listings.map((l) =>
        l.id === id ? { ...l, status: 'closed' as const } : l,
      ),
    })),

  renewListing: (id) =>
    set((state) => ({
      listings: state.listings.map((l) =>
        l.id === id
          ? { ...l, status: 'active' as const, createdAt: new Date().toISOString() }
          : l,
      ),
    })),
}))
