import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { showsCharCounter, useCharLimit } from '@/lib/utils/char-limit'
import { CharCounter } from './CharCounter'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  /**
   * Most characters allowed, counted like the database (an emoji is 1).
   * Use this instead of maxLength, which counts emoji as 2 (T-66). Typing and
   * pasting stop at the limit, and a counter shows near it.
   */
  limit?: number
  /** Show the counter all the time, not only near the limit. */
  showCount?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, limit, showCount, className, id, onChange, onCompositionStart, onCompositionEnd, ...props }, ref) => {
    const limitHandlers = useCharLimit<HTMLInputElement>(limit, { onChange, onCompositionStart, onCompositionEnd })
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    const counter = showsCharCounter(props.value, limit, showCount)
    const describedBy =
      [error ? `${inputId}-error` : helperText ? `${inputId}-helper` : '', counter ? `${inputId}-count` : '']
        .filter(Boolean)
        .join(' ') || undefined

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-label text-ink-2"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'min-h-[50px] rounded-none border border-ink/40 bg-paper px-4 py-2.5 text-base font-body text-ink placeholder:text-muted transition-[border-color,box-shadow] duration-200',
            'hover:border-ink focus:outline-none focus:border-clay focus:ring-1 focus:ring-clay',
            error && 'border-clay text-clay-dark focus:ring-clay',
            className,
          )}
          {...props}
          {...limitHandlers}
        />
        {(error || helperText || counter) && (
          <div className="flex items-start justify-between gap-3">
            {error && (
              <p id={`${inputId}-error`} className="text-small text-clay-dark animate-fade-in">
                {error}
              </p>
            )}
            {helperText && !error && (
              <p id={`${inputId}-helper`} className="text-small text-muted">
                {helperText}
              </p>
            )}
            {counter && <CharCounter id={`${inputId}-count`} value={props.value} limit={limit} className="ml-auto shrink-0" />}
          </div>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
