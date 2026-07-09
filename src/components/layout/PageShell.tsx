import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomBar } from './BottomBar'
import { Header } from './Header'

export function PageShell() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-cream">
      <Sidebar />
      <div className="lg:ml-60">
        <Header />
        {/* key on pathname replays the entrance animation on every route change */}
        <main key={location.pathname} className="animate-fade-up pb-24 lg:pb-0">
          <Outlet />
        </main>
      </div>
      <BottomBar />
    </div>
  )
}
