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
    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg border border-sand-light shadow-lg z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-sand-light">
        <p className="text-sm font-semibold text-ink">Notifications</p>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllAsRead(currentUser.id)}
            className="text-xs text-clay hover:text-clay-dark font-medium"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto">
        {userNotifications.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-muted">No notifications yet.</p>
            <p className="text-xs text-muted mt-1">You'll see updates about your offers and trades here.</p>
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
              className={`block px-4 py-3 border-b border-sand-light/50 hover:bg-sand-light/30 transition-colors ${
                !notification.readAt ? 'bg-clay-light/20' : ''
              }`}
            >
              <p className="text-sm font-medium text-ink">{notification.title}</p>
              <p className="text-xs text-muted mt-0.5 line-clamp-2">{notification.body}</p>
              <p className="text-[10px] text-muted mt-1">
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
        <div className="px-4 py-2 border-t border-sand-light">
          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
    </div>
  )
}
