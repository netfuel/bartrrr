import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Wordmark, buttonStyles } from '@/components/ui'
import { isNetworkReachable, isOffline, isStaleChunkError, reloadOnceForNewBuild, retryFailedChunks } from './chunk-reload'

interface Props {
  children: ReactNode
  /** Changing this (e.g. the pathname) clears a caught error */
  resetKey?: string
}

interface State {
  error: Error | null
  /** The page's code couldn't load because the connection is down */
  offline: boolean
}

/**
 * Last line of defense: a render error anywhere shows a friendly page
 * instead of a white screen. A page chunk that fails to load is either a
 * new deploy (reload once to pick up the new build) or a dropped
 * connection (say so, and try again when the connection comes back:
 * reloading offline would only show the browser's error page).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, offline: false }

  static getDerivedStateFromError(error: Error): State {
    return { error, offline: isStaleChunkError(error) && isOffline() }
  }

  componentDidMount() {
    window.addEventListener('online', this.handleOnline)
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.handleOnline)
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Bartrrr] Unhandled render error', error, info.componentStack)
    if (!isStaleChunkError(error) || this.state.offline) return
    // The browser thinks it's online: check before reloading into an error page
    void isNetworkReachable().then((reachable) => {
      if (this.state.error !== error) return
      if (reachable) reloadOnceForNewBuild()
      else this.setState({ offline: true })
    })
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.retry()
    }
  }

  /** Render the page again; lazy routes start a fresh download. */
  retry = () => {
    retryFailedChunks()
    this.setState({ error: null, offline: false })
  }

  handleOnline = () => {
    if (this.state.error && this.state.offline) this.retry()
  }

  render() {
    if (!this.state.error) return this.props.children

    // Plain elements and <a href> on purpose: the router or a lazy chunk may
    // be what failed, so this screen must not depend on either.
    const { offline } = this.state
    return (
      <div className="min-h-[100svh] bg-cream flex flex-col px-5 py-6" role="alert">
        <header className="self-start">
          <a href="/" aria-label="Bartrrr home" className="block rounded-sm">
            <Wordmark />
          </a>
        </header>
        <main id="main" className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-12">
          {offline ? (
            <>
              <p className="text-label text-muted">No connection</p>
              <h1 className="text-display !text-[clamp(2.75rem,8vw,4.5rem)] text-ink mt-4">
                You're <em>offline.</em>
              </h1>
              <p className="text-base text-ink-2 mt-6 max-w-md leading-relaxed">
                Reconnect and try again. This page picks up where you left off as soon as you're back online.
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={this.retry} className={buttonStyles({ variant: 'primary', size: 'lg' })}>
                  Try again
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-label text-muted">Something went wrong</p>
              <h1 className="text-display !text-[clamp(2.75rem,8vw,4.5rem)] text-ink mt-4">
                That didn't <em>load right.</em>
              </h1>
              <p className="text-base text-ink-2 mt-6 max-w-md leading-relaxed">
                Sorry about that. Reloading the page usually fixes it. If it keeps happening, try again in a few minutes.
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className={buttonStyles({ variant: 'primary', size: 'lg' })}
                >
                  Reload the page
                </button>
                <a href="/" className={buttonStyles({ variant: 'outline', size: 'lg' })}>
                  Go to the home page
                </a>
              </div>
            </>
          )}
        </main>
      </div>
    )
  }
}
