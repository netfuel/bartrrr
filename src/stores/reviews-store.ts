import { create } from 'zustand'
import type { Review } from '@/types'
import { generateId } from '@/lib/utils'

interface AddReviewData {
  agreementId: string
  reviewerId: string
  revieweeId: string
  rating: number
  comment: string
}

interface ReviewsState {
  reviews: Review[]
  getReviewsForUser: (userId: string) => Review[]
  hasReviewed: (agreementId: string, userId: string) => boolean
  addReview: (data: AddReviewData) => void
}

export const useReviewsStore = create<ReviewsState>((set, get) => ({
  reviews: [],

  getReviewsForUser: (userId) =>
    get().reviews.filter((r) => r.revieweeId === userId),

  hasReviewed: (agreementId, userId) =>
    get().reviews.some(
      (r) => r.agreementId === agreementId && r.reviewerId === userId,
    ),

  addReview: (data) => {
    const review: Review = {
      id: generateId(),
      ...data,
      createdAt: new Date().toISOString(),
    }
    set((state) => ({ reviews: [...state.reviews, review] }))
  },
}))
