import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { Button, type ButtonProps } from './Button'
import { renderShareCard, type ShareCardData } from '@/lib/utils/share-card'

export interface ShareButtonProps {
  title: string
  text: string
  url?: string
  /** When set, a rendered share-card image is attached where supported */
  card?: ShareCardData
  label?: string
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
  className?: string
}

export function ShareButton({
  title,
  text,
  url,
  card,
  label = 'Share',
  variant = 'outline',
  size = 'md',
  className,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false)
  const shareUrl = url ?? window.location.href

  const handleShare = async () => {
    // Attach a rendered share card when the platform can share files
    if (card && navigator.share && navigator.canShare) {
      const blob = await renderShareCard(card)
      if (blob) {
        const file = new File([blob], 'bartrrr-listing.png', { type: 'image/png' })
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ title, text, url: shareUrl, files: [file] })
            return
          } catch (err) {
            if ((err as Error).name === 'AbortError') return
            // fall through to plain share
          }
        }
      }
    }

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl })
        return
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
      }
    }

    // Desktop fallback: copy the link
    try {
      await navigator.clipboard.writeText(`${text}\n${shareUrl}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable — nothing sensible left to do
    }
  }

  return (
    <Button variant={variant} size={size} className={className} onClick={handleShare}>
      {copied ? (
        <>
          <Check className="h-4 w-4" /> Copied!
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" /> {label}
        </>
      )}
    </Button>
  )
}
