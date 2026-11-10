import { Toast } from './Toast'
import { useToastStore } from '@/stores/toast-store'

/** Global toast host — mounted once in App. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismissToast = useToastStore((s) => s.dismissToast)

  // The live region stays mounted even when empty: screen readers only
  // announce changes to a region that already exists in the DOM.
  //
  // Toasts sit at the bottom, clear of the header's search and bell: on
  // phones just above the bottom bar, and above a page's fixed action bar
  // (offer thread, listing) when there is one (--fixed-bar-h, set by
  // useFixedBarHeight). On desktop, bottom right, clear of the content.
  // The column itself lets taps through; only the toasts catch them.
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[60] mx-auto flex w-full max-w-sm flex-col gap-2 px-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px)+var(--fixed-bar-h,0px)+0.75rem)] lg:bottom-[calc(var(--fixed-bar-h,0px)+1.5rem)] lg:left-auto lg:right-6 lg:mx-0 lg:px-0 *:pointer-events-auto"
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
