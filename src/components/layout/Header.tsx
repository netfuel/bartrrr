import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUnreadCount } from '@/stores'
import { useAuth } from '@/providers/AuthProvider'
import { NotificationDropdown } from './NotificationDropdown'
import { Wordmark } from '@/components/ui'

export interface HeaderProps {
  className?: string
}

export function Header({ className }: HeaderProps) {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const unreadCount = useUnreadCount(currentUser?.id)

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/browse?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    if (showNotifications) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showNotifications])

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-16 items-center gap-3 sm:gap-4 px-4 lg:px-6 bg-cream/90 backdrop-blur-md border-b border-ink',
        className,
      )}
    >
      {/* Mobile logo */}
      <Link to="/dashboard" aria-label="Bartrrr home" className="lg:hidden shrink-0 rounded-sm">
        <Wordmark className="text-[22px]" />
      </Link>

      {/* Search */}
      <div className="flex-1 max-w-md relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <input
          type="search"
          aria-label="Search listings"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearch}
          placeholder="Search listings or neighborhoods"
          className="w-full min-w-0 rounded-full border border-ink/30 bg-paper pl-10 pr-4 py-2.5 text-[15px] placeholder:text-muted hover:border-ink focus:outline-none focus:border-clay focus:ring-1 focus:ring-clay transition-colors"
        />
      </div>

      {/* Notifications */}
      <div ref={notifRef} className="relative ml-auto">
        <button
          type="button"
          className="pressable relative flex h-11 w-11 items-center justify-center rounded-full hover:bg-sand-light transition-colors"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          aria-expanded={showNotifications}
          onClick={() => setShowNotifications(!showNotifications)}
        >
          <Bell className="h-5 w-5 text-ink" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[17px] h-[17px] flex items-center justify-center rounded-full bg-clay text-cream text-[10px] font-semibold tabular-nums px-1 ring-2 ring-cream">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        {showNotifications && (
          <NotificationDropdown onClose={() => setShowNotifications(false)} />
        )}
      </div>
    </header>
  )
}
