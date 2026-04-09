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
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="flex-1 rounded-full border border-sand bg-white px-4 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-clay focus:border-clay transition-colors"
      />
      <button
        type="submit"
        disabled={!text.trim()}
        className="p-2.5 rounded-full bg-clay text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-clay-dark transition-colors"
      >
        <Send className="h-4 w-4" />
      </button>
    </form>
  )
}
