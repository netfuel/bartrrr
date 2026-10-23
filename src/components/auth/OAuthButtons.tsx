import { useState } from 'react'
import { Button } from '@/components/ui'
import {
  friendlyAuthError,
  getEnabledProviders,
  signInWithProvider,
  type OAuthProviderConfig,
} from '@/lib/auth'

function ProviderIcon({ id }: { id: string }) {
  if (id === 'google') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
        <path fill="#4285F4" d="M23.5 12.27c0-.82-.07-1.6-.2-2.36H12v4.47h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.73Z" />
        <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3.01c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0 0 12 24Z" />
        <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.28V6.61H1.27a12 12 0 0 0 0 10.78l4-3.11Z" />
        <path fill="#EA4335" d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4 3.11C6.22 6.88 8.87 4.77 12 4.77Z" />
      </svg>
    )
  }
  if (id === 'apple') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M16.37 12.73c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.77-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.27-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.42-3.65l.05-.03ZM14.1 5.97c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.67-1.09 1.75-.95 2.79 1.01.08 2.04-.51 2.67-1.27Z" />
      </svg>
    )
  }
  return null
}

export interface OAuthButtonsProps {
  /** Where to send the user after sign-in (sanitized internally) */
  returnTo?: string | null
  onError?: (message: string) => void
  disabled?: boolean
}

/**
 * "Continue with Google / Apple" buttons, rendered from the provider config
 * in src/lib/auth/providers.ts.
 */
export function OAuthButtons({ returnTo, onError, disabled }: OAuthButtonsProps) {
  const providers = getEnabledProviders()
  const [pending, setPending] = useState<string | null>(null)

  if (providers.length === 0) return null

  const start = async (provider: OAuthProviderConfig) => {
    setPending(provider.id)
    try {
      await signInWithProvider(provider, returnTo)
      // The browser is now navigating to the provider; keep the spinner up.
    } catch (err) {
      console.error(`[Bartr] ${provider.label} sign-in failed`, err)
      onError?.(friendlyAuthError(err))
      setPending(null)
    }
  }

  return (
    <div className="space-y-3">
      {providers.map((provider) => (
        <Button
          key={provider.id}
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          loading={pending === provider.id}
          disabled={disabled || (pending !== null && pending !== provider.id)}
          onClick={() => start(provider)}
        >
          {pending !== provider.id && <ProviderIcon id={provider.id} />}
          Continue with {provider.label}
        </Button>
      ))}
    </div>
  )
}
