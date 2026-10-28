import { Check, Clock, X, Send, Eye, FileCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Offer } from '@/types'

interface TimelineStep {
  label: string
  timestamp?: string
  status: 'complete' | 'active' | 'waiting' | 'declined'
  icon: React.ReactNode
}

function buildSteps(offer: Offer): TimelineStep[] {
  const steps: TimelineStep[] = [
    {
      label: 'Offer sent',
      timestamp: offer.createdAt,
      status: 'complete',
      icon: <Send className="h-3.5 w-3.5" />,
    },
  ]

  if (offer.status === 'declined') {
    steps.push({
      label: 'Declined',
      timestamp: offer.messages[offer.messages.length - 1]?.createdAt,
      status: 'declined',
      icon: <X className="h-3.5 w-3.5" />,
    })
    return steps
  }

  if (offer.round > 1) {
    steps.push({
      label: `Counter-offer ${offer.round - 1} of ${offer.maxRounds - 1}`,
      timestamp: offer.messages.find((m) => m.type === 'counter')?.createdAt,
      status: 'complete',
      icon: <Eye className="h-3.5 w-3.5" />,
    })
  }

  if (offer.status === 'countered') {
    steps.push({
      label: 'Waiting for reply',
      status: 'waiting',
      icon: <Clock className="h-3.5 w-3.5" />,
    })
  }

  if (offer.status === 'withdrawn') {
    // The server stores no message for a withdrawal, so there's no timestamp
    steps.push({
      label: 'Withdrawn',
      status: 'declined',
      icon: <X className="h-3.5 w-3.5" />,
    })
  }

  if (offer.status === 'accepted') {
    steps.push({
      label: 'Accepted',
      timestamp: offer.messages.find((m) => m.type === 'accept')?.createdAt,
      status: 'complete',
      icon: <Check className="h-3.5 w-3.5" />,
    })
    steps.push({
      label: 'Sign agreement',
      status: 'active',
      icon: <FileCheck className="h-3.5 w-3.5" />,
    })
  }

  if (offer.status === 'pending') {
    steps.push({
      label: 'Waiting for reply',
      status: 'waiting',
      icon: <Clock className="h-3.5 w-3.5" />,
    })
  }

  return steps
}

const statusColors = {
  complete: 'bg-ink text-cream border-ink',
  active: 'bg-forest text-cream border-forest',
  waiting: 'bg-cream text-clay-dark border-clay border-dashed',
  declined: 'bg-clay-light text-clay-dark border-clay',
}

const lineColors = {
  complete: 'bg-ink',
  active: 'bg-forest',
  waiting: 'bg-ink/25',
  declined: 'bg-clay',
}

export interface OfferTimelineProps {
  offer: Offer
  className?: string
}

export function OfferTimeline({ offer, className }: OfferTimelineProps) {
  const steps = buildSteps(offer)

  return (
    <ol className={cn('no-scrollbar flex items-start gap-0 overflow-x-auto', className)}>
      {steps.map((step, i) => (
        <li key={i} className={cn('flex items-start', i < steps.length - 1 ? 'flex-1 min-w-[88px]' : 'shrink-0')}>
          {/* Step */}
          <div className="flex flex-col items-start gap-1.5">
            <div
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full border',
                statusColors[step.status],
              )}
            >
              {step.icon}
            </div>
            <p className="text-label text-ink mt-1 max-w-[8rem] leading-snug sm:max-w-none sm:whitespace-nowrap">
              {step.label}
            </p>
            {step.timestamp && (
              <p className="text-small text-muted">
                {new Date(step.timestamp).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            )}
          </div>

          {/* Connector line */}
          {i < steps.length - 1 && (
            <div
              aria-hidden="true"
              className={cn(
                'h-px flex-1 mx-3 mt-4 min-w-6',
                lineColors[steps[i + 1].status],
              )}
            />
          )}
        </li>
      ))}
    </ol>
  )
}
