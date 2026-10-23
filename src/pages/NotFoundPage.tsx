import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'

/** Catch-all route. RouteEffects marks unknown paths noindex. */
export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <Link to="/" aria-label="Bartrrr home">
          <span className="text-[20px] font-medium lowercase tracking-tight text-ink">bartrrr</span>
        </Link>
        <p className="text-label text-muted mt-8">404</p>
        <h1 className="text-heading-page text-ink mt-2">This page wandered off</h1>
        <p className="text-base text-muted mt-3">
          The link may be old, or the listing may have been traded already.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link to="/browse">
            <Button variant="primary" size="lg" className="w-full">Browse listings</Button>
          </Link>
          <Link to="/">
            <Button variant="outline" size="lg" className="w-full">Go home</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
