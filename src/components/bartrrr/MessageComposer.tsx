import { useId, useState } from 'react'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { showsCharCounter, useCharLimit } from '@/lib/utils/char-limit'
import { CharCounter } from '@/components/ui/CharCounter'

/** Messages are stored up to 2,000 characters (an emoji counts once). */
const MESSAGE_LIMIT = 2000

export interface MessageComposerProps {
  onSend: (content: string) => void
  placeholder?: string
  /** Accessible name for the text field (placeholders aren't labels) */
  label?: string
  className?: string
}

export function MessageComposer({
  onSend,
  placeholder = 'Write a message…',
  label = 'Message',
  className,
}: MessageComposerProps) {
  const [text, setText] = useState('')
  const countId = useId()
  const limitHandlers = useCharLimit<HTMLInputElement>(MESSAGE_LIMIT, { onChange: (e) => setText(e.target.value) })
  const counter = showsCharCounter(text, MESSAGE_LIMIT)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    onSend(text.trim())
    setText('')
  }

  return (
    <form onSubmit={handleSubmit} className={cn('flex flex-col gap-1', className)}>
      {counter && <CharCounter id={countId} value={text} limit={MESSAGE_LIMIT} className="self-end px-5" />}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={text}
          {...limitHandlers}
          placeholder={placeholder}
          aria-label={label}
          aria-describedby={counter ? countId : undefined}
          className="flex-1 min-w-0 min-h-[44px] sm:min-h-[48px] rounded-full border border-ink/40 bg-paper px-5 text-base placeholder:text-muted hover:border-ink focus:outline-none focus:border-clay focus:ring-1 focus:ring-clay transition-colors"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Send message"
          className="pressable flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full bg-ink text-cream disabled:opacity-35 disabled:cursor-not-allowed hover:bg-clay-dark transition-colors duration-300"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </form>
  )
}
