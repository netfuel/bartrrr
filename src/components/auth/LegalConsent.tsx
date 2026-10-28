import { Link } from 'react-router-dom'

/** Shown under sign-up and log-in: Google and Apple create an account on first use. */
export function LegalConsent({ action }: { action: string }) {
  return (
    <p className="text-small text-muted text-center leading-relaxed">
      By {action}, you agree to our{' '}
      <Link to="/terms" className="text-ink underline underline-offset-2 decoration-1 hover:text-clay-dark">
        terms of use
      </Link>{' '}
      and{' '}
      <Link to="/privacy" className="text-ink underline underline-offset-2 decoration-1 hover:text-clay-dark">
        privacy policy
      </Link>
      . You must be 18 or older.
    </p>
  )
}
