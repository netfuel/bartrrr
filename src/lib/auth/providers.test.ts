import { afterEach, describe, expect, it, vi } from 'vitest'
import { getEnabledProviders, OAUTH_PROVIDERS } from './providers'

describe('getEnabledProviders', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('returns all providers when unset', () => {
    vi.stubEnv('VITE_AUTH_PROVIDERS', '')
    expect(getEnabledProviders()).toEqual(OAUTH_PROVIDERS)
  })
  it('narrows to the listed providers, ignoring case, spaces and unknown names', () => {
    vi.stubEnv('VITE_AUTH_PROVIDERS', ' Google , github,')
    expect(getEnabledProviders().map((p) => p.id)).toEqual(['google'])
  })
  it('keeps the configured order', () => {
    vi.stubEnv('VITE_AUTH_PROVIDERS', 'apple,google')
    expect(getEnabledProviders().map((p) => p.id)).toEqual(['google', 'apple'])
  })
})
