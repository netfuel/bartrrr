import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { SITE_URL } from '@/lib/env'
import { clearChunkReloadFlag } from './chunk-reload'

const BASE_TITLE = "Bartrrr — Trade, don't buy"

/** Static titles for routes; dynamic pages keep the base title. */
const TITLES: [RegExp, string][] = [
  [/^\/$/, BASE_TITLE],
  [/^\/auth\/login$/, 'Log in · Bartrrr'],
  [/^\/auth\/signup$/, 'Join · Bartrrr'],
  [/^\/auth\/forgot-password$/, 'Reset password · Bartrrr'],
  [/^\/auth\/reset-password$/, 'Choose a new password · Bartrrr'],
  [/^\/auth\/callback$/, 'Signing in · Bartrrr'],
  [/^\/onboarding$/, 'Welcome · Bartrrr'],
  [/^\/dashboard$/, 'Dashboard · Bartrrr'],
  [/^\/feed$/, 'Neighborhood feed · Bartrrr'],
  [/^\/browse$/, 'Browse trades · Bartrrr'],
  [/^\/listing\/new$/, 'Post a listing · Bartrrr'],
  [/^\/listing\/[^/]+\/edit$/, 'Edit listing · Bartrrr'],
  [/^\/listing\/[^/]+$/, 'Listing · Bartrrr'],
  [/^\/offers$/, 'Offers · Bartrrr'],
  [/^\/offers\/[^/]+$/, 'Offer · Bartrrr'],
  [/^\/agreements$/, 'Trade agreements · Bartrrr'],
  [/^\/agreements\/[^/]+$/, 'Trade agreement · Bartrrr'],
  [/^\/profile\/[^/]+$/, 'Profile · Bartrrr'],
  [/^\/settings$/, 'Settings · Bartrrr'],
]

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
 * Per-route document title, canonical URL and robots hint, plus focus
 * management: after client-side navigation focus moves to the main content
 * so screen-reader and keyboard users land at the top of the new page.
 */
export function RouteEffects() {
  const { pathname } = useLocation()
  const firstRender = useRef(true)

  useEffect(() => {
    document.title = TITLES.find(([re]) => re.test(pathname))?.[1] ?? BASE_TITLE

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
