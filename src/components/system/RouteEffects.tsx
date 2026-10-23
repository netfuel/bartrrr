import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { SITE_URL } from '@/lib/env'
import { clearChunkReloadFlag } from './chunk-reload'

/** Only these are worth indexing; app screens are behind login. */
const INDEXABLE = new Set(['/', '/auth/signup', '/auth/login'])

function setMeta(selector: string, create: () => HTMLElement, attr: string, value: string) {
  let el = document.head.querySelector<HTMLElement>(selector)
  if (!el) {
    el = create()
    document.head.appendChild(el)
  }
  el.setAttribute(attr, value)
}

/**
 * Per-route canonical URL and robots hint, plus focus management: after
 * client-side navigation focus moves to the main content so screen-reader
 * and keyboard users land at the top of the new page. Document titles are
 * set per page with usePageTitle (src/lib/utils/use-page-title.ts).
 */
export function RouteEffects() {
  const { pathname } = useLocation()
  const firstRender = useRef(true)

  useEffect(() => {
    const canonical = `${SITE_URL}${pathname === '/' ? '/' : pathname}`
    setMeta('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), 'href', canonical)
    setMeta('meta[property="og:url"]', () => {
      const m = document.createElement('meta')
      m.setAttribute('property', 'og:url')
      return m
    }, 'content', canonical)
    setMeta('meta[name="robots"]', () => {
      const m = document.createElement('meta')
      m.name = 'robots'
      return m
    }, 'content', INDEXABLE.has(pathname) ? 'index, follow' : 'noindex, follow')

    clearChunkReloadFlag()

    if (firstRender.current) {
      firstRender.current = false
      return
    }
    // Wait a frame so the lazily-loaded page has rendered
    const raf = requestAnimationFrame(() => {
      const target =
        document.querySelector<HTMLElement>('main') ??
        document.querySelector<HTMLElement>('h1') ??
        document.getElementById('root')
      if (!target) return
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
      target.focus({ preventScroll: true })
      window.scrollTo(0, 0)
    })
    return () => cancelAnimationFrame(raf)
  }, [pathname])

  return null
}
