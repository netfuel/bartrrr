import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Listing } from '@/types'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/supabase/supabase-service', () => ({
  createListing: vi.fn(),
  updateListing: vi.fn(),
}))
vi.mock('@/lib/photos', () => ({ deleteListingPhotos: vi.fn() }))

import * as svc from '@/lib/supabase/supabase-service'
import { deleteListingPhotos } from '@/lib/photos'
import { useListingsStore } from './listings-store'
import { useToastStore } from './toast-store'

const flush = () => new Promise((r) => setTimeout(r, 0))
const createListing = vi.mocked(svc.createListing)
const updateListing = vi.mocked(svc.updateListing)
const deletePhotos = vi.mocked(deleteListingPhotos)

const A = 'https://proj.supabase.co/storage/v1/object/public/listing-photos/u1/a.webp'
const B = 'https://proj.supabase.co/storage/v1/object/public/listing-photos/u1/b.webp'
const C = 'https://proj.supabase.co/storage/v1/object/public/listing-photos/u1/c.webp'

const listing = (over: Partial<Listing> = {}): Listing => ({
  id: 'listing-1',
  title: 'Bike',
  description: 'Trek',
  category: 'goods',
  condition: 'good',
  seeking: 'Plants',
  images: [A, B],
  userId: 'u1',
  location: { lat: 35.12, lng: -89.99, neighborhood: 'Midtown' },
  createdAt: '2026-10-20T12:00:00Z',
  expiresAt: '2026-11-19T12:00:00Z',
  status: 'active',
  ...over,
})

const get = (id = 'listing-1') => useListingsStore.getState().getListingById(id)

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  useListingsStore.setState({ listings: [listing(), listing({ id: 'listing-2', userId: 'u2', images: [] })] })
  useToastStore.setState({ toasts: [] })
})

describe('selectors', () => {
  it('by id and by user', () => {
    expect(get()?.title).toBe('Bike')
    expect(useListingsStore.getState().getListingsByUser('u2').map((l) => l.id)).toEqual(['listing-2'])
  })
})

describe('addListing', () => {
  const data = {
    title: 'Lamp',
    description: '',
    category: 'goods' as const,
    seeking: 'Books',
    images: [C],
    userId: 'u1',
    location: { lat: 35.123456, lng: -89.987654, neighborhood: 'Midtown' },
  }

  it('adds optimistically with a DB-format id and coarsened (~1 km) location', () => {
    createListing.mockReturnValue(new Promise(() => {}))
    const id = useListingsStore.getState().addListing(data)
    expect(id).toMatch(/^listing-[0-9a-f]{32}$/)
    const l = useListingsStore.getState().listings[0]
    expect(l.id).toBe(id)
    expect(l.location).toEqual({ lat: 35.12, lng: -89.99, neighborhood: 'Midtown' })
    expect(l.status).toBe('active')
    expect(createListing).toHaveBeenCalledWith(expect.objectContaining({ id, location: l.location }))
  })

  it('swaps in the server copy on success', async () => {
    createListing.mockImplementation(async (d) => listing({ ...d, id: d.id!, title: 'Lamp (saved)' }))
    const id = useListingsStore.getState().addListing(data)
    await flush()
    expect(get(id)?.title).toBe('Lamp (saved)')
  })

  it('removes it again and tells the user when the save fails', async () => {
    createListing.mockRejectedValue({ code: 'P0001', message: 'You have too many listings.' })
    const id = useListingsStore.getState().addListing(data)
    await flush()
    expect(get(id)).toBeUndefined()
    expect(useListingsStore.getState().listings).toHaveLength(2)
    expect(useToastStore.getState().toasts.at(-1)?.message).toBe(
      "Couldn't save your new listing: You have too many listings.",
    )
  })
})

