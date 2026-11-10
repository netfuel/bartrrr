import { describe, expect, it } from 'vitest'
import { NO_RATINGS_LABEL, reputationOf } from './reputation'

/** T-69: no stars before the first review, whatever the score says. */
describe('reputationOf', () => {
  it('shows "No ratings yet" for a new neighbor at the server default of 5.0', () => {
    expect(reputationOf({ reputationScore: 5, reviewCount: 0 })).toEqual({
      rated: false,
      reviewCount: 0,
      score: null,
      label: NO_RATINGS_LABEL,
    })
  })

  it('treats an unknown review count as no reviews', () => {
    expect(reputationOf({ reputationScore: 5 }).rated).toBe(false)
  })

  it('rates a neighbor once they have a review', () => {
    expect(reputationOf({ reputationScore: 4.75, reviewCount: 3 })).toEqual({
      rated: true,
      reviewCount: 3,
      score: '4.8',
      label: '4.8 out of 5 stars',
    })
  })

  it('a perfect record with reviews still shows 5.0', () => {
    expect(reputationOf({ reputationScore: 5, reviewCount: 2 }).score).toBe('5.0')
  })

  it('counts reviews loaded on this device that the server count missed', () => {
    const r = reputationOf({ reputationScore: 4, reviewCount: 0 }, 1)
    expect(r).toMatchObject({ rated: true, reviewCount: 1, score: '4.0' })
  })

  it('never shows a broken score', () => {
    expect(reputationOf({ reputationScore: Number.NaN, reviewCount: 4 }).rated).toBe(false)
  })
})
