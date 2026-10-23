import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/*
 * The design system defines its own type-scale utilities in globals.css
 * (text-label, text-small, text-display, …). Out of the box tailwind-merge
 * reads any unknown `text-*` class as a text *color*, so `cn('text-cream',
 * 'text-label')` silently dropped the color (and `cn('text-label',
 * 'text-clay')` dropped the type style). Registering them as font-size
 * classes lets size and color compose the way they read.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        'text-label',
        'text-small',
        'text-display',
        'text-heading-editorial',
        'text-heading-page',
        'text-heading-section',
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
