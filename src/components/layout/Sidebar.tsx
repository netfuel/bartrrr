import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Map, MessageSquare, FileCheck, User, Settings, Rss } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui'
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
    <aside className="hidden lg:flex flex-col w-60 h-screen fixed left-0 top-0 bg-white border-r border-sand-light z-40">
      {/* Logo */}
      <div className="px-6 py-6">
        <NavLink to="/" className="flex items-center gap-2">
          <span className="font-display text-2xl font-bold text-clay">
            Bartrrr
          </span>
        </NavLink>
        <p className="text-xs text-muted mt-0.5">Trade, don't buy.</p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-clay-light text-clay'
                  : 'text-ink-2 hover:bg-sand-light',
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t border-sand-light">
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
            <p className="text-xs text-muted">{currentUser?.neighborhood || ''}</p>
          </div>
          <NavLink to="/settings" className="text-muted hover:text-ink transition-colors">
            <Settings className="h-4 w-4" />
          </NavLink>
        </div>
      </div>
    </aside>
  )
}
