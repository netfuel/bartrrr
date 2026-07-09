import { NavLink } from 'react-router-dom'
import { Map, Plus, MessageSquare, User, Rss } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/browse', label: 'Discover', icon: Map },
  { to: '/feed', label: 'Feed', icon: Rss },
  { to: '/listing/new', label: 'Post', icon: Plus, isPrimary: true },
  { to: '/offers', label: 'Offers', icon: MessageSquare },
  { to: '/profile/me', label: 'Profile', icon: User },
]

export function BottomBar() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-sand-light z-40 safe-area-pb">
      <div className="flex items-center justify-around px-2 py-1">
        {navItems.map(({ to, label, icon: Icon, isPrimary }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'pressable group flex flex-col items-center gap-0.5 min-w-[56px] min-h-[48px] justify-center rounded-lg',
                isPrimary
                  ? ''
                  : isActive
                    ? 'text-clay'
                    : 'text-muted',
              )
            }
          >
            {({ isActive }) =>
              isPrimary ? (
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-clay text-white -mt-4 shadow-lift transition-transform duration-200 ease-spring group-active:scale-95">
                  <Icon className="h-6 w-6" />
                </div>
              ) : (
                <>
                  <span
                    className={cn(
                      'flex items-center justify-center rounded-full px-3 py-0.5 transition-[background-color,transform] duration-200 ease-spring',
                      isActive && 'bg-clay-light scale-105',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className={cn('text-[11px]', isActive ? 'font-semibold' : 'font-medium')}>
                    {label}
                  </span>
                </>
              )
            }
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
