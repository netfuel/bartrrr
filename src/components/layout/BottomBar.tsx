import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Map, Plus, MessageSquare, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/browse', label: 'Discover', icon: Map },
  { to: '/offers', label: 'Offers', icon: MessageSquare },
  { to: '/listing/new', label: 'Post', icon: Plus, isPrimary: true },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/profile/me', label: 'Profile', icon: User },
]

export function BottomBar() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-sand-light z-40 safe-area-pb">
      <div className="flex items-center justify-around px-2 py-1">
        {navItems.map(({ to, label, icon: Icon, isPrimary }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 min-w-[44px] min-h-[44px] justify-center',
                isPrimary
                  ? ''
                  : isActive
                    ? 'text-clay'
                    : 'text-muted',
              )
            }
          >
            {isPrimary ? (
              <div className="flex items-center justify-center w-11 h-11 rounded-full bg-clay text-white -mt-3 shadow-md">
                <Icon className="h-5 w-5" />
              </div>
            ) : (
              <>
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
