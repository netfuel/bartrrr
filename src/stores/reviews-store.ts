import { create } from 'zustand'
import type { Review } from '@/types'
import { generateId } from '@/lib/utils'
import * as svc from '@/lib/supabase/supabase-service'
import { persistError } from './persist'

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
    const id = generateId()
    const review: Review = {
      id,
      ...data,
      createdAt: new Date().toISOString(),
    }
    set((state) => ({ reviews: [...state.reviews, review] }))
    // Persist and swap the temp id for the server one
    svc.addReview(data).then((saved) => {
      set((state) => ({
        reviews: state.reviews.some((r) => r.id === saved.id)
          ? state.reviews.filter((r) => r.id !== id)
          : state.reviews.map((r) => (r.id === id ? saved : r)),
      }))
    }).catch(persistError("Couldn't save your review"))
  },
}))
