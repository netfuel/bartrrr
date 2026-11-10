import type { UserProfile } from '@/types'

/** Shown in place of stars until a neighbor's first review. */
export const NO_RATINGS_LABEL = 'No ratings yet'

export interface Reputation {
  /** At least one review: the score means something */
  rated: boolean
  reviewCount: number
  /** "4.8", or null before the first review */
  score: string | null
  /** For screen readers: "4.8 out of 5 stars" or "No ratings yet" */
  label: string
}

/**
 * A neighbor's rating, based on how many reviews they've had. The server
 * starts everyone at 5.0 (reputation_score defaults to 5.0 and stays there
 * until the first review), so the score alone can't tell a perfect record
 * from no record: never show stars for zero reviews.
 *
 * `loadedReviews` is how many of their reviews this device has loaded; it
 * covers a review that arrived after the server's count was read.
 */
export function reputationOf(
  user: Pick<UserProfile, 'reputationScore' | 'reviewCount'>,
  loadedReviews = 0,
): Reputation {
  const reviewCount = Math.max(user.reviewCount ?? 0, loadedReviews)
  if (reviewCount === 0 || !Number.isFinite(user.reputationScore)) {
    return { rated: false, reviewCount, score: null, label: NO_RATINGS_LABEL }
  }
  const score = user.reputationScore.toFixed(1)
  return { rated: true, reviewCount, score, label: `${score} out of 5 stars` }
}
