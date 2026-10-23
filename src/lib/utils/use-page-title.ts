import { useEffect } from 'react'

const BRAND = 'Bartrrr'

/** Sets document.title to "<page> | Bartrrr" (or just the brand line). */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${BRAND}` : `${BRAND}: Trade, don't buy`
  }, [title])
}
