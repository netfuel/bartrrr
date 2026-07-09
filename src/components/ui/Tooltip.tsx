import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TooltipProps {
  content: string
  className?: string
}

export function Tooltip({ content, className }: TooltipProps) {
  const [visible, setVisible] = useState(false)

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <button
        type="button"
        className="-m-2 p-2 text-muted hover:text-ink-2 transition-colors"
        aria-label="More info"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {visible && (
        <div className="animate-scale-in absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-md bg-ink text-white text-small p-3 shadow-float z-50 leading-relaxed">
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-ink" />
        </div>
      )}
    </span>
  )
}
