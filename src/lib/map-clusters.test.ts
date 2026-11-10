import { describe, expect, it } from 'vitest'
import type { Listing } from '@/types'
import { clusterLabel, groupByLocation } from './map-clusters'

const at = (id: string, lat: number, lng: number, neighborhood = 'Midtown'): Listing => ({
  id,
  title: id,
  description: '',
  category: 'goods',
  seeking: 'x',
  images: [],
  userId: 'u1',
  location: { lat, lng, neighborhood },
  createdAt: '2026-11-01T00:00:00Z',
  status: 'active',
})

describe('groupByLocation (T-62)', () => {
  it('puts listings at the same neighborhood center under one pin, keeping order', () => {
    const groups = groupByLocation([
      at('a', 35.15, -90.05),
      at('b', 35.14, -90.01, 'Overton Square'),
      at('c', 35.15, -90.05),
    ])
    expect(groups.map((g) => g.listings.map((l) => l.id))).toEqual([['a', 'c'], ['b']])
    // The pin stays exactly on the shared point: never moved off the center
    expect(groups[0]).toMatchObject({ lat: 35.15, lng: -90.05 })
  })
  it('keeps nearby but different points apart', () => {
    expect(groupByLocation([at('a', 35.15, -90.05), at('b', 35.1501, -90.05)])).toHaveLength(2)
  })
  it('leaves off listings with no coordinates', () => {
    expect(groupByLocation([at('a', 0, 0)])).toEqual([])
  })
})

describe('clusterLabel', () => {
  it('names the neighborhood', () => {
    expect(clusterLabel({ listings: [at('a', 1, 1), at('b', 1, 1)] })).toBe('2 listings in Midtown')
  })
  it('falls back to "here" when the neighborhoods differ', () => {
    expect(clusterLabel({ listings: [at('a', 1, 1), at('b', 1, 1, 'Downtown Memphis')] })).toBe('2 listings here')
  })
})
