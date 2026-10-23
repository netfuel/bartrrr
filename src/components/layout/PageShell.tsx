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
        {/* key on pathname replays the entrance animation on every route change.
            Opacity only: a filling transform animation would turn <main> into
            the containing block for position:fixed children (sticky CTAs). */}
        <main id="main" key={location.pathname} className="animate-fade-in pb-28 lg:pb-0">
          <Outlet />
        </main>
      </div>
      <BottomBar />
    </div>
  )
}
