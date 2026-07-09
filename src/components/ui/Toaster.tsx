import { Toast } from './Toast'
import { useToastStore } from '@/stores/toast-store'

/** Global toast host — mounted once in App. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismissToast = useToastStore((s) => s.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="fixed top-4 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4"
    >
      {toasts.map((t) => (
        <Toast
          key={t.id}
          message={t.message}
          type={t.type}
          duration={t.type === 'error' ? 8000 : 5000}
          onDismiss={() => dismissToast(t.id)}
        />
      ))}
    </div>
  )
}
