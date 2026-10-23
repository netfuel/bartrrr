import { useState } from 'react'
import { SocialAuthButton } from '@/components/ui'
import {
  friendlyAuthError,
  getEnabledProviders,
  signInWithProvider,
  type OAuthProviderConfig,
} from '@/lib/auth'

export interface OAuthButtonsProps {
  /** Where to send the user after sign-in (sanitized internally) */
  returnTo?: string | null
  onError?: (message: string) => void
  disabled?: boolean
}

/**
 * "Continue with Google / Apple" buttons, rendered from the provider config
 * in src/lib/auth/providers.ts using the SocialAuthButton visual component.
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
      console.error(`[Bartrrr] ${provider.label} sign-in failed`, err)
      onError?.(friendlyAuthError(err))
      setPending(null)
    }
  }

  return (
    <div className="space-y-3">
      {providers.map((provider) => (
        <SocialAuthButton
          key={provider.id}
          provider={provider.id}
          loading={pending === provider.id}
          disabled={disabled || (pending !== null && pending !== provider.id)}
          onClick={() => start(provider)}
        >
          {pending === provider.id ? `Opening ${provider.label}…` : `Continue with ${provider.label}`}
        </SocialAuthButton>
      ))}
    </div>
  )
}
