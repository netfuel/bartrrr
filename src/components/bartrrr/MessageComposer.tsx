import { useState } from 'react'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MessageComposerProps {
  onSend: (content: string) => void
  placeholder?: string
  className?: string
}

export function MessageComposer({
  onSend,
  placeholder = 'Type a message...',
  className,
}: MessageComposerProps) {
  const [text, setText] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    onSend(text.trim())
    setText('')
  }

  return (
    <form onSubmit={handleSubmit} className={cn('flex items-center gap-2', className)}>
      <input
        type="text"
        aria-label={placeholder || 'Message'}
        maxLength={2000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-h-[48px] rounded-full border border-ink bg-cream px-5 text-base placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ink transition-colors"
      />
      <button
        type="submit"
        disabled={!text.trim()}
        aria-label="Send message"
        className="pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-cream disabled:opacity-50 disabled:cursor-not-allowed hover:bg-ink-2 transition-colors"
      >
        <Send className="h-5 w-5" />
      </button>
    </form>
  )
}
