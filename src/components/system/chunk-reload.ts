import { createElement, lazy, type ComponentProps, type ComponentType, type LazyExoticComponent } from 'react'

export const RELOAD_FLAG = 'bartrrr:chunk-reload'

/**
 * A lazy page chunk failed to load. Either a deploy replaced the hashed
 * chunks this tab was about to load (version skew), or the network is down.
 */
export function isStaleChunkError(error: Error): boolean {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|ChunkLoadError/i.test(
    error.message,
  )
}

/** The browser says there's no connection. */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/**
 * Tells version skew from a dropped connection when the browser still
 * claims to be online: if the app's own page can't be fetched either, the
 * network is the problem, and reloading would only show the browser's
 * offline error page.
 */
export async function isNetworkReachable(fetcher: typeof fetch = fetch): Promise<boolean> {
  if (isOffline()) return false
  try {
    await fetcher(`/?network-check=${Date.now()}`, { method: 'HEAD', cache: 'no-store' })
    return true
  } catch {
    return false
  }
}

/** Reload once to pick up the new build. Returns false if already tried. */
export function reloadOnceForNewBuild(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) return false
    sessionStorage.setItem(RELOAD_FLAG, '1')
  } catch {
    return false
  }
  window.location.reload()
  return true
}

/** Clear the one-shot reload guard once a page renders successfully. */
export function clearChunkReloadFlag(): void {
  try {
    sessionStorage.removeItem(RELOAD_FLAG)
  } catch {
    /* ignore */
  }
}

/** The module URL named in a failed dynamic import's error, if any. */
export function failedModuleUrl(error: unknown): string | null {
  const m = error instanceof Error ? /(https?:\/\/\S+?\.(?:m?js|tsx?|jsx))(?:\?\S*)?\b/.exec(error.message) : null
  return m ? m[1] : null
}

let retryGeneration = 0

/**
 * Let pages whose code failed to load try again on their next render. The
 * error screen calls this before rendering the page again.
 */
export function retryFailedChunks(): void {
  retryGeneration += 1
}

/**
 * React.lazy remembers a failed import forever, and so does the browser: a
 * module that failed to download is never fetched again in that tab. So a
 * page that failed to load offline would stay broken after reconnecting.
 *
 * This lazy loader:
 * - doesn't ask the browser for the code while it's offline with no
 *   service worker to serve it, so nothing gets remembered as failed
 * - after a failure, starts a fresh import once retryFailedChunks() is
 *   called (the error screen's Try again, the connection coming back, or
 *   moving to another page), with a cache-busting query on the module that
 *   failed before. Until then it keeps failing, so the error reaches the
 *   error boundary instead of suspending forever.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same constraint as React.lazy
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): ComponentType<ComponentProps<T>> {
  let failedUrl: string | null = null
  let failedAt: number | null = null
  let attempt = 0
  const load = (): Promise<{ default: T }> => {
    const workerCanServe = typeof navigator !== 'undefined' && Boolean(navigator.serviceWorker?.controller)
    const request: Promise<{ default: T }> =
      isOffline() && !workerCanServe
        ? Promise.reject(new Error('Failed to fetch dynamically imported module: offline'))
        : failedUrl
          ? import(/* @vite-ignore */ `${failedUrl}?retry=${attempt}`)
          : factory()
    return request.catch((error: unknown) => {
      failedUrl = failedModuleUrl(error) ?? failedUrl
      attempt += 1
      failedAt = retryGeneration
      throw error
    })
  }
  let current: LazyExoticComponent<T> = lazy(load)
  function RetryableLazy(props: ComponentProps<T>) {
    if (failedAt !== null && retryGeneration > failedAt) {
      failedAt = null
      current = lazy(load)
    }
    return createElement(current as unknown as ComponentType<ComponentProps<T>>, props)
  }
  return RetryableLazy
}
