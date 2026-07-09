import { create } from 'zustand'
import type { Listing, Category, ListingCondition } from '@/types'
import { mockListings } from '@/data/mock-listings'
import { generateId } from '@/lib/utils'
import * as svc from '@/lib/supabase/supabase-service'
import { persistError } from './persist'

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

export const useListingsStore = create<ListingsState>((set, get) => ({
  listings: [...mockListings],

  setListings: (listings) => set({ listings }),

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
    // Persist to Supabase (fire and forget)
    svc.createListing(data).then((saved) => {
      // Replace the temp listing with the Supabase-generated one (updates id)
      set((state) => ({
        listings: state.listings.map((l) => (l.id === id ? saved : l)),
      }))
    }).catch(persistError("Couldn't save your new listing"))
    return id
  },

  updateListing: (id, data) => {
    set((state) => ({
      listings: state.listings.map((l) =>
        l.id === id ? { ...l, ...data } : l,
      ),
    }))
    svc.updateListing(id, data).catch(persistError("Couldn't save your listing changes"))
  },

  withdrawListing: (id) => {
    set((state) => ({
      listings: state.listings.map((l) =>
        l.id === id ? { ...l, status: 'closed' as const } : l,
      ),
    }))
    svc.updateListing(id, { status: 'closed' }).catch(persistError("Couldn't withdraw your listing"))
  },

  renewListing: (id) => {
    const now = new Date().toISOString()
    set((state) => ({
      listings: state.listings.map((l) =>
        l.id === id
          ? { ...l, status: 'active' as const, createdAt: now }
          : l,
      ),
    }))
    svc.updateListing(id, { status: 'active' }).catch(persistError("Couldn't renew your listing"))
  },
}))
