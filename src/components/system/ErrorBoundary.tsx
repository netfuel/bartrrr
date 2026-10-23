import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Wordmark, buttonStyles } from '@/components/ui'
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
    console.error('[Bartrrr] Unhandled render error', error, info.componentStack)
    if (isStaleChunkError(error)) reloadOnceForNewBuild()
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    // Plain elements and <a href> on purpose: the router or a lazy chunk may
    // be what failed, so this screen must not depend on either.
    return (
      <div className="min-h-[100svh] bg-cream flex flex-col px-5 py-6" role="alert">
        <a href="/" aria-label="Bartrrr home" className="self-start rounded-sm">
          <Wordmark />
        </a>
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-12">
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
        </div>
      </div>
    )
  }
}
