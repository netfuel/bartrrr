import { memo } from 'react'
import { cn } from '@/lib/utils'
import type { OfferMessage } from '@/types'

export interface OfferBubbleProps {
  message: OfferMessage
  isOwn: boolean
  isConfirmed?: boolean
  senderName: string
}

function OfferBubbleInner({
  message,
  isOwn,
  isConfirmed = false,
  senderName,
}: OfferBubbleProps) {
  const isAccept = message.type === 'accept'
  const showAsConfirmed = isConfirmed || isAccept

  return (
    <div className={cn('animate-fade-up flex flex-col gap-1.5 max-w-[86%] sm:max-w-[72%]', isOwn ? 'ml-auto items-end' : 'items-start')}>
      {/* Sender label */}
      <p className="text-label text-muted">
        {isOwn ? 'You' : senderName}
        {message.type === 'counter' && ' · Counter'}
        {message.type === 'offer' && ' · Offer'}
      </p>

      {/* Bubble */}
      <div
        className={cn(
          'px-4 py-3.5 text-[16px] leading-[1.5]',
          showAsConfirmed
            ? 'bg-teal-light border border-teal text-ink rounded-[2px_14px_14px_14px]'
            : isOwn
              ? 'bg-ink text-cream rounded-[14px_2px_14px_14px]'
              : 'bg-paper border border-ink text-ink rounded-[2px_14px_14px_14px]',
        )}
      >
        {/* Items offered */}
        {message.items && message.items.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {message.items.map((item, i) => (
              <span
                key={i}
                className={cn(
                  'inline-flex items-center rounded-full border px-3 py-1 font-display text-[15px] leading-tight',
                  showAsConfirmed
                    ? 'border-teal/40 text-teal-dark'
                    : isOwn
                      ? 'border-cream/30 text-cream'
                      : 'border-ink/25 bg-cream text-ink',
                )}
              >
                {item}
              </span>
            ))}
          </div>
        )}

        {/* Message content */}
        <p>{message.content}</p>

        {/* Timestamp */}
        <p
          className={cn(
            'text-label mt-2',
            showAsConfirmed
              ? 'text-teal-dark'
              : isOwn
                ? 'text-cream/70'
                : 'text-muted',
          )}
        >
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  )
}

export const OfferBubble = memo(OfferBubbleInner)
