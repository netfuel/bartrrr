import { Link } from 'react-router-dom'
import { useNotificationsStore, useNotificationsForUser } from '@/stores'
import { useAuth } from '@/providers/AuthProvider'
import { Button } from '@/components/ui'

export interface NotificationDropdownProps {
  onClose: () => void
}

export function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const { currentUser } = useAuth()
  const notifications = useNotificationsForUser(currentUser?.id)
  const markAsRead = useNotificationsStore((s) => s.markAsRead)
  const markAllAsRead = useNotificationsStore((s) => s.markAllAsRead)

  if (!currentUser) return null

  // copy before sorting — the selector result is a cached array
  const userNotifications = [...notifications]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)

  const unreadCount = userNotifications.filter((n) => !n.readAt).length

  const getLink = (n: (typeof userNotifications)[0]) => {
    if (n.data?.offerId) return `/offers/${n.data.offerId}`
    if (n.data?.agreementId) return `/agreements/${n.data.agreementId}`
    return '/offers'
  }

  return (
    <div className="animate-scale-in origin-top-right absolute right-0 top-full mt-3 w-[min(22rem,calc(100vw-2rem))] bg-paper rounded-none border border-ink shadow-float z-50 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-ink">
        <p className="font-display text-[19px] text-ink">Notifications</p>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllAsRead(currentUser.id)}
            className="text-label text-clay-dark link-underline"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="max-h-[22rem] overflow-y-auto">
        {userNotifications.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="font-display text-[19px] text-ink">No notifications yet.</p>
            <p className="text-small text-muted mt-1.5">You'll see updates about your offers and trades here.</p>
          </div>
        ) : (
          userNotifications.map((notification) => (
            <Link
              key={notification.id}
              to={getLink(notification)}
              onClick={() => {
                if (!notification.readAt) markAsRead(notification.id)
                onClose()
              }}
              className="relative block px-5 py-3.5 border-b border-ink/15 last:border-b-0 hover:bg-sand-light/60 transition-colors"
            >
              {!notification.readAt && (
                <span aria-hidden="true" className="absolute left-2 top-[22px] h-1.5 w-1.5 rounded-full bg-clay" />
              )}
              <p className="text-[15px] font-medium text-ink">{notification.title}</p>
              <p className="text-small text-ink-2 mt-0.5 line-clamp-2">{notification.body}</p>
              <p className="text-label text-muted mt-1.5">
                {new Date(notification.createdAt).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            </Link>
          ))
        )}
      </div>

      {userNotifications.length > 0 && (
        <div className="px-3 py-2 border-t border-ink">
          <Button variant="ghost" size="sm" className="w-full text-label" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
    </div>
  )
}
