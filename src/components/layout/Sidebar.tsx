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
    <aside className="hidden lg:flex flex-col w-60 h-screen fixed left-0 top-0 bg-cream border-r border-ink z-40">
      {/* Logo */}
      <div className="px-6 py-6">
        <NavLink to="/" className="flex items-center gap-2">
          <span className="text-[20px] font-medium lowercase tracking-tight text-ink">
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
                'pressable flex items-center gap-3 px-3 py-2.5 rounded-md text-[15px] font-medium transition-[background-color,color] duration-200',
                isActive
                  ? 'bg-ink text-cream font-medium'
                  : 'text-ink-2 hover:bg-sand-light hover:translate-x-0.5',
              )
            }
          >
            <Icon className="h-5 w-5" />
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
