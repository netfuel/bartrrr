import { Wordmark } from '@/components/ui'

/**
 * Shown instead of the app when required env vars are missing, so a
 * misconfigured deploy is obvious instead of a blank page. Production users
 * get a neutral message; developers get the exact variables to set.
 */
export function ConfigErrorScreen({ missing }: { missing: string[] }) {
  const isDev = import.meta.env.DEV
  return (
    <div className="min-h-[100svh] bg-cream flex flex-col px-5 py-6" role="alert">
      <Wordmark className="self-start" />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-12">
        {isDev ? (
          <>
            <p className="text-label text-muted">Developer setup</p>
            <h1 className="text-heading-page text-ink mt-4">Bartrrr needs a few settings to start</h1>
            <p className="text-base text-ink-2 mt-4 leading-relaxed">
              Copy <code>.env.example</code> to <code>.env.local</code>, fill in these variables, then
              restart <code>npm run dev</code>:
            </p>
            <ul className="mt-5 space-y-1 border-y border-ink/20 py-4 font-mono text-small text-ink">
              {missing.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            <p className="text-base text-ink-2 mt-5 leading-relaxed">
              To explore with sample data and no backend, set <code>VITE_DEMO_MODE=true</code> instead.
            </p>
          </>
        ) : (
          <>
            <p className="text-label text-muted">Taking a short break</p>
            <h1 className="text-display !text-[clamp(2.75rem,8vw,4.5rem)] text-ink mt-4">
              We'll be <em>right back.</em>
            </h1>
            <p className="text-base text-ink-2 mt-6 max-w-md leading-relaxed">
              Bartrrr isn't available for a moment. Try again in a few minutes.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
