import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bell, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toggleDarkMode, isDarkMode } from '@/lib/utils/dark-mode'
import { useNotificationsStore } from '@/stores'
import { useAuth } from '@/providers/AuthProvider'
import { NotificationDropdown } from './NotificationDropdown'

export interface HeaderProps {
  className?: string
}

export function Header({ className }: HeaderProps) {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const getUnreadCount = useNotificationsStore((s) => s.getUnreadCount)
  const [searchQuery, setSearchQuery] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  const [dark, setDark] = useState(isDarkMode)
  const notifRef = useRef<HTMLDivElement>(null)

  const handleToggle = () => {
    const next = toggleDarkMode()
    setDark(next)
  }

  const unreadCount = currentUser ? getUnreadCount(currentUser.id) : 0

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
        'sticky top-0 z-30 flex items-center gap-4 px-4 lg:px-6 py-3 bg-white/90 backdrop-blur-md border-b border-sand-light',
        className,
      )}
    >
      {/* Mobile logo */}
      <span className="lg:hidden font-display text-xl font-bold text-clay">
        Bartrrr
      </span>

      {/* Search */}
      <div className="flex-1 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearch}
          placeholder="Search listings, neighborhoods..."
          className="w-full rounded-full border border-sand bg-cream pl-9 pr-4 py-2.5 text-[15px] placeholder:text-muted hover:border-clay-mid focus:outline-none focus:ring-2 focus:ring-clay focus:border-clay transition-colors"
        />
      </div>

      {/* Dark mode toggle */}
      <button
        onClick={handleToggle}
        className="pressable flex h-11 w-11 items-center justify-center rounded-full hover:bg-sand-light transition-colors text-muted hover:text-ink"
        aria-label="Toggle dark mode"
      >
        {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      {/* Notifications */}
      <div ref={notifRef} className="relative">
        <button
          type="button"
          className="pressable relative flex h-11 w-11 items-center justify-center rounded-full hover:bg-sand-light transition-colors"
          aria-label="Notifications"
          onClick={() => setShowNotifications(!showNotifications)}
        >
          <Bell className="h-5 w-5 text-ink-2" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-clay text-white text-[10px] font-bold px-1">
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
