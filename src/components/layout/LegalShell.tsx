import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Wordmark } from '@/components/ui'
import { LEGAL_UPDATED } from '@/lib/legal'

export interface LegalSection {
  id: string
  title: string
  body: ReactNode
}

interface LegalShellProps {
  eyebrow: string
  title: ReactNode
  summary: ReactNode
  sections: LegalSection[]
  /** The other legal page, linked in the header */
  sibling: { to: string; label: string }
}

/**
 * Reading layout for the privacy policy and terms: one calm column,
 * a plain-language summary up top, numbered sections with anchors.
 */
export function LegalShell({ eyebrow, title, summary, sections, sibling }: LegalShellProps) {
  return (
    <div className="min-h-[100svh] bg-cream">
      <header className="border-b border-ink">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
          <Link to="/" aria-label="Bartrrr home" className="rounded-sm">
            <Wordmark />
          </Link>
          <Link to={sibling.to} className="text-label link-underline">
            {sibling.label}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pt-12 pb-20 sm:pt-16 animate-fade-up">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="text-heading-editorial text-ink mt-5">{title}</h1>
        <p className="text-label text-muted mt-6">Last updated {LEGAL_UPDATED}</p>

        <aside className="paper border border-ink mt-10 px-6 py-6 sm:px-8 sm:py-7">
          <h2 className="text-heading-section text-ink">The short version</h2>
          <div className="mt-4 space-y-3 text-base leading-relaxed text-ink-2">{summary}</div>
        </aside>

        <nav aria-label="On this page" className="mt-12">
          <p className="text-label text-muted">On this page</p>
          <ol className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.id} className="flex gap-3 text-small">
                <span className="text-numeral text-muted w-5 shrink-0">{i + 1}</span>
                <a href={`#${s.id}`} className="link-underline text-ink-2 hover:text-ink">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-12">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="border-t border-ink py-10 scroll-mt-6">
              <h2 className="text-heading-section text-ink flex gap-4">
                <span className="text-numeral text-clay">{i + 1}</span>
                <span>{s.title}</span>
              </h2>
              <div className="legal-prose mt-5">{s.body}</div>
            </section>
          ))}
        </div>

        <footer className="border-t border-ink pt-8 flex flex-wrap items-center gap-x-8 gap-y-3">
          <Link to="/" className="text-label link-underline">Home</Link>
          <Link to="/privacy" className="text-label link-underline">Privacy policy</Link>
          <Link to="/terms" className="text-label link-underline">Terms of use</Link>
        </footer>
      </main>
    </div>
  )
}
