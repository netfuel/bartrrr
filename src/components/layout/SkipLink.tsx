/**
 * First Tab stop in the app: jumps keyboard users past the sidebar and
 * header to the page itself. Hidden until focused.
 */
export function SkipLink({ target = 'main' }: { target?: string }) {
  return (
    <a
      href={`#${target}`}
      onClick={(e) => {
        // Move focus ourselves: a hash change would add a history entry the router sees
        const el = document.getElementById(target)
        if (!el) return
        e.preventDefault()
        el.focus()
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-ink focus:px-5 focus:py-3 focus:text-label focus:text-cream"
    >
      Skip to content
    </a>
  )
}
