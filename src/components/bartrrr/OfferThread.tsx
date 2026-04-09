import { cn } from '@/lib/utils'
import { OfferBubble } from './OfferBubble'
import { OfferTimeline } from './OfferTimeline'
import type { Offer, UserProfile } from '@/types'

export interface OfferThreadProps {
  offer: Offer
  currentUserId: string
  fromUser: UserProfile
  toUser: UserProfile
  className?: string
}

export function OfferThread({
  offer,
  currentUserId,
  fromUser,
  toUser,
  className,
}: OfferThreadProps) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Timeline */}
      <div className="bg-white rounded-lg p-4">
        <OfferTimeline offer={offer} />
        <p className="text-xs text-muted mt-2">
          Round {offer.round} of {offer.maxRounds}
        </p>
      </div>

      {/* Messages */}
      <div className="flex flex-col gap-4 px-2">
        {offer.messages.map((message) => {
          const isOwn = message.fromUserId === currentUserId
          const sender =
            message.fromUserId === fromUser.id ? fromUser : toUser
          return (
            <OfferBubble
              key={message.id}
              message={message}
              isOwn={isOwn}
              isConfirmed={offer.status === 'accepted'}
              senderName={sender.displayName}
            />
          )
        })}
      </div>
    </div>
  )
}
