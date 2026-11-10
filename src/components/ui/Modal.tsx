import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export interface ModalProps {
  onClose: () => void
  /** id of the element that titles the dialog */
  labelledBy?: string
  /** 'sheet' slides to the bottom edge on small screens */
  align?: 'center' | 'sheet'
  className?: string
  children: React.ReactNode
  /**
   * Actions pinned to the bottom of the dialog. The content above scrolls on
   * its own, so the buttons stay in reach on a short phone screen.
   */
  footer?: React.ReactNode
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Accessible modal primitive: backdrop, Escape to close, focus moved into
 * the dialog on open and restored on close, Tab cycling trapped inside.
 */
export function Modal({ onClose, labelledBy, align = 'center', className, children, footer }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  // Callers pass inline closures; reading the latest via a ref keeps the
  // effect below mount-only, so a parent re-render (e.g. a realtime update)
  // doesn't yank focus out of the field the user is typing in.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    // Keep the page behind the dialog from scrolling
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
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
      document.body.style.overflow = overflow
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [])

  // Portaled to <body>: <main> runs an opacity animation, which makes it a
  // stacking context and would trap z-50 below the z-40 mobile bottom bar.
  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex justify-center',
        align === 'sheet' ? 'items-end sm:items-center sm:p-4' : 'items-center p-4',
      )}
    >
      <div className="animate-fade-in absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn(
          'relative w-full max-w-md max-h-[88svh] border border-ink bg-paper shadow-float focus:outline-none',
          footer ? 'flex flex-col' : 'overflow-y-auto p-6 sm:p-7',
          align === 'sheet' ? 'animate-slide-up sm:animate-scale-in' : 'animate-scale-in',
          'rounded-none',
          className,
        )}
      >
        {footer ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-6 pb-5 sm:px-7 sm:pt-7">{children}</div>
            <div className="shrink-0 border-t border-ink/20 bg-paper px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:px-7 sm:py-4">{footer}</div>
          </>
        ) : (
          children
        )}
      </div>
    </div>,
    document.body,
  )
}
