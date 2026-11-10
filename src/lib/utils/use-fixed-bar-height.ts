import { useLayoutEffect, type RefObject } from 'react'

/** CSS variable holding the height of the page's fixed bottom action bar, if any. */
export const FIXED_BAR_VAR = '--fixed-bar-h'

/**
 * Publish a fixed bottom action bar's height (e.g. the offer thread's
 * Accept / Counter-offer bar) as `--fixed-bar-h` on <html>, so things that
 * float at the bottom of the screen, like toasts, can sit above it.
 * Cleared when the bar unmounts.
 */
export function useFixedBarHeight(ref: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useLayoutEffect(() => {
    const bar = ref.current
    if (!bar) return
    const root = document.documentElement
    const publish = () => root.style.setProperty(FIXED_BAR_VAR, `${bar.offsetHeight}px`)
    publish()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish)
    ro?.observe(bar)
    return () => {
      ro?.disconnect()
      root.style.removeProperty(FIXED_BAR_VAR)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
