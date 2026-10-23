import { Star } from 'lucide-react'
import { Avatar } from '@/components/ui'
import type { Review, UserProfile } from '@/types'

export interface ReviewCardProps {
  review: Review
  reviewer: UserProfile
}

export function ReviewCard({ review, reviewer }: ReviewCardProps) {
  return (
    <div className="border-b border-ink/20 py-5 first:border-t first:border-t-ink">
      <div className="flex items-center gap-3 mb-3">
        <Avatar
          name={reviewer.displayName}
          userId={reviewer.id}
          src={reviewer.avatarUrl}
          size="sm"
        />
        <div className="flex-1">
          <p className="text-[15px] font-medium text-ink">{reviewer.displayName}</p>
          <p className="text-label text-muted mt-0.5">
            {new Date(review.createdAt).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
        <div className="flex gap-0.5" aria-label={`${review.rating} out of 5`}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`h-3.5 w-3.5 ${
                star <= review.rating ? 'fill-gold text-gold' : 'text-ink/25'
              }`}
            />
          ))}
        </div>
      </div>
      {review.comment && (
        <p className="font-display text-[18px] leading-[1.45] text-ink">{review.comment}</p>
      )}
    </div>
  )
}
