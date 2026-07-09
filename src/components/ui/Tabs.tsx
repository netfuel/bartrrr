import { useRef } from 'react'
import { cn } from '@/lib/utils'

export interface TabItem<T extends string = string> {
  id: T
  label: string
  icon?: React.ReactNode
  /** Optional badge count shown next to the label when > 0 */
  count?: number
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[]
  active: T
  onChange: (id: T) => void
  /** 'pill' = segmented control; 'underline' = scrollable bar with bottom border */
  variant?: 'pill' | 'underline'
  /** Accessible name for the tab list */
  label?: string
  className?: string
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  variant = 'pill',
  label,
  className,
}: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null)

  // Left/Right arrows move selection, per the WAI-ARIA tabs pattern
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const i = tabs.findIndex((t) => t.id === active)
    const next =
      e.key === 'ArrowRight'
        ? tabs[(i + 1) % tabs.length]
        : tabs[(i - 1 + tabs.length) % tabs.length]
    onChange(next.id)
    listRef.current
      ?.querySelector<HTMLButtonElement>(`[data-tab-id="${next.id}"]`)
      ?.focus()
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={cn(
        variant === 'pill'
          ? 'flex gap-1 bg-sand-light rounded-full p-1'
          : 'flex gap-1 overflow-x-auto border-b border-sand-light',
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            data-tab-id={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center justify-center gap-1.5 text-sm font-medium whitespace-nowrap transition-colors',
              variant === 'pill'
                ? cn(
                    'flex-1 min-h-[40px] rounded-full px-3',
                    isActive ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink-2',
                  )
                : cn(
                    'min-h-[44px] px-3 border-b-2 -mb-px',
                    isActive
                      ? 'border-clay text-clay'
                      : 'border-transparent text-muted hover:text-ink',
                  ),
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-clay text-white text-[10px] font-bold px-1">
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
