import { cn } from '@/lib/utils'
import { Avatar, Button } from '@/components/ui'
import type { AppNotification, UserProfile } from '@/types'

export interface NotificationCardProps {
  notification: AppNotification
  sender?: UserProfile
  onView?: () => void
  onMessage?: () => void
  className?: string
}

export function NotificationCard({
  notification,
  sender,
  onView,
  onMessage,
  className,
}: NotificationCardProps) {
  return (
    <div
      className={cn(
        'flex gap-3 p-4 rounded-none border transition-colors',
        notification.readAt ? 'border-ink/20 bg-cream' : 'border-ink bg-paper',
        className,
      )}
    >
      {sender && (
        <Avatar
          src={sender.avatarUrl}
          name={sender.displayName}
          userId={sender.id}
          size="md"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium text-ink">{notification.title}</p>
        <p className="text-small text-ink-2 mt-0.5 line-clamp-2">
          {notification.body}
        </p>
        <p className="text-label text-muted mt-1.5">
          {new Date(notification.createdAt).toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>
      </div>
      <div className="flex flex-col gap-1.5 shrink-0">
        {onView && (
          <Button variant="outline" size="sm" onClick={onView}>
            View offer
          </Button>
        )}
        {onMessage && (
          <Button variant="ghost" size="sm" onClick={onMessage}>
            Message
          </Button>
        )}
      </div>
    </div>
  )
}
