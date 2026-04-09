import { Star } from 'lucide-react'
import { Avatar } from '@/components/ui'
import type { Review, UserProfile } from '@/types'

export interface ReviewCardProps {
  review: Review
  reviewer: UserProfile
}

export function ReviewCard({ review, reviewer }: ReviewCardProps) {
  return (
    <div className="bg-white rounded-lg border border-sand-light p-4 mb-3">
      <div className="flex items-center gap-3 mb-2">
        <Avatar
          name={reviewer.displayName}
          userId={reviewer.id}
          src={reviewer.avatarUrl}
          size="sm"
        />
        <div className="flex-1">
          <p className="text-sm font-medium text-ink">{reviewer.displayName}</p>
          <p className="text-xs text-muted">
            {new Date(review.createdAt).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`h-3.5 w-3.5 ${
                star <= review.rating ? 'fill-gold text-gold' : 'text-sand'
              }`}
            />
          ))}
        </div>
      </div>
      {review.comment && (
        <p className="text-sm text-ink-2 leading-relaxed">{review.comment}</p>
      )}
    </div>
  )
}
