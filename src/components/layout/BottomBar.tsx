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
    <nav aria-label="Primary" className="lg:hidden fixed bottom-0 left-0 right-0 bg-cream/90 backdrop-blur-md border-t border-ink z-40 safe-area-pb">
      <div className="mx-auto flex max-w-md items-center justify-around px-2 pt-1.5 pb-1">
        {navItems.map(({ to, label, icon: Icon, isPrimary }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'pressable group flex flex-col items-center gap-1 min-w-[60px] min-h-[52px] justify-center rounded-none',
                isPrimary
                  ? ''
                  : isActive
                    ? 'text-ink'
                    : 'text-muted',
              )
            }
          >
            {({ isActive }) =>
              isPrimary ? (
                <span className="flex items-center justify-center w-[52px] h-[52px] rounded-full bg-ink text-cream -mt-6 ring-4 ring-cream transition-[transform,background-color] duration-300 ease-spring group-hover:bg-clay-dark group-active:scale-95">
                  <Icon className="h-6 w-6" strokeWidth={1.75} />
                  <span className="sr-only">{label}</span>
                </span>
              ) : (
                <>
                  <span
                    className={cn(
                      'flex items-center justify-center rounded-full px-4 py-1 transition-[background-color,color] duration-300 ease-out-soft',
                      isActive ? 'bg-ink text-cream' : 'group-hover:bg-sand-light',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className={cn('text-[11px] font-medium tracking-[0.02em]', isActive ? 'text-ink' : 'text-muted')}>
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
