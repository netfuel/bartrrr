import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { RELOAD_FLAG, failedModuleUrl, isNetworkReachable, isStaleChunkError, lazyWithRetry } from './chunk-reload'
import { ErrorBoundary } from './ErrorBoundary'

/** T-72: a page that fails to load offline says so, and loads once the connection is back. */
describe('chunk loading', () => {
  let online = true
  beforeEach(() => {
    online = true
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('recognizes failed page chunks in every browser', () => {
    expect(isStaleChunkError(new TypeError('Failed to fetch dynamically imported module: https://x.test/a.js'))).toBe(true)
    expect(isStaleChunkError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isStaleChunkError(new TypeError('error loading dynamically imported module'))).toBe(true)
    expect(isStaleChunkError(new Error('Unable to preload CSS for /assets/a.css'))).toBe(true)
    expect(isStaleChunkError(new Error("Cannot read properties of undefined (reading 'id')"))).toBe(false)
  })

  it('reads the module that failed from the error', () => {
    expect(
      failedModuleUrl(new TypeError('Failed to fetch dynamically imported module: https://bartrrr.app/assets/SettingsPage-a1b2.js')),
    ).toBe('https://bartrrr.app/assets/SettingsPage-a1b2.js')
    expect(failedModuleUrl(new TypeError('Failed to fetch dynamically imported module: http://localhost:5180/src/pages/X.tsx?retry=1'))).toBe(
      'http://localhost:5180/src/pages/X.tsx',
    )
    expect(failedModuleUrl(new TypeError('Importing a module script failed.'))).toBeNull()
  })

  it('treats a failed check as no network, and offline as no network without asking', async () => {
    const ok = vi.fn(async () => new Response(null))
    const down = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(await isNetworkReachable(ok as unknown as typeof fetch)).toBe(true)
    expect(await isNetworkReachable(down as unknown as typeof fetch)).toBe(false)
    online = false
    expect(await isNetworkReachable(ok as unknown as typeof fetch)).toBe(false)
    expect(ok).toHaveBeenCalledTimes(1)
  })

  it('offline: shows the offline screen without downloading, then loads the page when back online', async () => {
    const factory = vi.fn(async () => ({ default: () => <h1>Settings</h1> }))
    const Page = lazyWithRetry(factory)
    online = false
    render(
      <ErrorBoundary resetKey="/settings">
        <Suspense fallback={<p>Loading</p>}>
          <Page />
        </Suspense>
      </ErrorBoundary>,
    )
    expect(await screen.findByRole('heading', { level: 1, name: /offline/ })).toBeInTheDocument()
    expect(screen.getByText(/Reconnect and try again/)).toBeInTheDocument()
    // Nothing was requested, so nothing is remembered as failed
    expect(factory).not.toHaveBeenCalled()

    // Try again while still offline: same screen
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { level: 1, name: /offline/ })).toBeInTheDocument()

    // Back online: the page loads by itself
    online = true
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
    expect(factory).toHaveBeenCalledTimes(1)
    // Never treated as a new build
    expect(sessionStorage.getItem(RELOAD_FLAG)).toBeNull()
  })

  it('a failed download while the browser says online: checks the network, then the offline screen (no reload)', async () => {
    const factory = vi.fn(async () => {
      throw new TypeError('Failed to fetch dynamically imported module: http://localhost/missing-module.js')
    })
    const Page = lazyWithRetry(factory)
    // The network check fails too: the connection is down, not the build
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    render(
      <ErrorBoundary>
        <Suspense fallback={<p>Loading</p>}>
          <Page />
        </Suspense>
      </ErrorBoundary>,
    )
    expect(await screen.findByRole('heading', { level: 1, name: /offline/ })).toBeInTheDocument()
    expect(factory).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(RELOAD_FLAG)).toBeNull()
  })
})
