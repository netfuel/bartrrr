import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomBar } from './BottomBar'
import { Header } from './Header'

export function PageShell() {
  return (
    <div className="min-h-screen bg-cream">
      <Sidebar />
      <div className="lg:ml-60">
        <Header />
        <main className="pb-20 lg:pb-0">
          <Outlet />
        </main>
      </div>
      <BottomBar />
    </div>
  )
}
