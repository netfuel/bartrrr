import { useState } from 'react'
import { Star } from 'lucide-react'
import { Button, Textarea } from '@/components/ui'
import { cn } from '@/lib/utils'

export interface ReviewFormProps {
  revieweeName: string
  onSubmit: (rating: number, comment: string) => void
}

export function ReviewForm({ revieweeName, onSubmit }: ReviewFormProps) {
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return (
      <div className="bg-teal-light rounded-lg p-4 text-center">
        <p className="text-sm font-medium text-teal-dark">Thanks for your review!</p>
      </div>
    )
  }

  const handleSubmit = () => {
    if (rating === 0) return
    onSubmit(rating, comment)
    setSubmitted(true)
  }

  return (
    <div className="bg-white rounded-lg border border-sand-light p-4 space-y-3">
      <p className="text-sm font-medium text-ink">
        How was your trade with {revieweeName}?
      </p>

      {/* Star rating */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoveredRating(star)}
            onMouseLeave={() => setHoveredRating(0)}
            className="p-0.5"
          >
            <Star
              className={cn(
                'h-6 w-6 transition-colors',
                star <= (hoveredRating || rating)
                  ? 'fill-gold text-gold'
                  : 'text-sand',
              )}
            />
          </button>
        ))}
      </div>

      <Textarea
        placeholder="Leave a comment (optional)..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
      />

      <Button variant="primary" size="sm" onClick={handleSubmit} disabled={rating === 0}>
        Submit review
      </Button>
    </div>
  )
}