describe('updateListing (L-02)', () => {
  it('sends only content fields, never owner, dates or id', () => {
    updateListing.mockReturnValue(new Promise(() => {}))
    useListingsStore.getState().updateListing('listing-1', {
      title: 'Bike v2',
      userId: 'u2',
      createdAt: '2000-01-01',
      expiresAt: '2099-01-01',
      id: 'other',
      distanceMi: 0,
    } as Partial<Listing>)
    expect(updateListing).toHaveBeenCalledWith('listing-1', { title: 'Bike v2' })
    expect(get()?.title).toBe('Bike v2')
    expect(get()?.userId).toBe('u1')
  })

  it('coarsens an edited location', () => {
    updateListing.mockReturnValue(new Promise(() => {}))
    useListingsStore.getState().updateListing('listing-1', {
      location: { lat: 35.149999, lng: -90.0512, neighborhood: 'Downtown' },
    })
    expect(updateListing).toHaveBeenCalledWith('listing-1', {
      location: { lat: 35.15, lng: -90.05, neighborhood: 'Downtown' },
    })
  })

  it('deletes photos dropped from the listing only after a successful save', async () => {
    let resolve!: (l: Listing) => void
    updateListing.mockReturnValue(new Promise((r) => (resolve = r)))
    useListingsStore.getState().updateListing('listing-1', { images: [B, C] })
    expect(get()?.images).toEqual([B, C])
    await flush()
    expect(deletePhotos).not.toHaveBeenCalled()
    resolve(listing({ images: [B, C] }))
    await flush()
    expect(deletePhotos).toHaveBeenCalledWith([A])
  })

  it('keeps photos the server still has (compares with the saved copy)', async () => {
    updateListing.mockResolvedValue(listing({ images: [A, B] }))
    useListingsStore.getState().updateListing('listing-1', { images: [B] })
    await flush()
    expect(deletePhotos.mock.calls.flatMap(([urls]) => urls)).toEqual([])
  })

  it('never deletes photos when the save fails, and restores the old listing', async () => {
    updateListing.mockRejectedValue(new TypeError('Failed to fetch'))
    useListingsStore.getState().updateListing('listing-1', { title: 'Changed', images: [] })
    expect(get()?.images).toEqual([])
    await flush()
    expect(deletePhotos).not.toHaveBeenCalled()
    expect(get()).toEqual(listing())
    expect(useToastStore.getState().toasts.at(-1)?.message).toBe(
      "Couldn't save your listing changes. Check your connection and try again.",
    )
  })

  it(
    'a failed edit rolls back only its own change (T-29: a later edit that saved stays)',
    async () => {
      let failFirst!: (e: unknown) => void
      updateListing
        .mockReturnValueOnce(new Promise((_, rej) => (failFirst = rej)))
        .mockResolvedValueOnce(listing({ seeking: 'Books' }))
      useListingsStore.getState().updateListing('listing-1', { title: 'Bike v2' })
      useListingsStore.getState().updateListing('listing-1', { seeking: 'Books' })
      await flush() // second edit saved: local copy now matches the server
      failFirst(new Error('x'))
      await flush()
      expect(get()?.title).toBe('Bike')
      expect(get()?.seeking).toBe('Books')
    },
  )

  it('a text-only edit never touches photos', async () => {
    updateListing.mockResolvedValue(listing({ title: 'x' }))
    useListingsStore.getState().updateListing('listing-1', { title: 'x' })
    await flush()
    expect(deletePhotos).not.toHaveBeenCalled()
  })
})

describe('withdraw and renew', () => {
  it('withdraw closes it, and rolls back on failure', async () => {
    updateListing.mockRejectedValue(new Error('x'))
    useListingsStore.getState().withdrawListing('listing-1')
    expect(get()?.status).toBe('closed')
    expect(updateListing).toHaveBeenCalledWith('listing-1', { status: 'closed' })
    await flush()
    expect(get()?.status).toBe('active')
    expect(useToastStore.getState().toasts.at(-1)?.message).toBe("Couldn't take down your listing. Try again in a moment.")
  })

  it('renew sets active with a fresh 30-day window', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-03T12:00:00Z'))
    updateListing.mockReturnValue(new Promise(() => {}))
    useListingsStore.setState({ listings: [listing({ status: 'closed', expiresAt: '2026-10-01T00:00:00Z' })] })
    useListingsStore.getState().renewListing('listing-1')
    expect(get()).toMatchObject({ status: 'active', expiresAt: '2026-12-03T12:00:00.000Z' })
    vi.useRealTimers()
  })
})
