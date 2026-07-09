import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

export interface ModalProps {
  onClose: () => void
  /** id of the element that titles the dialog */
  labelledBy?: string
  /** 'sheet' slides to the bottom edge on small screens */
  align?: 'center' | 'sheet'
  className?: string
  children: React.ReactNode
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

/**
 * Accessible modal primitive: backdrop, Escape to close, focus moved into
 * the dialog on open and restored on close, Tab cycling trapped inside.
 */
export function Modal({ onClose, labelledBy, align = 'center', className, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    panelRef.current?.focus()

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      previouslyFocused?.focus()
    }
  }, [onClose])

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex justify-center',
        align === 'sheet' ? 'items-end sm:items-center sm:p-4' : 'items-center p-4',
      )}
    >
      <div className="animate-fade-in absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn(
          'animate-scale-in relative w-full max-w-md max-h-[85vh] overflow-y-auto bg-white p-6 shadow-float focus:outline-none',
          align === 'sheet' ? 'rounded-t-xl sm:rounded-xl' : 'rounded-xl',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
