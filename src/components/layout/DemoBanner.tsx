import { Link } from 'react-router-dom'
import { OFFLINE_DEMO } from '@/lib/env'
import { useAuth } from '@/providers/AuthProvider'

/**
 * Public demo only: says plainly that everything here is sample data, and
 * offers a way to look at the app as a different neighbor.
 */
export function DemoBanner() {
  const { currentUser } = useAuth()
  if (!OFFLINE_DEMO) return null
  const firstName = currentUser?.displayName.split(' ')[0]

  return (
    <div
      role="note"
      className="border-b border-ink bg-ink px-4 py-2 text-cream sm:px-6"
    >
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-x-6 gap-y-1 text-small">
        <p>
          <span className="font-medium">Demo:</span> sample neighbors and trades
          {firstName ? `, viewing as ${firstName}` : ''}. Nothing is real, and changes reset when you reload.
        </p>
        <div className="flex items-center gap-5">
          <Link to="/auth/login" className="underline decoration-cream/50 underline-offset-4 hover:decoration-cream">
            Switch neighbor
          </Link>
          <a href="https://bartrrr.app" className="underline decoration-cream/50 underline-offset-4 hover:decoration-cream">
            Go to bartrrr.app
          </a>
        </div>
      </div>
    </div>
  )
}
