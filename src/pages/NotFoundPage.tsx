import { Link } from 'react-router-dom'
import { Wordmark, buttonStyles } from '@/components/ui'
import { usePageTitle } from '@/lib/utils'

/** Catch-all route. RouteEffects marks unknown paths noindex. */
export default function NotFoundPage() {
  usePageTitle('Page not found')
  return (
    <div className="min-h-[100svh] bg-cream flex flex-col px-5 py-6">
      <Link to="/" aria-label="Bartrrr home" className="self-start rounded-sm">
        <Wordmark />
      </Link>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-12 animate-fade-up">
        <p className="text-label text-muted">Page not found</p>
        <h1 className="text-display !text-[clamp(2.75rem,8vw,4.5rem)] text-ink mt-4">
          This page <em>wandered off.</em>
        </h1>
        <p className="text-base text-ink-2 mt-6 max-w-md leading-relaxed">
          The link may be old, or the listing may have been traded already. Have a look at what neighbors are offering now.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link to="/browse" className={buttonStyles({ variant: 'primary', size: 'lg' })}>
            Browse listings
          </Link>
          <Link to="/" className={buttonStyles({ variant: 'outline', size: 'lg' })}>
            Go to the home page
          </Link>
        </div>
      </main>
    </div>
  )
}
