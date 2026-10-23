import { create } from 'zustand'
import type { Review } from '@/types'
import { generateId } from '@/lib/utils'
import * as svc from '@/lib/supabase/supabase-service'
import { persist } from './persist'

interface AddReviewData {
  agreementId: string
  reviewerId: string
  revieweeId: string
  rating: number
  comment: string
}

interface ReviewsState {
  reviews: Review[]
  setReviews: (reviews: Review[]) => void
  getReviewsForUser: (userId: string) => Review[]
  hasReviewed: (agreementId: string, userId: string) => boolean
  addReview: (data: AddReviewData) => void
}

export const useReviewsStore = create<ReviewsState>((set, get) => ({
  reviews: [],

  setReviews: (reviews) => set({ reviews }),

  getReviewsForUser: (userId) =>
    get().reviews.filter((r) => r.revieweeId === userId),

  hasReviewed: (agreementId, userId) =>
    get().reviews.some(
      (r) => r.agreementId === agreementId && r.reviewerId === userId,
    ),

  addReview: (data) => {
    if (get().hasReviewed(data.agreementId, data.reviewerId)) return
    const id = generateId('review')
    const review: Review = {
      id,
      ...data,
      createdAt: new Date().toISOString(),
    }
    set((state) => ({ reviews: [...state.reviews, review] }))
    persist(() => svc.addReview({ ...data, id }), {
      error: "Couldn't save your review",
      onSuccess: (saved) =>
        set((state) => ({
          reviews: state.reviews.map((r) => (r.id === id ? saved : r)),
        })),
      rollback: () => set((state) => ({ reviews: state.reviews.filter((r) => r.id !== id) })),
    })
  },
}))
