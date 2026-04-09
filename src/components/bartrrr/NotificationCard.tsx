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
        'flex gap-3 p-4 rounded-lg bg-white border transition-colors',
        notification.readAt ? 'border-sand-light' : 'border-clay-mid bg-clay-light/30',
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
        <p className="text-sm font-medium text-ink">{notification.title}</p>
        <p className="text-xs text-muted mt-0.5 line-clamp-2">
          {notification.body}
        </p>
        <p className="text-[10px] text-muted mt-1">
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
            View
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
