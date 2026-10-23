import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SocialProvider = 'google' | 'apple'

export interface SocialAuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Known providers get their brand mark; any other id renders text only */
  provider: SocialProvider | (string & {})
  loading?: boolean
}

/* Brand marks drawn per each provider's guidelines (monochrome Apple,
   full-color Google "G"); sized to the 20px icon grid. */
function ProviderMark({ provider }: { provider: string }) {
  if (provider === 'apple') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
        <path d="M16.37 12.77c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.24 2.73 2.2 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.47-.03-.01-2.3-.88-2.32-3.52ZM14.2 6.3c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.68-.92 2.67.97.08 1.96-.49 2.56-1.22Z" />
      </svg>
    )
  }
  if (provider !== 'google') return null
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  )
}

/**
 * Visual slot for third-party sign-in. Full-width, outline treatment so a
 * stack of providers reads as secondary to the primary form action.
 * Wiring lives with the caller: see components/auth/OAuthButtons.
 */
export const SocialAuthButton = forwardRef<HTMLButtonElement, SocialAuthButtonProps>(
  ({ provider, loading = false, disabled, className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'pressable relative flex min-h-[52px] w-full items-center justify-center gap-3 border border-ink/40 bg-paper px-5 text-[15px] font-medium text-ink',
        'transition-[border-color,background-color,transform] duration-300 ease-out-soft hover:border-ink hover:bg-cream',
        'disabled:pointer-events-none disabled:opacity-45',
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <ProviderMark provider={provider} />}
      {children}
    </button>
  ),
)

SocialAuthButton.displayName = 'SocialAuthButton'

/** Hairline "or" divider between provider buttons and the email form. */
export function AuthDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 text-label text-muted" role="separator" aria-label={typeof children === 'string' ? children : undefined}>
      <span className="h-px flex-1 bg-ink/25" />
      {children}
      <span className="h-px flex-1 bg-ink/25" />
    </div>
  )
}
