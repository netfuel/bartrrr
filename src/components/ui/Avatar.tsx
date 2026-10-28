import { useState } from 'react'
import { cn } from '@/lib/utils'
import { hashToColor } from '@/lib/utils'

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl'

export interface AvatarProps {
  src?: string
  name: string
  userId?: string
  size?: AvatarSize
  className?: string
}

const sizeMap: Record<AvatarSize, { px: number; text: string }> = {
  sm: { px: 22, text: 'text-[10px]' },
  md: { px: 32, text: 'text-xs' },
  lg: { px: 44, text: 'text-sm' },
  xl: { px: 64, text: 'text-lg' },
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export function Avatar({
  src,
  name,
  userId = '',
  size = 'md',
  className,
}: AvatarProps) {
  const { px, text } = sizeMap[size]
  const bgColor = hashToColor(userId || name)
  // A photo that won't load (deleted, offline, blocked) falls back to initials
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (src && src !== failedSrc) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        onError={() => setFailedSrc(src)}
        style={{ width: px, height: px }}
        className={cn(
          'photo-warm rounded-full object-cover shrink-0 bg-sand-light ring-1 ring-ink/10',
          className,
        )}
      />
    )
  }

  return (
    <div
      style={{ width: px, height: px, backgroundColor: bgColor }}
      className={cn(
        'rounded-full flex items-center justify-center shrink-0',
        text,
        'font-medium tracking-wide text-cream',
        className,
      )}
    >
      {getInitials(name)}
    </div>
  )
}
