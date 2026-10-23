import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Wordmark } from '@/components/ui'

export interface AuthShellProps {
  /** Photograph shown in the editorial panel (lg and up) */
  image: string
  /** Short serif statement set over the photograph */
  caption?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/**
 * Split-screen frame for sign-in flows: a warm editorial photograph on the
 * left (desktop), a calm single form column on the right. The column is a
 * plain vertical stack, so provider rows (Google / Apple), dividers and
 * forms can be dropped in without layout changes.
 */
export function AuthShell({ image, caption, children, className }: AuthShellProps) {
  return (
    <div className="min-h-[100svh] bg-cream lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Editorial panel */}
      <aside className="relative hidden overflow-hidden border-r border-ink bg-ink lg:block">
        <img
          src={image}
          alt=""
          decoding="async"
          className="photo-warm absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
        <Link to="/" aria-label="Bartrrr home" className="absolute left-8 top-7 rounded-sm">
          <Wordmark className="text-cream [&>em]:text-clay-mid" />
        </Link>
        {caption && (
          <p className="absolute inset-x-8 bottom-10 max-w-[18ch] font-display text-[clamp(2.25rem,3.4vw,3.25rem)] font-normal leading-[1.04] tracking-[-0.025em] text-cream">
            {caption}
          </p>
        )}
      </aside>

      {/* Form column */}
      <main className="flex min-h-[100svh] flex-col px-5 py-6 sm:px-10 lg:px-16">
        <Link to="/" aria-label="Bartrrr home" className="self-start rounded-sm lg:hidden">
          <Wordmark />
        </Link>
        <div className={cn('mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-12', className)}>
          {children}
        </div>
      </main>
    </div>
  )
}
