import { memo } from 'react'
import { cn } from '@/lib/utils'
import { DECLINE_REASON_LABELS, type OfferDeclineReason, type OfferMessage } from '@/types'

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
  // Declines store the reason key when no note was written; show the human label
  const content =
    message.type === 'decline' && message.content in DECLINE_REASON_LABELS
      ? `Declined: ${DECLINE_REASON_LABELS[message.content as OfferDeclineReason]}`
      : message.content
  const typeLabel: Partial<Record<OfferMessage['type'], string>> = {
    offer: 'Offer',
    counter: 'Counter-offer',
    accept: 'Accepted',
    decline: 'Declined',
  }

  return (
    <div className={cn('animate-fade-up flex flex-col gap-1 max-w-[80%]', isOwn ? 'ml-auto items-end' : 'items-start')}>
      {/* Sender label */}
      <p className="text-label text-muted px-1">
        {isOwn ? 'You' : senderName}
        {typeLabel[message.type] && ` · ${typeLabel[message.type]}`}
      </p>

      {/* Bubble */}
      <div
        className={cn(
          'px-4 py-3 text-[15px] leading-relaxed ',
          showAsConfirmed
            ? 'bg-teal-light border border-teal-dark rounded-none'
            : isOwn
              ? 'bg-ink text-cream rounded-none'
              : 'bg-cream border border-ink rounded-none',
        )}
      >
        {/* Items offered */}
        {message.items && message.items.length > 0 && (
          <div className="mb-2">
            {message.items.map((item, i) => (
              <span
                key={i}
                className={cn(
                  'inline-block rounded-full px-2.5 py-0.5 text-small font-medium mr-1.5 mb-1',
                  showAsConfirmed
                    ? 'bg-teal/10 text-teal-dark'
                    : isOwn
                      ? 'bg-white/20 text-white'
                      : 'bg-sand-light text-ink-2',
                )}
              >
                {item}
              </span>
            ))}
          </div>
        )}

        {/* Message content */}
        <p>{content}</p>

        {/* Timestamp */}
        <p
          className={cn(
            'text-[11px] mt-1.5',
            showAsConfirmed
              ? 'text-teal-dark/60'
              : isOwn
                ? 'text-white/60'
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
