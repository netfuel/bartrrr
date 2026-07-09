import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BackLinkProps {
  to: string
  children: React.ReactNode
  className?: string
}

/** Consistent back-navigation link with a comfortable touch target. */
export function BackLink({ to, children, className }: BackLinkProps) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex min-h-[44px] items-center gap-1.5 text-base text-muted hover:text-ink transition-colors',
        className,
      )}
    >
      <ArrowLeft className="h-5 w-5" />
      {children}
    </Link>
  )
}
