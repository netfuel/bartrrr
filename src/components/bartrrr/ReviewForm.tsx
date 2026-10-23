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
      <div className="animate-scale-in border border-teal bg-teal-light rounded-none p-5 text-center">
        <p className="font-display text-[19px] text-teal-dark">Thanks! Your review is posted.</p>
      </div>
    )
  }

  const handleSubmit = () => {
    if (rating === 0) return
    onSubmit(rating, comment)
    setSubmitted(true)
  }

  return (
    <div className="border border-ink bg-paper p-5 space-y-4">
      <p id="review-heading" className="font-display text-[20px] text-ink">
        How was your trade with {revieweeName}?
      </p>

      {/* Star rating */}
      <div role="radiogroup" aria-labelledby="review-heading" className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoveredRating(star)}
            onMouseLeave={() => setHoveredRating(0)}
            role="radio"
            aria-checked={rating === star}
            aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
            className="pressable flex h-11 w-11 items-center justify-center rounded-full hover:bg-sand-light"
          >
            <Star
              className={cn(
                'h-7 w-7 transition-[color,fill,transform] duration-300 ease-spring',
                star <= (hoveredRating || rating)
                  ? 'fill-gold text-gold scale-105'
                  : 'text-ink/30',
              )}
            />
          </button>
        ))}
      </div>

      <Textarea
        label="Comment (optional)"
        placeholder="What should other neighbors know?"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
      />

      {rating === 0 && <p className="text-small text-muted">Tap a star to rate the trade.</p>}
      <Button variant="primary" size="sm" onClick={handleSubmit} disabled={rating === 0}>
        Post review
      </Button>
    </div>
  )
}
