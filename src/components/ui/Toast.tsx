import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  onDismiss: () => void
  duration?: number
  className?: string
}

const typeStyles = {
  success: 'bg-paper border-teal text-ink [--toast-accent:var(--color-teal)]',
  error: 'bg-paper border-clay text-ink [--toast-accent:var(--color-clay)]',
  info: 'bg-paper border-ink text-ink [--toast-accent:var(--color-ink)]',
}

export function Toast({
  message,
  type = 'info',
  onDismiss,
  duration = 5000,
  className,
}: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration)
    return () => clearTimeout(timer)
  }, [onDismiss, duration])

  return (
    <div
      role="alert"
      className={cn(
        'animate-toast-in flex items-center gap-3 rounded-none border border-l-4 border-l-[var(--toast-accent)] px-4 py-3 text-[15px] shadow-lift',
        typeStyles[type],
        className,
      )}
    >
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 -m-2 p-2 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
