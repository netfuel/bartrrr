import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/** Centered card layout shared by the auth screens (mirrors LoginPage). */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" aria-label="Bartrrr home">
            <span className="text-[20px] font-medium lowercase tracking-tight text-ink">bartrrr</span>
          </Link>
          <h1 className="text-heading-page text-ink mt-4">{title}</h1>
          {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
        </div>
        <div className="border border-ink bg-cream p-6">{children}</div>
        {footer && <div className="text-center text-base text-muted mt-4">{footer}</div>}
      </div>
    </div>
  )
}
