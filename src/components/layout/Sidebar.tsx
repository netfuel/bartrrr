import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Map, MessageSquare, FileCheck, User, Settings, Rss } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, Wordmark } from '@/components/ui'
import { useAuth } from '@/providers/AuthProvider'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/browse', label: 'Browse', icon: Map },
  { to: '/feed', label: 'Feed', icon: Rss },
  { to: '/offers', label: 'My Offers', icon: MessageSquare },
  { to: '/agreements', label: 'Agreements', icon: FileCheck },
  { to: '/profile/me', label: 'Profile', icon: User },
]

export function Sidebar() {
  const { currentUser } = useAuth()

  return (
    <aside className="hidden lg:flex flex-col w-60 h-screen fixed left-0 top-0 bg-cream border-r border-ink z-40">
      {/* Logo — aligned to the header's 64px band */}
      <div className="flex h-16 shrink-0 items-center border-b border-ink px-6">
        <NavLink to="/" aria-label="Bartrrr home" className="rounded-sm">
          <Wordmark />
        </NavLink>
      </div>
      <p className="eyebrow px-6 pt-7 pb-3">Trade, don't buy.</p>

      {/* Nav items */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'pressable group relative flex min-h-[44px] items-center gap-3 px-3 text-[15px] font-medium transition-[background-color,color] duration-300 ease-out-soft',
                isActive
                  ? 'bg-ink text-cream'
                  : 'text-ink-2 hover:bg-sand-light hover:text-ink',
              )
            }
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t border-ink">
        <div className="flex items-center gap-3 px-3">
          <Avatar
            name={currentUser?.displayName || 'User'}
            userId={currentUser?.id || ''}
            src={currentUser?.avatarUrl}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink truncate">
              {currentUser?.displayName || 'User'}
            </p>
            <p className="text-small truncate text-muted">{currentUser?.neighborhood || ''}</p>
          </div>
          <NavLink
            to="/settings"
            aria-label="Settings"
            className={({ isActive }) =>
              cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
                isActive ? 'bg-ink text-cream' : 'text-muted hover:bg-sand-light hover:text-ink',
              )
            }
          >
            <Settings className="h-4 w-4" />
          </NavLink>
        </div>
      </div>
    </aside>
  )
}
