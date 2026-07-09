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
  success: 'bg-teal-light border-teal text-teal-dark',
  error: 'bg-clay-light border-clay text-clay-dark',
  info: 'bg-sand-light border-sand text-ink-2',
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
        'animate-toast-in flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lift text-[15px]',
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
