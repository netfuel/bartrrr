import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isStaleChunkError, reloadOnceForNewBuild } from './chunk-reload'

interface Props {
  children: ReactNode
  /** Changing this (e.g. the pathname) clears a caught error */
  resetKey?: string
}

interface State {
  error: Error | null
}

/**
 * Last line of defense: a render error anywhere shows a friendly page
 * instead of a white screen. A stale-chunk error after a deploy reloads
 * the page once to pick up the new build.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Bartr] Unhandled render error', error, info.componentStack)
    if (isStaleChunkError(error)) reloadOnceForNewBuild()
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4" role="alert">
        <div className="w-full max-w-sm text-center">
          <span className="text-[20px] font-medium lowercase tracking-tight text-ink">bartrrr</span>
          <h1 className="text-heading-page text-ink mt-8">Something went wrong</h1>
          <p className="text-base text-muted mt-3">
            Sorry about that. Reloading usually fixes it. If it keeps happening, try again in a few minutes.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="pressable inline-flex min-h-[52px] items-center justify-center rounded-none bg-ink px-8 text-base font-medium text-cream hover:bg-ink-2"
            >
              Reload
            </button>
            <a
              href="/"
              className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-ink px-8 text-base font-medium text-ink hover:bg-ink hover:text-cream"
            >
              Go home
            </a>
          </div>
        </div>
      </div>
    )
  }
}
