import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Map, Plus, MessageSquare, FileCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Phone navigation: five slots, the trade loop first.
 *
 * Dashboard, Offers and Agreements are one tap because checking on trades
 * and answering offers are what neighbors come back for. Feed lives under
 * Browse (a view switch on the Browse page, and Browse stays lit on /feed).
 * Profile, Settings and Log out sit behind the avatar in the header, the
 * phone version of the sidebar's account corner: two taps at most.
 */
const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/browse', label: 'Browse', icon: Map, alsoActive: ['/feed'] },
  { to: '/listing/new', label: 'Post a listing', icon: Plus, isPrimary: true },
  { to: '/offers', label: 'Offers', icon: MessageSquare },
  { to: '/agreements', label: 'Agreements', icon: FileCheck },
]

export function BottomBar() {
  const { pathname } = useLocation()

  return (
    <nav aria-label="Main navigation" className="lg:hidden fixed bottom-0 left-0 right-0 bg-cream/90 backdrop-blur-md border-t border-ink z-40 safe-area-pb">
      <div className="mx-auto flex max-w-md items-center justify-around px-1 pt-1.5 pb-1">
        {navItems.map(({ to, label, icon: Icon, isPrimary, alsoActive }) => (
          <NavLink
            key={to}
            to={to}
            aria-label={isPrimary ? label : undefined}
            className={({ isActive }) =>
              cn(
                'pressable group flex flex-1 flex-col items-center gap-1 min-w-[44px] min-h-[52px] justify-center rounded-none',
                isPrimary
                  ? ''
                  : isActive || alsoActive?.some((p) => pathname.startsWith(p))
                    ? 'text-ink'
                    : 'text-muted',
              )
            }
          >
            {({ isActive: routeActive }) => {
              const isActive = routeActive || Boolean(alsoActive?.some((p) => pathname.startsWith(p)))
              return isPrimary ? (
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
                  <span className={cn('text-[11px] font-medium tracking-[0.01em] whitespace-nowrap', isActive ? 'text-ink' : 'text-muted')}>
                    {label}
                  </span>
                </>
              )
            }}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
