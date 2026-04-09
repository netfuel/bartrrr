import { cn } from '@/lib/utils'
import type { OfferMessage } from '@/types'

export interface OfferBubbleProps {
  message: OfferMessage
  isOwn: boolean
  isConfirmed?: boolean
  senderName: string
}

export function OfferBubble({
  message,
  isOwn,
  isConfirmed = false,
  senderName,
}: OfferBubbleProps) {
  const isAccept = message.type === 'accept'
  const showAsConfirmed = isConfirmed || isAccept

  return (
    <div className={cn('flex flex-col gap-1 max-w-[80%]', isOwn ? 'ml-auto items-end' : 'items-start')}>
      {/* Sender label */}
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted px-1">
        {isOwn ? 'You' : senderName}
        {message.type === 'counter' && ' · Counter'}
        {message.type === 'offer' && ' · Offer'}
      </p>

      {/* Bubble */}
      <div
        className={cn(
          'px-4 py-3 text-sm leading-relaxed',
          showAsConfirmed
            ? 'bg-teal-light border border-teal rounded-[18px_18px_18px_4px]'
            : isOwn
              ? 'bg-clay text-white rounded-[18px_18px_4px_18px]'
              : 'bg-cream border border-sand rounded-[18px_18px_18px_4px]',
        )}
      >
        {/* Items offered */}
        {message.items && message.items.length > 0 && (
          <div className="mb-2">
            {message.items.map((item, i) => (
              <span
                key={i}
                className={cn(
                  'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium mr-1.5 mb-1',
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
        <p>{message.content}</p>

        {/* Timestamp */}
        <p
          className={cn(
            'text-[10px] mt-1.5',
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
