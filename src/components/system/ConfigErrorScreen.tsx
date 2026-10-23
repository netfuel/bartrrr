/**
 * Shown instead of the app when required env vars are missing, so a
 * misconfigured deploy is obvious instead of a blank page. Production users
 * get a neutral message; developers get the exact variables to set.
 */
export function ConfigErrorScreen({ missing }: { missing: string[] }) {
  const isDev = import.meta.env.DEV
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4" role="alert">
      <div className="w-full max-w-md">
        <span className="text-[20px] font-medium lowercase tracking-tight text-ink">bartrrr</span>
        {isDev ? (
          <>
            <h1 className="text-heading-page text-ink mt-6">Missing configuration</h1>
            <p className="text-base text-muted mt-3">
              Bartrrr needs these environment variables. Copy <code>.env.example</code> to{' '}
              <code>.env.local</code>, fill them in, and restart <code>npm run dev</code>:
            </p>
            <ul className="mt-4 space-y-1 font-mono text-sm text-ink">
              {missing.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            <p className="text-base text-muted mt-4">
              To explore with sample data and no backend, set <code>VITE_DEMO_MODE=true</code> instead.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-heading-page text-ink mt-6">We'll be right back</h1>
            <p className="text-base text-muted mt-3">
              Bartrrr is temporarily unavailable. Please try again in a few minutes.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
